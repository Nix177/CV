// scripts/build-fun-facts.mjs
// Usage: node scripts/build-fun-facts.mjs --langs=fr,en,de --out=public/ff-dataset.json
// Fait un "one-shot": télécharge les pages Wikipédia et crée un dataset propre {id,lang,claim,explain,source}

import fs from 'node:fs/promises';

const ARGS = Object.fromEntries(process.argv.slice(2).map(kv => {
  const [k, v] = kv.replace(/^--/, '').split('=');
  return [k, v ?? true];
}));
const OUT = ARGS.out || 'public/ff-dataset.json';
const LANGS = (ARGS.langs || 'fr,en,de').split(',').map(s => s.trim());

const PAGES = {
  fr: ['https://fr.wikipedia.org/wiki/Liste_d%27id%C3%A9es_re%C3%A7ues'],
  en: ['https://en.wikipedia.org/wiki/List_of_common_misconceptions'],
  de: ['https://de.wikipedia.org/wiki/Liste_von_Irrt%C3%BCmern'],
};

const trim = s => String(s || '').replace(/\s+/g,' ').trim();
const clampWords = (txt, max=30) => {
  const w = trim(txt).split(/\s+/);
  return w.length <= max ? trim(txt) : w.slice(0,max).join(' ') + '…';
};
const hash = (s) => { let h=0; for (let i=0;i<s.length;i++) h=(h*31+s.charCodeAt(i))|0; return (h>>>0).toString(36); };
const keyOf = (u, c) => hash(`${u}|${trim(c).slice(0,160)}`);

const MONTHS_FR = 'janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre';
const isRefLike = (t) => {
  const s = trim(t);
  if (!s) return true;
  if (/^(↑|→|Voir aussi|Bibliographie|Notes? et r(é|e)f(é|e)rences?)\b/i.test(s)) return true;
  if (/\b(consult[ée] le|PMID|DOI|ISBN|ISSN|Paris:|p\.\s*\d+|op\. cit\.)\b/i.test(s)) return true;
  if (new RegExp(`\\b(?:${MONTHS_FR})\\b`, 'i').test(s) && /\b20\d{2}\b/.test(s) && /\b(sur|dans)\b/i.test(s)) return true;
  if (/^«|^".+?"\s*(,|—|-)/.test(s)) return true;
  if (/^\s*[A-ZÉÈÀÂÎÔÛÄÖÜ][^,]{2,},\s/.test(s)) return true;
  if (s.length < 40) return true;
  return false;
};
const cleanNoise = (t) => trim(String(t)
  .replace(/\[[^\]]*\]/g,' ')
  .replace(/\s*\((?:consult[ée] le|PMID|DOI|ISBN|ISSN)[^)]+\)\s*/gi,' ')
  .replace(/[«»“”„‟‚’]/g,'"')
  .replace(/^[↑→]\s*/,'')
);

async function fetchHtml(url, lang) {
  const r = await fetch(url, {
    headers: {
      'user-agent': 'ff-build/1.0 (dataset generator)',
      'accept-language': lang === 'fr' ? 'fr,en;q=0.9' : lang === 'de' ? 'de,en;q=0.9' : 'en;q=0.9'
    }
  });
  if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`);
  return r.text();
}

async function extractTexts(html) {
  let cheerio;
  try {
    const mod = await import('cheerio');
    cheerio = mod.default || mod;
  } catch {}
  if (cheerio) {
    const $ = cheerio.load(html);
    const arr = [];
    $('#mw-content-text li, #mw-content-text p').each((_, el) => {
      const t = cleanNoise($(el).text());
      if (!isRefLike(t)) arr.push(t);
    });
    return arr;
  }
  // regex fallback
  const out = [];
  const re = /<(?:li|p)[^>]*>([\s\S]*?)<\/(?:li|p)>/gi;
  let m;
  while ((m = re.exec(html))) {
    const t = cleanNoise(m[1].replace(/<[^>]+>/g,' '));
    if (!isRefLike(t)) out.push(t);
  }
  return out;
}

function looksLikeClaim(lang, s) {
  s = trim(s);
  const tests = {
    fr: /^(Les|La|Le|Un|Une|On|Il|Elle|L’|L'|Beaucoup|Certains|Souvent|On pense que|Il est (courant|répandu) de croire que|Contrairement|En réalité|On dit que)\b/i,
    en: /^(Many|People|Some|It|They|The|A|An|Contrary|In fact|It is (often|commonly) believed)\b/i,
    de: /^(Viele|Man|Es|Die|Der|Das|Ein|Eine|Entgegen|Tatsächlich|Es wird (oft|häufig) angenommen)\b/i,
  };
  const bad = /^(Voir aussi|Bibliographie|Notes? et r(é|e)f(é|e)rences?)\b/i;
  return !bad.test(s) && (tests[lang] || tests.fr).test(s);
}

function splitFirstSentence(txt) {
  const t = trim(txt).replace(/\[\d+\]/g,'');
  const m = t.match(/^(.+?[.!?…])\s+(.+)$/);
  return m ? { s1: trim(m[1]), rest: trim(m[2]) } : { s1: t, rest: '' };
}

function heuristicCE(lang, text) {
  const mythLabel = lang === 'fr' ? /(id(é|e)e\s+reçue\s*[:\-]\s*)(.+)/i
                  : lang === 'de' ? /(mythos|irrtum)\s*[:\-]\s*(.+)/i
                  : /(myth|misconception)\s*[:\-]\s*(.+)/i;
  const ml = text.match(mythLabel);
  if (ml) return { claim: trim(ml[3] || ml[2] || ''), explain: '' };

  const contrary = lang === 'fr'
    ? /contrairement\s+à\s+une\s+id(é|e)e\s+reçue[, ]+(.+)/i
    : lang === 'de'
      ? /entgegen\s+der\s+landl(ä|a)ufigen\s+meinung[, ]+(.+)/i
      : /contrary\s+to\s+popular\s+belief[, ]+(.+)/i;
  const mc = text.match(contrary);
  if (mc) {
    const truth = trim(mc[2] || mc[1] || '');
    const { s1, rest } = splitFirstSentence(truth);
    return { claim: truth, explain: clampWords(rest || truth, 30) };
  }

  const { s1, rest } = splitFirstSentence(text);
  if (looksLikeClaim(lang, s1)) return { claim: s1, explain: clampWords(rest || '', 30) };
  return { claim: '', explain: '' };
}

async function llmCE(lang, text) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return null;
    const sys = lang === 'fr'
      ? 'Tu extraits une id\u00E9e re\u00E7ue ("claim") et une r\u00E9futation courte ("explain", ≤30 mots) en FR.'
      : lang === 'de'
        ? 'Extrahiere einen Irrtum ("claim") und eine kurze Widerlegung ("explain", ≤30 W\u00F6rter) auf Deutsch.'
        : 'Extract a misconception as "claim" and a short refutation "explain" (≤30 words) in EN.';
    const user = (lang === 'fr'
      ? 'Du texte Wikip\u00E9dia ci-dessous, retourne strictement {"claim":"…","explain":"…"} en FR.\nTexte:\n'
      : lang === 'de'
        ? 'Aus dem Wikipedia-Text unten, gib strikt {"claim":"…","explain":"…"} auf DE.\nText:\n'
        : 'From the Wikipedia text below, return strictly {"claim":"…","explain":"…"} in EN.\nText:\n') + text;

    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey}`, 'content-type':'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role:'system', content:sys }, { role:'user', content:user }],
        temperature: 0.2,
        response_format: { type:'json_object' }
      })
    });
    if (!r.ok) return null;
    const data = await r.json();
    const raw = data.choices?.[0]?.message?.content || '{}';
    const { claim='', explain='' } = JSON.parse(raw);
    if (!claim) return null;
    return { claim: trim(claim), explain: clampWords(trim(explain), 30) };
  } catch {
    return null;
  }
}

async function collectForLang(lang) {
  const pages = PAGES[lang] || [];
  const items = [];
  for (const url of pages) {
    const html = await fetchHtml(url, lang);
    const texts = await extractTexts(html);
    for (const t of texts) {
      const base = heuristicCE(lang, t);
      let claim = base.claim;
      let explain = base.explain;
      if (!claim || !looksLikeClaim(lang, claim)) {
        const ce = await llmCE(lang, t);
        if (ce) { claim = ce.claim; explain = ce.explain; }
      }
      claim = trim(claim).replace(/^[-–—•]\s*/, '');
      if (!claim || claim.length < 10) continue;
      items.push({ id: keyOf(url, claim), lang, claim, explain, source: url });
    }
  }
  // dedup by id
  const seen = new Set();
  const uniq = [];
  for (const it of items) if (!seen.has(it.id)) { seen.add(it.id); uniq.push(it); }
  return uniq;
}

(async () => {
  const all = [];
  for (const lang of LANGS) {
    try {
      const arr = await collectForLang(lang);
      all.push(...arr);
      console.log(`OK ${lang}: ${arr.length} items`);
    } catch (e) {
      console.warn(`WARN ${lang}:`, e?.message || e);
    }
  }
  const dataset = {
    version: 1,
    generatedAt: new Date().toISOString(),
    items: all
  };
  await fs.mkdir(new URL(`file://${process.cwd()}/${OUT}`).pathname.replace(/\/[^/]+$/, ''), { recursive: true });
  await fs.writeFile(OUT, JSON.stringify(dataset, null, 2), 'utf8');
  console.log(`Wrote ${OUT} (${dataset.items.length} items)`);
})();
