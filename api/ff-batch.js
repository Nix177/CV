// /api/ff-batch.js
// Scrape des pages Wikipédia "idées reçues" (FR/EN/DE) et renvoi de cartes prêtes à afficher.
// - Node runtime (cheerio OK si présent, sinon regex fallback).
// - Renvoie TOUJOURS 200 + JSON (tableau), jamais 500.
// - Sortie normalisée: { id, claim, explain, source }  (explain ≤ ~30 mots).
// - Si OPENAI_API_KEY est défini, on l'utilise **en dernier recours** pour obtenir {claim, explain} propres.
//   Sinon, heuristiques + trimming.

export const config = { runtime: 'nodejs' };

const DEFAULT_COUNT = 24;

const PAGES = {
  fr: [
    'https://fr.wikipedia.org/wiki/Id%C3%A9e_re%C3%A7ue',
    'https://fr.wikipedia.org/wiki/Liste_d%27id%C3%A9es_re%C3%A7ues'
  ],
  en: [
    'https://en.wikipedia.org/wiki/List_of_common_misconceptions'
  ],
  de: [
    'https://de.wikipedia.org/wiki/Liste_von_Irrt%C3%BCmern'
  ],
};

/* ---------------- utils ---------------- */

const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const trim = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const hash = (s) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };
const keyOf = (pageUrl, claim) => hash(`${pageUrl}|${trim(claim).slice(0,160)}`);

const clampWords = (txt, max = 30) => {
  const w = trim(txt).split(/\s+/);
  return w.length <= max ? trim(txt) : w.slice(0, max).join(' ') + '…';
};

const splitFirstSentence = (txt) => {
  const t = trim(txt).replace(/\[\d+\]/g, '');
  const m = t.match(/^(.+?[.!?…])\s+(.+)$/);
  return m ? { s1: trim(m[1]), rest: trim(m[2]) } : { s1: t, rest: '' };
};

const isRefLike = (t) => {
  const s = trim(t);
  if (!s) return true;
  if (/^(↑|→|Voir aussi|Bibliographie)\b/i.test(s)) return true;
  if (/\b(consult[ée] le|PMID|DOI|ISBN|ISSN|Paris:|p\.\s*\d+)\b/i.test(s)) return true;
  if (/^\(|\)$/.test(s) || /^\s*«.+»\s*$/.test(s)) return true;
  if (s.length < 40) return true; // trop court pour une “idée reçue”
  return false;
};

const cleanNoise = (t) => trim(
  String(t)
    .replace(/\[[^\]]*\]/g, ' ')         // [1], [note]
    .replace(/\s*\((?:consulte|PMID|DOI|ISBN|ISSN)[^)]+\)\s*/gi, ' ')
    .replace(/«|»|“|”|„|‟|‚|’/g, '"')
    .replace(/^[↑→]\s*/g, '')
    .replace(/\s+/g, ' ')
);

async function fetchHtml(url, lang) {
  const r = await fetch(url, {
    headers: {
      'user-agent': 'ff-batch/1.0 (educational project)',
      'accept-language':
        lang === 'fr' ? 'fr,en;q=0.9' :
        lang === 'de' ? 'de,en;q=0.9' : 'en;q=0.9'
    }
  });
  if (!r.ok) throw new Error(`HTTP ${r.status} on ${url}`);
  return r.text();
}

async function tryCheerioExtract(html) {
  try {
    const mod = await import('cheerio');
    const cheerio = mod.default || mod;
    const $ = cheerio.load(html);
    const items = [];
    // listes et paragraphes
    $('#mw-content-text li, #mw-content-text p').each((_, el) => {
      const raw = $(el).text();
      const t = cleanNoise(raw);
      if (!isRefLike(t)) items.push(t);
    });
    return items;
  } catch {
    return null;
  }
}

function regexExtract(html) {
  const out = [];
  const re = /<(?:li|p)[^>]*>([\s\S]*?)<\/(?:li|p)>/gi;
  let m;
  while ((m = re.exec(html))) {
    const t = cleanNoise(m[1].replace(/<[^>]+>/g, ' '));
    if (!isRefLike(t)) out.push(t);
  }
  return out;
}

/* ------------ Génération claim/explain -------------- */

function tryHeuristicCE(lang, text) {
  // 1) “Idée reçue : … / Myth: … / Mythos: …”
  const mythLabel = lang === 'fr' ? /(id(é|e)e\s+reçue\s*[:\-]\s*)(.+)/i
                   : lang === 'de' ? /(mythos|irrtum)\s*[:\-]\s*(.+)/i
                   : /(myth|misconception)\s*[:\-]\s*(.+)/i;
  const mLabel = text.match(mythLabel);
  if (mLabel) {
    const claim = trim(mLabel[3] || mLabel[2] || '');
    return { claim, explain: '' };
  }

  // 2) “Contrairement à une idée reçue … / Contrary to popular belief … / Entgegen der landläufigen Meinung …”
  const contrary = lang === 'fr'
    ? /contrairement\s+à\s+une\s+id(é|e)e\s+reçue[, ]+(.+)/i
    : lang === 'de'
      ? /entgegen\s+der\s+landl(ä|a)ufigen\s+meinung[, ]+(.+)/i
      : /contrary\s+to\s+popular\s+belief[, ]+(.+)/i;

  const mContr = text.match(contrary);
  if (mContr) {
    const truth = trim(mContr[2] || mContr[1] || '');
    // Inversion naïve de la négation (assez efficace pour beaucoup de cas simples)
    let claim = truth;
    if (lang === 'fr') {
      claim = claim
        .replace(/\bn[’']?est\b/gi, 'est')
        .replace(/\bn[’']?sont\b/gi, 'sont')
        .replace(/\bne\b\s+([a-zéèêàùîïç]+)\s+\bpas\b/gi, '$1');
    } else if (lang === 'en') {
      claim = claim.replace(/\bis not\b/gi, 'is').replace(/\bare not\b/gi, 'are').replace(/\bnot\b/gi, '');
    } else {
      claim = claim.replace(/\bist nicht\b/gi, 'ist').replace(/\bsind nicht\b/gi, 'sind').replace(/\bnicht\b/gi, '');
    }
    const { s1, rest } = splitFirstSentence(truth);
    const explain = clampWords(rest || truth, 30);
    return { claim: trim(claim), explain };
  }

  // 3) Par défaut: 1re phrase = claim (si elle ressemble à une croyance)
  const { s1, rest } = splitFirstSentence(text);
  return { claim: s1, explain: clampWords(rest || '', 30) };
}

async function llmCE(lang, text) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return null;

    const sys =
      lang === 'fr'
        ? 'Tu extraits une IDÉE REÇUE ("claim") et une RÉFUTATION courte ("explain", ≤30 mots) dans la même langue.'
        : lang === 'de'
          ? 'Extrahiere einen Irrtum als "claim" und eine kurze Widerlegung "explain" (≤30 Wörter) auf Deutsch.'
          : 'Extract a misconception as "claim" and a short refutation "explain" (≤30 words) in the same language.';

    const user =
      (lang === 'fr'
        ? 'À partir de ce texte de Wikipédia, fournis strictement {"claim":"…","explain":"…"}.\nTexte :\n'
        : lang === 'de'
          ? 'Aus diesem Wikipedia-Text, gib strikt {"claim":"…","explain":"…"}.\nText:\n'
          : 'From this Wikipedia text, return strictly {"claim":"…","explain":"…"}. Text:\n') + text;

    const body = {
      model: 'gpt-4o-mini',
      messages: [{ role: 'system', content: sys }, { role: 'user', content: user }],
      temperature: 0.2,
      response_format: { type: 'json_object' }
    };

    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!r.ok) return null;
    const data = await r.json();
    const raw = data.choices?.[0]?.message?.content || '{}';
    const parsed = JSON.parse(raw);
    const claim = trim(parsed.claim || '');
    const explain = clampWords(trim(parsed.explain || ''), 30);
    if (!claim) return null;
    return { claim, explain };
  } catch {
    return null;
  }
}

/* -------------- handler --------------- */

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=3600');

  try {
    const q = getQuery(req);
    const lang = (q.lang || 'fr').slice(0,2).toLowerCase();
    const count = clamp(parseInt(q.count ?? DEFAULT_COUNT, 10) | 0, 1, 60);
    const pages = PAGES[lang] || PAGES.fr;

    let texts = [];
    for (const pageUrl of pages) {
      try {
        const html = await fetchHtml(pageUrl, lang);
        let arr = await tryCheerioExtract(html);
        if (!arr) arr = regexExtract(html);
        // garde de côté l'URL de page
        texts.push(...arr.map(t => ({ pageUrl, text: t })));
      } catch (e) {
        // console.error('ff-batch page error', pageUrl, e?.message || e);
      }
    }

    // Fallback EN si vide
    if (!texts.length && lang !== 'en') {
      for (const pageUrl of PAGES.en) {
        try {
          const html = await fetchHtml(pageUrl, 'en');
          let arr = await tryCheerioExtract(html);
          if (!arr) arr = regexExtract(html);
          texts.push(...arr.map(t => ({ pageUrl, text: t })));
        } catch {}
      }
    }

    // Normalisation -> {id, claim, explain, source}
    const out = [];
    for (const { pageUrl, text } of texts) {
      if (!text || text.length < 40) continue;

      // Heuristique d’abord
      let { claim, explain } = tryHeuristicCE(lang, text);

      // Si le claim ressemble à une citation/biblio → tenter LLM
      if (!claim || /^(«|"|↑|Voir aussi|Bibliographie)/i.test(claim) || /\b(consult[ée] le|PMID|DOI|ISBN)\b/i.test(claim)) {
        const ce = await llmCE(lang, text);
        if (ce) ({ claim, explain } = ce);
      }

      // Dernière protection
      claim = trim(claim).replace(/^[-–—•]\s*/, '');
      if (!claim || claim.length < 10) continue;
      explain = clampWords(explain || text, 30);

      const id = keyOf(pageUrl, claim);
      out.push({ id, claim, explain, source: pageUrl });
    }

    // Dé-doublonnage + mélange
    const seen = new Set();
    const uniq = [];
    for (const it of out) {
      if (!seen.has(it.id)) { seen.add(it.id); uniq.push(it); }
    }
    shuffleInPlace(uniq);
    const picked = uniq.slice(0, count);

    return res.status(200).json(picked);
  } catch (e) {
    // sécurité finale
    return res.status(200).json([]);
  }
}

/* -------------- helpers bas niveau ------------- */

function getQuery(req) {
  if (req.query && typeof req.query === 'object') return req.query;
  try {
    const u = new URL(req.url, 'http://localhost');
    return Object.fromEntries(u.searchParams.entries());
  } catch { return {}; }
}

const shuffleInPlace = (arr) => { for (let i = arr.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };
