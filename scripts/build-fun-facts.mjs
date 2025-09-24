// scripts/build-fun-facts.mjs
// Usage:
//   node scripts/build-fun-facts.mjs --out=public/ff-dataset.json
//   OPENAI_API_KEY=sk-... node scripts/build-fun-facts.mjs --out=public/ff-dataset.json
//
// Génère un dataset statique { id, lang, claim, explain, source }.
// Base = 3 pages anglaises (arts&culture, history, science/tech/math), traduites en FR & DE (via OpenAI si dispo).
// On ajoute en bonus la page FR native telle quelle (pas traduite), pour enrichir la langue FR.
// Les liens sources restent inchangés (toujours l’URL Wikipedia d’origine).

import fs from 'node:fs/promises';
import path from 'node:path';

// ----------------- Config entrées/sorties -----------------
const ARGS = Object.fromEntries(process.argv.slice(2).map(kv => {
  const [k, v] = kv.replace(/^--/, '').split('=');
  return [k, v ?? true];
}));
const OUT = ARGS.out || 'public/ff-dataset.json';

// Pages imposées
const PAGES_EN = [
  'https://en.wikipedia.org/wiki/List_of_common_misconceptions_about_arts_and_culture',
  'https://en.wikipedia.org/wiki/List_of_common_misconceptions_about_history',
  'https://en.wikipedia.org/wiki/List_of_common_misconceptions_about_science,_technology,_and_mathematics',
];

const PAGE_FR = 'https://fr.wikipedia.org/wiki/Liste_d%27id%C3%A9es_re%C3%A7ues';

// ----------------- Utils génériques -----------------
const trim = s => String(s || '').replace(/\s+/g, ' ').trim();
const clampWords = (txt, max=30) => {
  const w = trim(txt).split(/\s+/);
  return w.length <= max ? trim(txt) : w.slice(0, max).join(' ') + '…';
};
const hash = (s) => { let h=0; for (let i=0;i<s.length;i++) h=(h*31+s.charCodeAt(i))|0; return (h>>>0).toString(36); };
const keyOf = (u, c) => hash(`${u}|${trim(c).slice(0,160)}`);

async function fetchHtml(url, langHint='en') {
  const r = await fetch(url, {
    headers: {
      'user-agent': 'ff-build/1.2 (dataset generator)',
      'accept-language': langHint === 'fr' ? 'fr,en;q=0.9' : langHint === 'de' ? 'de,en;q=0.9' : 'en;q=0.9'
    }
  });
  if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`);
  return r.text();
}

// Extraction HTML -> candidats (texte)
// (cheerio si dispo, sinon regex)
async function extractTexts(html, lang) {
  try {
    const mod = await import('cheerio');
    const cheerio = mod.default || mod;
    const $ = cheerio.load(html);
    const arr = [];
    $('#mw-content-text li, #mw-content-text p').each((_, el) => {
      const t = cleanNoise($(el).text());
      if (!isRefLike(t, lang)) arr.push(t);
    });
    return arr;
  } catch {
    const out = [];
    const re = /<(?:li|p)[^>]*>([\s\S]*?)<\/(?:li|p)>/gi;
    let m;
    while ((m = re.exec(html))) {
      const t = cleanNoise(m[1].replace(/<[^>]+>/g, ' '));
      if (!isRefLike(t, lang)) out.push(t);
    }
    return out;
  }
}

// Nettoyage + filtres anti-biblio
const MONTHS_FR = 'janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre';
function isRefLike(t, lang='en') {
  const s = trim(t);
  if (!s) return true;
  if (/^(↑|→|Voir aussi|Bibliographie|Notes? et r(é|e)f(é|e)rences?)\b/i.test(s)) return true;
  if (/\b(consult[ée] le|PMID|DOI|ISBN|ISSN|Paris:|p\.\s*\d+|op\. cit\.)\b/i.test(s)) return true;
  if (new RegExp(`\\b(?:${MONTHS_FR})\\b`, 'i').test(s) && /\b20\d{2}\b/.test(s) && /\b(sur|dans)\b/i.test(s)) return true;
  if (/^«|^".+?"\s*(,|—|-)/.test(s)) return true;
  if (/^\s*[A-ZÉÈÀÂÎÔÛÄÖÜ][^,]{2,},\s/.test(s)) return true; // Nom, ...
  if (s.length < 40) return true;
  return false;
}
const cleanNoise = (t) => trim(String(t)
  .replace(/\[[^\]]*\]/g, ' ')
  .replace(/\s*\((?:consult[ée] le|PMID|DOI|ISBN|ISSN)[^)]+\)\s*/gi, ' ')
  .replace(/[«»“”„‟‚’]/g, '"')
  .replace(/^[↑→]\s*/, '')
);

// “a. b. c.” → 2 morceaux (claim, reste)
function splitFirstSentence(txt) {
  const t = trim(txt).replace(/\[\d+\]/g, '');
  const m = t.match(/^(.+?[.!?…])\s+(.+)$/);
  return m ? { s1: trim(m[1]), rest: trim(m[2]) } : { s1: t, rest: '' };
}

// Est-ce que la 1re phrase ressemble à une croyance ?
function looksLikeClaim(lang, s) {
  s = trim(s);
  const tests = {
    fr: /^(Les|La|Le|Un|Une|On|Il|Elle|L’|L'|Beaucoup|Certains|Souvent|On pense que|Il est (courant|répandu) de croire que|Contrairement|En réalité|On dit que)\b/i,
    en: /^(Many|People|Some|It|They|The|A|An|Contrary|In fact|It is (often|commonly) believed)\b/i,
    de: /^(Viele|Man|Es|Die|Der|Das|Ein|Eine|Entgegen|Tatsächlich|Es wird (oft|häufig) angenommen)\b/i,
  };
  const bad = /^(Voir aussi|Bibliographie|Notes? et r(é|e)f(é|e)rences?)\b/i;
  return !bad.test(s) && (tests[lang] || tests.en).test(s);
}

// Heuristique EN/FR: claim + explain
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

// ----------------- OpenAI (optionnel) -----------------
async function translatePairWithLLM(fromLang, toLang, pair) {
  // pair = { claim, explain }
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const names = { en:'EN', fr:'FR', de:'DE' };
  const to = names[toLang] || 'EN';
  const sys =
    `Translate strictly to ${to}. Keep meaning, be concise. Return JSON {"claim":"…","explain":"…"}; "explain" must be ≤30 words. No commentary.`;
  const user = JSON.stringify(pair);

  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: user }
      ]
    })
  });
  if (!r.ok) return null;
  const data = await r.json();
  const raw = data.choices?.[0]?.message?.content || '{}';
  try {
    const { claim='', explain='' } = JSON.parse(raw);
    return { claim: trim(claim), explain: clampWords(trim(explain), 30) };
  } catch { return null; }
}

// ----------------- Collecte EN (base) -----------------
async function collectFromEnglish() {
  const out = [];
  for (const url of PAGES_EN) {
    try {
      const html = await fetchHtml(url, 'en');
      const texts = await extractTexts(html, 'en');
      for (const t of texts) {
        const { claim, explain } = heuristicCE('en', t);
        const claimOk = trim(claim).replace(/^[-–—•]\s*/, '');
        if (!claimOk || claimOk.length < 10) continue;
        out.push({ id: keyOf(url, claimOk), source: url, claim: claimOk, explain: clampWords(explain || '', 30) });
      }
    } catch (e) {
      console.warn('WARN en:', e?.message || e);
    }
  }
  // de-dup by id
  const seen = new Set(), base = [];
  for (const it of out) if (!seen.has(it.id)) { seen.add(it.id); base.push(it); }
  return base;
}

// ----------------- Collecte FR native (bonus FR) -----------------
async function collectFromFrenchNative() {
  const out = [];
  try {
    const html = await fetchHtml(PAGE_FR, 'fr');
    const texts = await extractTexts(html, 'fr');
    for (const t of texts) {
      const { claim, explain } = heuristicCE('fr', t);
      const claimOk = trim(claim).replace(/^[-–—•]\s*/, '');
      if (!claimOk || claimOk.length < 10) continue;
      out.push({ id: keyOf(PAGE_FR, claimOk), lang: 'fr', claim: claimOk, explain: clampWords(explain || '', 30), source: PAGE_FR });
    }
  } catch (e) {
    console.warn('WARN fr-native:', e?.message || e);
  }
  // de-dup by id
  const seen = new Set(), base = [];
  for (const it of out) if (!seen.has(it.id)) { seen.add(it.id); base.push(it); }
  return base;
}

// ----------------- Build -----------------
(async () => {
  // 1) Base anglaise
  const baseEN = await collectFromEnglish(); // [{id, source, claim, explain}]
  console.log(`Base EN: ${baseEN.length} items`);

  // 2) Traductions FR & DE depuis la base EN (si pas d’API, on copiera EN → FR/DE pour ne pas bloquer)
  const itemsEN = baseEN.map(it => ({ id: it.id, lang: 'en', claim: it.claim, explain: it.explain, source: it.source }));
  const itemsFR = [];
  const itemsDE = [];

  const useLLM = !!process.env.OPENAI_API_KEY;
  for (const it of baseEN) {
    if (useLLM) {
      const fr = await translatePairWithLLM('en', 'fr', { claim: it.claim, explain: it.explain || '' });
      const de = await translatePairWithLLM('en', 'de', { claim: it.claim, explain: it.explain || '' });
      itemsFR.push({ id: it.id, lang: 'fr', claim: fr?.claim || it.claim, explain: fr?.explain || it.explain, source: it.source });
      itemsDE.push({ id: it.id, lang: 'de', claim: de?.claim || it.claim, explain: de?.explain || it.explain, source: it.source });
    } else {
      // Fallback sans LLM : on garde EN (au moins on a des données)
      itemsFR.push({ id: it.id, lang: 'fr', claim: it.claim, explain: it.explain, source: it.source });
      itemsDE.push({ id: it.id, lang: 'de', claim: it.claim, explain: it.explain, source: it.source });
    }
  }

  // 3) Bonus FR natif (conserve l’URL FR)
  const frNative = await collectFromFrenchNative(); // déjà {lang:'fr', ...}

  // 4) Assemble et dé-duplique par (lang,id)
  const merged = [...itemsEN, ...itemsFR, ...itemsDE, ...frNative];
  const key = (it) => `${it.lang}|${it.id}`;
  const seen = new Set(), final = [];
  for (const it of merged) {
    if (!it.claim || it.claim.length < 6) continue;
    const k = key(it);
    if (!seen.has(k)) { seen.add(k); final.push(it); }
  }

  // 5) Écriture
  const dataset = { version: 2, generatedAt: new Date().toISOString(), items: final };
  const outAbs = path.resolve(process.cwd(), OUT);
  await fs.mkdir(path.dirname(outAbs), { recursive: true });
  await fs.writeFile(outAbs, JSON.stringify(dataset, null, 2), 'utf8');
  console.log(`Wrote ${outAbs} (${dataset.items.length} items)`);
})();
