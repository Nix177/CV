// scripts/build-fun-facts.mjs (v5)
// Build dataset for Fun Facts cards (EN/FR/DE) from Wikipedia lists.
//
// Sources:
//  - FR: https://fr.wikipedia.org/wiki/Liste_d%27id%C3%A9es_re%C3%A7ues
//  - EN: https://en.wikipedia.org/wiki/List_of_common_misconceptions_about_arts_and_culture
//  - EN: https://en.wikipedia.org/wiki/List_of_common_misconceptions_about_history
//  - EN: https://en.wikipedia.org/wiki/List_of_common_misconceptions_about_science,_technology,_and_mathematics
//
// Goals:
//  - Extract many candidates; filter out bibliography/journal refs
//  - Heuristic Claim/Explain; limit explain ≤ 30 words
//  - Fill missing explain via LLM when available
//  - Guarantee up to --per per language (default 200) using translations
//  - Keep original Wikipedia URL unchanged; stable id across langs
//
// Usage (PowerShell):
//   $env:OPENAI_API_KEY="sk-..."; node scripts/build-fun-facts.mjs --out=public\ff-dataset.json --per=200 --seed=42
//   node scripts/build-fun-facts.mjs --out=public\ff-dataset.json --per=200 --seed=42 --no-llm   (no translations -> counts may be < 200)

import fs from 'node:fs/promises';
import path from 'node:path';

// ---------- CLI ----------
const ARGS = Object.fromEntries(process.argv.slice(2).map(kv => {
  const [k, v] = kv.replace(/^--/, '').split('=');
  return [k, v ?? true];
}));
const OUT     = ARGS.out   || 'public/ff-dataset.json';
const PER     = Math.max(1, Math.min(1000, parseInt(ARGS.per ?? '200', 10) || 200));
const SEED    = parseInt(ARGS.seed ?? '42', 10) || 42;
const USE_LLM = !('no-llm' in ARGS) && !!process.env.OPENAI_API_KEY;

// ---------- Sources ----------
const PAGES_EN = [
  'https://en.wikipedia.org/wiki/List_of_common_misconceptions_about_arts_and_culture',
  'https://en.wikipedia.org/wiki/List_of_common_misconceptions_about_history',
  'https://en.wikipedia.org/wiki/List_of_common_misconceptions_about_science,_technology,_and_mathematics',
];
const PAGE_FR = 'https://fr.wikipedia.org/wiki/Liste_d%27id%C3%A9es_re%C3%A7ues';

// ---------- Utils ----------
const trim = s => String(s || '').replace(/\s+/g, ' ').trim();
const words = s => trim(s).split(/\s+/).filter(Boolean);
const clampWords = (txt, max=30) => {
  const w = words(txt);
  return w.length <= max ? trim(txt) : w.slice(0, max).join(' ') + '…';
};
const hash = (s) => { let h=0; for (let i=0;i<s.length;i++) h=(h*31+s.charCodeAt(i))|0; return (h>>>0).toString(36); };
const idOf = (url, claimOriginal) => hash(`${url}|${trim(claimOriginal).slice(0,200)}`);
function mulberry32(a){return function(){let t=a+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;}}
function shuffleSeeded(arr, seed=SEED){const r=mulberry32(seed);for(let i=arr.length-1;i>0;i--){const j=(r()*(i+1))|0;[arr[i],arr[j]]=[arr[j],arr[i]];}return arr;}
const sleep = (ms)=>new Promise(r=>setTimeout(r,ms));

async function fetchHtml(url, langHint='en') {
  const r = await fetch(url, {
    headers: {
      'user-agent': 'ff-build/5.0 (dataset generator)',
      'accept-language': langHint==='fr' ? 'fr,en;q=0.9' : 'en;q=0.9'
    }
  });
  if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`);
  return r.text();
}

// ---------- Clean & filters ----------
const MONTHS_EN = 'January|February|March|April|May|June|July|August|September|October|November|December';
const MONTHS_FR = 'janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre';
const COMMON_ABBR = [
  'Mr','Mrs','Ms','Dr','Prof','St','Sr','Jr','Mt','Dept','U.S','U.K','e.g','i.e','vs'
];

const rxAbbr = new RegExp(`\\b(?:${COMMON_ABBR.map(x=>x.replace('.','\\.')).join('|')})\\.$`,'i');

function isRefLikeEN(t) {
  const s = trim(t);
  if (!s) return true;
  if (/^(↑|→|See also|References|Bibliography|Notes?|Further reading)\b/i.test(s)) return true;
  if (/\b(PMID|DOI|ISBN|ISSN|Retrieved|Archived|Press|University|Journal|Vol\.|pp\.)\b/i.test(s)) return true;
  if (new RegExp(`\\b(?:${MONTHS_EN})\\b`, 'i').test(s) && /\b(19|20)\d{2}\b/.test(s)) return true;
  if (/\b(YouTube|Big Think|Burke Museum|NYTimes|BBC\.com|Guardian|Ad Age|New Scientist)\b/i.test(s)) return true;
  if (/https?:\/\//i.test(s)) return true;
  if (/^".+?"\s*(,|—|-)/.test(s)) return true;
  if (/^\s*[A-Z][^,]{2,},\s/.test(s)) return true; // "Lastname, ..."
  if (s.length < 25) return true;
  return false;
}
function isRefLikeFR(t) {
  const s = trim(t);
  if (!s) return true;
  if (/^(↑|→|Voir aussi|Bibliographie|Notes? et r(é|e)f(é|e)rences?)\b/i.test(s)) return true;
  if (/\b(consult[ée] le|PMID|DOI|ISBN|ISSN|Presses|Éditions|Journal|Tome|p\.)\b/i.test(s)) return true;
  if (new RegExp(`\\b(?:${MONTHS_FR})\\b`, 'i').test(s) && /\b(19|20)\d{2}\b/.test(s)) return true;
  if (/https?:\/\//i.test(s)) return true;
  if (/^«.+?»\s*(,|—|-)/.test(s)) return true;
  if (/^\s*[A-ZÉÈÀÂÎÔÛÄÖÜ][^,]{2,},\s/.test(s)) return true;
  if (s.length < 25) return true;
  return false;
}
const cleanNoise = (t) => trim(String(t)
  .replace(/\[[^\]]*?\]/g, ' ')
  .replace(/\s*\((?:PMID|DOI|ISBN|ISSN|Retrieved|Archived|consult[ée] le)[^)]+\)\s*/gi, ' ')
  .replace(/[“”„‟‘’«»]/g, '"')
  .replace(/^[↑→]\s*/, '')
  .replace(/\s{2,}/g,' ')
);

// Sentence split that avoids common abbreviations
function splitFirstSentenceSmart(txt) {
  const t = trim(txt).replace(/\[\d+\]/g,'');
  // find period/question/exclamation followed by space + Uppercase, but ignore abbrev before dot
  const re = /(.+?)([.!?…])(\s+)([A-ZÉÈÀÂÎÔÛÄÖÜ])/;
  const m = re.exec(t);
  if (m) {
    const before = trim(m[1]);
    const punct   = m[2];
    const after   = trim(t.slice(m.index + (m[1].length + punct.length)));
    if (!rxAbbr.test(before)) return { s1: before + punct, rest: after };
  }
  return { s1: t, rest: '' };
}

// Heuristics to detect a "claim-like" sentence
function looksLikeClaimEN(s) {
  s = trim(s);
  if (!s) return false;
  if (/^(Many|People|Some|It|They|The|A|An|There|Contrary|In fact|It is (often|commonly) believed|A common misconception)/i.test(s)) return true;
  if (/\b(is|are|was|were|do|does|did|have|has|had)\s+not\b/i.test(s)) return true;
  if (/\b(no|never|nothing|none)\b/i.test(s)) return true;
  if (/^(Myth|Misconception)\s*[:\-]/i.test(s)) return true;
  return false;
}
function looksLikeClaimFR(s) {
  s = trim(s);
  if (!s) return false;
  if (/^(Les|La|Le|Un|Une|On|Il|Elle|L’|L'|Beaucoup|Certains|Souvent|On pense que|Il est (courant|répandu) de croire que|Contrairement|En réalité|On dit que)\b/i.test(s)) return true;
  if (/^(Mythe|Idée reçue)\s*[:\-]/i.test(s)) return true;
  if (/\b(ne|n’|n')\s*(pas|plus|jamais)\b/i.test(s)) return true;
  return false;
}

// Claim/Explain heuristics
function heuristicCE(text, lang) {
  const t = cleanNoise(text);
  const { s1, rest } = splitFirstSentenceSmart(t);
  if (lang === 'fr') {
    if (looksLikeClaimFR(s1)) return { claim: s1.replace(/^[-–—•]\s*/, ''), explain: clampWords(rest || '', 30) };
    const m = t.match(/^(.+?)\s+(?:mais|cependant|pourtant)\b(.+)$/i);
    if (m) return { claim: trim(m[1]), explain: clampWords(trim(m[2]), 30) };
    return { claim: s1.replace(/^[-–—•]\s*/, ''), explain: clampWords(rest || '', 30) };
  } else {
    if (looksLikeClaimEN(s1)) return { claim: s1.replace(/^[-–—•]\s*/, ''), explain: clampWords(rest || '', 30) };
    const m = t.match(/^(.+?)\s+(?:but|however|although)\b(.+)$/i);
    if (m) return { claim: trim(m[1]), explain: clampWords(trim(m[2]), 30) };
    return { claim: s1.replace(/^[-–—•]\s*/, ''), explain: clampWords(rest || '', 30) };
  }
}

// ---------- Extraction ----------
async function extractBlocks(html, lang) {
  try {
    const mod = await import('cheerio');
    const $ = (mod.default || mod).load(html);
    const out = [];
    $('#mw-content-text .mw-parser-output ul > li').each((_, li) => {
      const t = cleanNoise($(li).text());
      if (lang==='fr' ? !isRefLikeFR(t) : !isRefLikeEN(t)) out.push(t);
    });
    $('#mw-content-text .mw-parser-output ul ul > li').each((_, li) => {
      const t = cleanNoise($(li).text());
      if (lang==='fr' ? !isRefLikeFR(t) : !isRefLikeEN(t)) out.push(t);
    });
    $('#mw-content-text .mw-parser-output > p').each((_, p) => {
      const t = cleanNoise($(p).text());
      if (lang==='fr' ? !isRefLikeFR(t) : !isRefLikeEN(t)) out.push(t);
    });
    return out;
  } catch {
    const out = [];
    const re = /<(?:li|p)[^>]*>([\s\S]*?)<\/(?:li|p)>/gi;
    let m;
    while ((m = re.exec(html))) {
      const raw = m[1].replace(/<[^>]+>/g, ' ');
      const t = cleanNoise(raw);
      if (lang==='fr' ? !isRefLikeFR(t) : !isRefLikeEN(t)) out.push(t);
    }
    return out;
  }
}

async function collectEN() {
  const buf = [];
  for (const url of PAGES_EN) {
    try {
      const html = await fetchHtml(url, 'en');
      const blocks = await extractBlocks(html, 'en');
      for (const b of blocks) {
        const { claim, explain } = heuristicCE(b, 'en');
        const c = trim(claim);
        if (!c || c.length < 8) continue;
        const id = idOf(url, c);
        buf.push({ id, source: url, claim: c, explain: clampWords(explain || '', 30) });
      }
      console.log(`EN: ${url} → blocks=${blocks.length} → collected=${buf.length}`);
    } catch (e) {
      console.warn('WARN EN:', e?.message || e);
    }
  }
  // de-dup
  const seen = new Set(), uniq = [];
  for (const it of buf) if (!seen.has(it.id)) { seen.add(it.id); uniq.push(it); }
  return uniq;
}

async function collectFRnative() {
  const buf = [];
  try {
    const html = await fetchHtml(PAGE_FR, 'fr');
    const blocks = await extractBlocks(html, 'fr');
    for (const b of blocks) {
      const { claim, explain } = heuristicCE(b, 'fr');
      const c = trim(claim);
      if (!c || c.length < 8) continue;
      const id = idOf(PAGE_FR, c);
      buf.push({ id, source: PAGE_FR, claim: c, explain: clampWords(explain || '', 30) });
    }
    console.log(`FR: ${PAGE_FR} → blocks=${buf.length}`);
  } catch (e) {
    console.warn('WARN FR:', e?.message || e);
  }
  const seen = new Set(), uniq = [];
  for (const it of buf) if (!seen.has(it.id)) { seen.add(it.id); uniq.push(it); }
  return uniq;
}

// ---------- LLM helpers (optional) ----------
async function chatJson(system, user) {
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'content-type':'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [{ role:'system', content: system }, { role:'user', content: user }]
    })
  });
  if (!r.ok) return null;
  const data = await r.json();
  try { return JSON.parse(data.choices?.[0]?.message?.content || '{}'); }
  catch { return null; }
}

async function fillExplainLLM(lang, claim, rawText) {
  if (!USE_LLM) return null;
  const label = lang==='fr' ? 'FR' : lang==='de' ? 'DE' : 'EN';
  const sys = `Write a concise refutation ("explain") in ${label}, ≤ 30 words. Return JSON {"explain":"…"} only.`;
  const user = `Claim: ${claim}\nSource snippet:\n${rawText}`;
  const out = await chatJson(sys, user);
  const explain = trim(out?.explain || '');
  return explain ? clampWords(explain, 30) : null;
}

async function translatePair(toLang, pair) {
  if (!USE_LLM) return null;
  const map = { fr:'French', de:'German', en:'English' };
  const tgt = map[toLang] || 'French';
  const sys = `Translate to ${tgt}. Keep meaning exact, concise. Return {"claim":"…","explain":"…"}; "explain" ≤ 30 words.`;
  const user = JSON.stringify({ claim: pair.claim, explain: pair.explain || '' });
  const out = await chatJson(sys, user);
  if (!out) return null;
  const claim = trim(out.claim || '');
  const explain = clampWords(trim(out.explain || ''), 30);
  return claim ? { claim, explain } : null;
}

// small concurrency
async function mapLimit(arr, n, fn) {
  const out = new Array(arr.length);
  let i = 0;
  async function worker(){ while(i < arr.length){ const idx=i++; out[idx]=await fn(arr[idx], idx);} }
  await Promise.all(Array.from({length: Math.min(n, arr.length)}, worker));
  return out;
}

// ---------- Build ----------
(async () => {
  // 1) Collect pools
  const baseEN = await collectEN();
  const baseFR = await collectFRnative();
  console.log(`Pools: EN=${baseEN.length}, FR=${baseFR.length}`);

  // 2) Sanity: try to fill empty explains from their original raw text (best-effort, LLM only)
  // We don't have raw blocks stored here; as a workaround, if explain is empty, produce a neutral short refutation from the claim itself.
  async function ensureExplain(lang, it) {
    if (it.explain && words(it.explain).length >= 3) return it;
    if (USE_LLM) {
      const e = await fillExplainLLM(lang, it.claim, it.claim);
      if (e) return { ...it, explain: e };
    }
    // heuristic fallback: prefix like "En réalité, ..." / "In fact, ..."
    const prefix = lang==='fr' ? 'En réalité, ' : lang==='de' ? 'Tatsächlich, ' : 'In fact, ';
    return { ...it, explain: clampWords(prefix + it.claim.replace(/\b(not|no|never)\b/ig,'') , 30) };
  }

  // 3) Clean blanks
  const cleanEN = [];
  for (const it of baseEN) cleanEN.push(await ensureExplain('en', it));
  const cleanFR = [];
  for (const it of baseFR) cleanFR.push(await ensureExplain('fr', it));

  // 4) Sample deterministic from each pool
  const takeEN = cleanEN.length <= PER ? cleanEN : shuffleSeeded([...cleanEN]).slice(0, PER);
  const takeFR = cleanFR.length <= PER ? cleanFR : shuffleSeeded([...cleanFR]).slice(0, PER);

  // 5) Build EN target (prefer EN, then FR→EN translations if needed)
  const itemsEN = takeEN.map(it => ({ id: it.id, lang:'en', claim: it.claim, explain: clampWords(it.explain,30), source: it.source }));
  if (itemsEN.length < PER && USE_LLM && takeFR.length) {
    const need = Math.min(PER - itemsEN.length, takeFR.length);
    const add = shuffleSeeded([...takeFR]).slice(0, need);
    const tr = await mapLimit(add, 6, async it => {
      const t = await translatePair('en', { claim: it.claim, explain: it.explain });
      return { id: it.id, lang:'en', claim: (t?.claim || it.claim), explain: clampWords((t?.explain || it.explain), 30), source: it.source };
    });
    itemsEN.push(...tr.filter(Boolean));
  }

  // 6) Build FR target (prefer FR native, then EN→FR)
  const itemsFR = takeFR.map(it => ({ id: it.id, lang:'fr', claim: it.claim, explain: clampWords(it.explain,30), source: it.source }));
  if (itemsFR.length < PER) {
    const need = Math.min(PER - itemsFR.length, takeEN.length);
    const add = shuffleSeeded([...takeEN]).slice(0, need);
    if (USE_LLM) {
      const tr = await mapLimit(add, 6, async it => {
        const t = await translatePair('fr', { claim: it.claim, explain: it.explain });
        return { id: it.id, lang:'fr', claim: (t?.claim || it.claim), explain: clampWords((t?.explain || it.explain), 30), source: it.source };
      });
      itemsFR.push(...tr.filter(Boolean));
    } else {
      itemsFR.push(...add.map(it => ({ id: it.id, lang:'fr', claim: it.claim, explain: clampWords(it.explain,30), source: it.source })));
    }
  }

  // 7) Build DE target (translate EN & FR to DE, dedupe by id, cap to PER)
  let poolDE = [];
  if (USE_LLM) {
    const deFromEN = await mapLimit(takeEN, 6, async it => {
      const t = await translatePair('de', { claim: it.claim, explain: it.explain });
      return { id: it.id, lang:'de', claim: (t?.claim || it.claim), explain: clampWords((t?.explain || it.explain), 30), source: it.source };
    });
    const deFromFR = await mapLimit(takeFR, 6, async it => {
      const t = await translatePair('de', { claim: it.claim, explain: it.explain });
      return { id: it.id, lang:'de', claim: (t?.claim || it.claim), explain: clampWords((t?.explain || it.explain), 30), source: it.source };
    });
    poolDE = [...deFromEN, ...deFromFR].filter(Boolean);
  } else {
    poolDE = [...takeEN, ...takeFR].map(it => ({ id: it.id, lang:'de', claim: it.claim, explain: clampWords(it.explain,30), source: it.source }));
  }
  const seenDE = new Set(), uniqDE = [];
  for (const it of poolDE) if (!seenDE.has(it.id)) { seenDE.add(it.id); uniqDE.push(it); }
  const itemsDE = uniqDE.length <= PER ? uniqDE : shuffleSeeded([...uniqDE]).slice(0, PER);

  // 8) Final cap and write
  const cap = (arr) => arr.length <= PER ? arr : shuffleSeeded([...arr]).slice(0, PER);
  const finalEN = cap(itemsEN);
  const finalFR = cap(itemsFR);
  const finalDE = cap(itemsDE);

  // Hard validation: drop any item with empty claim or empty explain after all steps
  const valid = it => it && trim(it.claim) && trim(it.explain);
  const outEN = finalEN.filter(valid);
  const outFR = finalFR.filter(valid);
  const outDE = finalDE.filter(valid);

  const dataset = {
    version: 5,
    generatedAt: new Date().toISOString(),
    items: [...outEN, ...outFR, ...outDE]
  };

  const outAbs = path.resolve(process.cwd(), OUT);
  await fs.mkdir(path.dirname(outAbs), { recursive: true });
  await fs.writeFile(outAbs, JSON.stringify(dataset, null, 2), 'utf8');
  console.log(`Wrote ${outAbs} (EN/FR/DE = ${outEN.length}/${outFR.length}/${outDE.length}; target ${PER}; LLM=${USE_LLM?'on':'off'})`);
})();
