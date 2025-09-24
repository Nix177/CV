// scripts/build-fun-facts.mjs
// Build dataset for Fun Facts cards (EN/FR/DE).
// Sources: 3 EN misconception lists + 1 FR list.
// Guarantee up to --per items PER LANGUAGE (default 200) using translations.
// IDs are stable per original source item (hash(url|claim_original)).
// Source URLs are preserved unchanged across translations.
//
// Usage (PowerShell):
//   $env:OPENAI_API_KEY="sk-..."; node scripts/build-fun-facts.mjs --out=public\ff-dataset.json --per=200 --seed=42
//   node scripts/build-fun-facts.mjs --out=public\ff-dataset.json --per=200 --seed=42 --no-llm   (FR/DE will fallback to EN, counts may be < 200)

import fs from 'node:fs/promises';
import path from 'node:path';

// ---------- CLI ----------
const ARGS = Object.fromEntries(process.argv.slice(2).map(kv => {
  const [k, v] = kv.replace(/^--/, '').split('=');
  return [k, v ?? true];
}));
const OUT    = ARGS.out   || 'public/ff-dataset.json';
const PER    = Math.max(1, Math.min(1000, parseInt(ARGS.per ?? '200', 10) || 200));
const SEED   = parseInt(ARGS.seed ?? '42', 10) || 42;
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
const clampWords = (txt, max=30) => {
  const w = trim(txt).split(/\s+/);
  return w.length <= max ? trim(txt) : w.slice(0, max).join(' ') + '…';
};
const hash = (s) => { let h=0; for (let i=0;i<s.length;i++) h=(h*31+s.charCodeAt(i))|0; return (h>>>0).toString(36); };
const idOf = (url, claimOriginal) => hash(`${url}|${trim(claimOriginal).slice(0,200)}`);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
function mulberry32(a){return function(){var t=a+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;}}
function shuffleSeeded(arr, seed=SEED) { const r=mulberry32(seed); for(let i=arr.length-1;i>0;i--){const j=(r()*(i+1))|0; [arr[i],arr[j]]=[arr[j],arr[i]];} return arr; }

async function fetchHtml(url, langHint='en') {
  const r = await fetch(url, { headers:{
    'user-agent':'ff-build/3.0 (dataset generator)',
    'accept-language': langHint==='fr' ? 'fr,en;q=0.9' : 'en;q=0.9'
  }});
  if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`);
  return r.text();
}

const isRefLikeEN = (t) => {
  const s = trim(t);
  if (!s) return true;
  if (/^(↑|→|See also|References|Bibliography|Notes?)/i.test(s)) return true;
  if (/\b(PMID|DOI|ISBN|ISSN|Retrieved|Archived)\b/i.test(s)) return true;
  if (/^\s*[A-Z][^,]{2,},\s/.test(s)) return true; // "Lastname, "
  if (s.length < 25) return true;
  return false;
};
const isRefLikeFR = (t) => {
  const s = trim(t);
  if (!s) return true;
  if (/^(↑|→|Voir aussi|Bibliographie|Notes? et r(é|e)f(é|e)rences?)/i.test(s)) return true;
  if (/\b(consult[ée] le|PMID|DOI|ISBN|ISSN|Paris:|p\.\s*\d+|op\. cit\.)\b/i.test(s)) return true;
  if (/^\s*[A-ZÉÈÀÂÎÔÛÄÖÜ][^,]{2,},\s/.test(s)) return true;
  if (s.length < 25) return true;
  return false;
};
const cleanNoise = (t) => trim(String(t)
  .replace(/\[[^\]]*?\]/g, ' ')
  .replace(/\s*\((?:PMID|DOI|ISBN|ISSN|Retrieved|Archived|consult[ée] le)[^)]+\)\s*/gi, ' ')
  .replace(/[“”„‟‘’«»]/g, '"')
  .replace(/^[↑→]\s*/, '')
);

function splitFirstSentence(txt) {
  const t = trim(txt).replace(/\[\d+\]/g, '');
  const m = t.match(/^(.+?[.!?…])\s+(.+)$/);
  return m ? { s1: trim(m[1]), rest: trim(m[2]) } : { s1: t, rest: '' };
}
function looksLikeClaimEN(s) {
  s = trim(s);
  if (!s) return false;
  if (/^(Many|People|Some|It|They|The|A|An|There|Contrary|In fact|It is (often|commonly) believed|A common misconception)/i.test(s)) return true;
  if (/\b(is|are|was|were|do|does|did|have|has|had)\s+not\b/i.test(s)) return true;
  if (/\b(no|never|nothing|none)\b/i.test(s)) return true;
  return false;
}
function looksLikeClaimFR(s) {
  s = trim(s);
  if (!s) return false;
  if (/^(Les|La|Le|Un|Une|On|Il|Elle|L’|L'|Beaucoup|Certains|Souvent|On pense que|Il est (courant|répandu) de croire que|Contrairement|En réalité|On dit que)\b/i.test(s)) return true;
  return false;
}
function heuristicCE_EN(text) {
  const t = cleanNoise(text);
  const { s1, rest } = splitFirstSentence(t);
  if (looksLikeClaimEN(s1)) return { claim: s1.replace(/^[-–—•]\s*/, ''), explain: clampWords(rest || '', 30) };
  const m = t.match(/^(.+?)\s+(?:but|however|although)\b(.+)$/i);
  if (m) return { claim: trim(m[1]), explain: clampWords(trim(m[2]), 30) };
  return { claim: s1.replace(/^[-–—•]\s*/, ''), explain: clampWords(rest || '', 30) };
}
function heuristicCE_FR(text) {
  const t = cleanNoise(text);
  const { s1, rest } = splitFirstSentence(t);
  if (looksLikeClaimFR(s1)) return { claim: s1.replace(/^[-–—•]\s*/, ''), explain: clampWords(rest || '', 30) };
  const m = t.match(/^(.+?)\s+(?:mais|cependant|pourtant)\b(.+)$/i);
  if (m) return { claim: trim(m[1]), explain: clampWords(trim(m[2]), 30) };
  return { claim: s1.replace(/^[-–—•]\s*/, ''), explain: clampWords(rest || '', 30) };
}

// Extract text blocks (cheerio if available; fallback regex)
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

// Collect EN base
async function collectEN() {
  const buf = [];
  for (const url of PAGES_EN) {
    try {
      const html = await fetchHtml(url, 'en');
      const blocks = await extractBlocks(html, 'en');
      for (const b of blocks) {
        const { claim, explain } = heuristicCE_EN(b);
        const c = trim(claim);
        if (!c || c.length < 8) continue;
        const id = idOf(url, c);
        buf.push({ id, source: url, claim: c, explain: clampWords(explain || '', 30) });
      }
      console.log(`EN: ${url} → ${blocks.length} blocks → kept so far ${buf.length}`);
    } catch (e) {
      console.warn('WARN EN:', e?.message || e);
    }
  }
  const seen = new Set(), uniq = [];
  for (const it of buf) if (!seen.has(it.id)) { seen.add(it.id); uniq.push(it); }
  return uniq;
}

// Collect FR native
async function collectFRnative() {
  const buf = [];
  try {
    const html = await fetchHtml(PAGE_FR, 'fr');
    const blocks = await extractBlocks(html, 'fr');
    for (const b of blocks) {
      const { claim, explain } = heuristicCE_FR(b);
      const c = trim(claim);
      if (!c || c.length < 8) continue;
      const id = idOf(PAGE_FR, c);
      buf.push({ id, source: PAGE_FR, claim: c, explain: clampWords(explain || '', 30) });
    }
    console.log(`FR: ${PAGE_FR} → ${blocks.length} blocks → kept so far ${buf.length}`);
  } catch (e) {
    console.warn('WARN FR:', e?.message || e);
  }
  const seen = new Set(), uniq = [];
  for (const it of buf) if (!seen.has(it.id)) { seen.add(it.id); uniq.push(it); }
  return uniq;
}

// ---------- LLM translate (optional) ----------
async function translatePair(toLang, pair) {
  if (!USE_LLM) return null;
  const map = { fr: 'French', de: 'German', en: 'English' };
  const tgt = map[toLang] || 'French';
  const sys = `Translate to ${tgt}. Keep meaning exact, concise. Return strict JSON {"claim":"…","explain":"…"}; "explain" ≤ 30 words. No extra text.`;
  const user = JSON.stringify({ claim: pair.claim, explain: pair.explain || '' });

  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'content-type':'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [{ role: 'system', content: sys }, { role: 'user', content: user }]
    })
  });
  if (!r.ok) return null;
  const data = await r.json();
  try {
    const raw = data.choices?.[0]?.message?.content || '{}';
    const { claim='', explain='' } = JSON.parse(raw);
    return { claim: trim(claim), explain: clampWords(trim(explain), 30) };
  } catch { return null; }
}

// Little concurrency helper
async function mapLimit(arr, limit, fn) {
  const out = new Array(arr.length);
  let i = 0;
  async function worker() { while (i < arr.length) { const idx = i++; out[idx] = await fn(arr[idx], idx); } }
  const tasks = Array.from({length: Math.min(limit, arr.length)}, worker);
  await Promise.all(tasks);
  return out;
}

// ---------- Build ----------
(async () => {
  // Pools
  const baseEN = await collectEN();
  const baseFR = await collectFRnative();
  console.log(`Base candidates: EN=${baseEN.length}, FR=${baseFR.length}`);

  // Sampled bases (deterministic)
  const takeEN = baseEN.length <= PER ? baseEN : shuffleSeeded([...baseEN]).slice(0, PER);
  const takeFR = baseFR.length <= PER ? baseFR : shuffleSeeded([...baseFR]).slice(0, PER);

  // --- EN target: prefer EN base, then FR→EN translations if needed
  const itemsEN = [];
  itemsEN.push(...takeEN.map(it => ({ id: it.id, lang:'en', claim: it.claim, explain: it.explain, source: it.source })));
  if (itemsEN.length < PER && USE_LLM && takeFR.length) {
    const need = Math.min(PER - itemsEN.length, takeFR.length);
    const add = shuffleSeeded([...takeFR]).slice(0, need);
    const tr = await mapLimit(add, 6, async it => {
      const t = await translatePair('en', { claim: it.claim, explain: it.explain });
      return { id: it.id, lang:'en', claim: t?.claim || it.claim, explain: t?.explain || it.explain, source: it.source };
    });
    itemsEN.push(...tr.filter(Boolean));
  }

  // --- FR target: prefer FR native, then EN→FR
  const itemsFR = [];
  itemsFR.push(...takeFR.map(it => ({ id: it.id, lang:'fr', claim: it.claim, explain: it.explain, source: it.source })));
  if (itemsFR.length < PER) {
    const need = Math.min(PER - itemsFR.length, takeEN.length);
    const add = shuffleSeeded([...takeEN]).slice(0, need);
    if (USE_LLM) {
      const tr = await mapLimit(add, 6, async it => {
        const t = await translatePair('fr', { claim: it.claim, explain: it.explain });
        return { id: it.id, lang:'fr', claim: t?.claim || it.claim, explain: t?.explain || it.explain, source: it.source };
      });
      itemsFR.push(...tr.filter(Boolean));
    } else {
      // fallback no-LLM: copy EN text (compte pour remplir mais non traduit)
      itemsFR.push(...add.map(it => ({ id: it.id, lang:'fr', claim: it.claim, explain: it.explain, source: it.source })));
    }
  }

  // --- DE target: translate EN + FR to DE, then sample to PER
  let poolDE = [];
  if (USE_LLM) {
    const deFromEN = await mapLimit(takeEN, 6, async it => {
      const t = await translatePair('de', { claim: it.claim, explain: it.explain });
      return { id: it.id, lang:'de', claim: t?.claim || it.claim, explain: t?.explain || it.explain, source: it.source };
    });
    const deFromFR = await mapLimit(takeFR, 6, async it => {
      const t = await translatePair('de', { claim: it.claim, explain: it.explain });
      return { id: it.id, lang:'de', claim: t?.claim || it.claim, explain: t?.explain || it.explain, source: it.source };
    });
    poolDE = [...deFromEN, ...deFromFR].filter(Boolean);
  } else {
    poolDE = [...takeEN, ...takeFR].map(it => ({ id: it.id, lang:'de', claim: it.claim, explain: it.explain, source: it.source }));
  }
  const seenDE = new Set(), uniqDE = [];
  for (const it of poolDE) if (!seenDE.has(it.id)) { seenDE.add(it.id); uniqDE.push(it); }
  const itemsDE = uniqDE.length <= PER ? uniqDE : shuffleSeeded([...uniqDE]).slice(0, PER);

  // --- Final cap to PER each (in case of overfill)
  const cap = (arr) => arr.length <= PER ? arr : shuffleSeeded([...arr]).slice(0, PER);
  const finalEN = cap(itemsEN);
  const finalFR = cap(itemsFR);
  const finalDE = cap(itemsDE);

  // Assemble + write
  const dataset = {
    version: 4,
    generatedAt: new Date().toISOString(),
    items: [...finalEN, ...finalFR, ...finalDE]
  };

  const outAbs = path.resolve(process.cwd(), OUT);
  await fs.mkdir(path.dirname(outAbs), { recursive: true });
  await fs.writeFile(outAbs, JSON.stringify(dataset, null, 2), 'utf8');
  console.log(`Wrote ${outAbs} (EN/FR/DE = ${finalEN.length}/${finalFR.length}/${finalDE.length}; target ${PER})`);
})();
