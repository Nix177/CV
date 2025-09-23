// /api/ff-batch.js
// Node 18+ (fetch natif). Vercel: functions.runtime nodejs18.x
// ENV requis: OPENAI_API_KEY (sinon fallback), ALLOWED_ORIGINS (optionnel, ex: https://nicolastuor.ch,https://*.vercel.app)

const fs = require('fs');
const path = require('path');

const ALLOWED = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

function cors(req, res) {
  const origin = req.headers.origin || '';
  if (!ALLOWED.length || ALLOWED.some(p => origin.endsWith(p.replace(/^\*\./, '')) || origin === p)) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function ok(res, data) {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}
function bad(res, code, msg) {
  res.statusCode = code || 500;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify({ error: msg || 'error' }));
}

const WIKI_HOST = {
  fr: 'fr.wikipedia.org',
  en: 'en.wikipedia.org',
  de: 'de.wikipedia.org',
};

async function fetchWikipediaRandom(lang = 'fr', count = 9) {
  const host = WIKI_HOST[lang] || WIKI_HOST.fr;
  const url = `https://${host}/w/api.php?action=query&generator=random&grnnamespace=0&prop=extracts|info&inprop=url&explaintext=1&exintro=1&format=json&grnlimit=${Math.min(
    Math.max(+count || 9, 1),
    20
  )}`;
  const r = await fetch(url, { headers: { 'User-Agent': 'nicolastuor-ch/ff-batch' } });
  if (!r.ok) throw new Error('wiki_fetch_failed');
  const j = await r.json();
  const pages = j?.query?.pages ? Object.values(j.query.pages) : [];
  return pages
    .filter(p => p?.title && p?.fullurl)
    .map(p => ({
      title: p.title,
      url: p.fullurl,
      extract: (p.extract || '').replace(/\n+/g, ' ').trim().slice(0, 1200),
    }));
}

async function openaiMythify(items, lang = 'fr') {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const sys = {
    fr: 'Tu es un assistant pédagogique. À partir d’extraits Wikipédia, propose pour chaque sujet un "mythe plausible" (1 phrase) et une réfutation concise (≤ 30 mots), plus une catégorie. Réponds en JSON strict.',
    en: 'You are an educational assistant. From Wikipedia snippets, produce for each topic one plausible myth (1 sentence) and a concise debunk (≤ 30 words), plus a category. Answer strict JSON.',
    de: 'Du bist ein pädagogischer Assistent. Erstelle aus Wikipedia-Auszügen pro Thema einen plausiblen Mythos (1 Satz) und eine knappe Widerlegung (≤ 30 Wörter) sowie eine Kategorie. Antworte als striktes JSON.',
  }[lang] || 'Answer strict JSON.';

  const userPrompt = {
    lang,
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          claim: { type: 'string' },
          explanation: { type: 'string' },
          category: { type: 'string' },
          source: { type: 'string' },
        },
        required: ['title', 'claim', 'explanation', 'category', 'source'],
        additionalProperties: false,
      },
    },
    items: items.map(x => ({ title: x.title, url: x.url, extract: x.extract })),
    constraints: {
      explanationMaxWords: 30,
      claimIsMyth: true,
    },
  };

  const body = {
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: sys },
      { role: 'user', content: JSON.stringify(userPrompt) },
    ],
    temperature: 0.3,
    response_format: { type: 'json_object' },
  };

  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw new Error('openai_failed');
  const data = await resp.json();
  const text = data?.choices?.[0]?.message?.content || '{}';
  let arr;
  try {
    // On autorise soit { ... } soit [ ... ] selon réponse
    const parsed = JSON.parse(text);
    arr = Array.isArray(parsed) ? parsed : parsed?.items || [];
  } catch (e) {
    throw new Error('openai_parse_failed');
  }
  return arr
    .filter(Boolean)
    .map((x, i) => ({
      id: `ai-${Date.now()}-${i}`,
      title: x.title || items[i]?.title || 'Sujet',
      claim: x.claim || 'Idée reçue non fournie',
      explanation: x.explanation || 'Consultez la source pour la réfutation.',
      category: x.category || 'Général',
      sources: [x.source || items[i]?.url].filter(Boolean),
      kind: 'myth',
      lang,
    }));
}

function readFallback() {
  try {
    const p = path.join(process.cwd(), 'public', 'assets', 'facts', 'facts-data.json');
    const raw = fs.readFileSync(p, 'utf8');
    const j = JSON.parse(raw);
    return Array.isArray(j) ? j.slice(0, 9) : [];
  } catch {
    return [];
  }
}

module.exports = async (req, res) => {
  cors(req, res);
  if (req.method === 'OPTIONS') return ok(res, { ok: true });

  if (req.method !== 'GET') return bad(res, 405, 'Method not allowed');

  const url = new URL(req.url, `http://${req.headers.host}`);
  const lang = (url.searchParams.get('lang') || 'fr').toLowerCase();
  const count = Math.min(Math.max(parseInt(url.searchParams.get('count') || '9', 10), 1), 20);

  try {
    const wiki = await fetchWikipediaRandom(lang, count);
    let cards = await openaiMythify(wiki, lang);
    if (!cards || !cards.length) {
      // fallback IA → heuristique rapide
      cards = wiki.slice(0, count).map((w, i) => ({
        id: `wk-${Date.now()}-${i}`,
        title: w.title,
        claim:
          lang === 'fr'
            ? `On croit souvent à tort : « ${w.title} … »`
            : lang === 'de'
            ? `Oft fälschlich angenommen: „${w.title} …“`
            : `Commonly (but wrongly) believed: “${w.title} …”`,
        explanation:
          lang === 'fr'
            ? 'Voir la source pour la réfutation synthétique.'
            : lang === 'de'
            ? 'Siehe Quelle für die knappe Widerlegung.'
            : 'See the source for the brief debunk.',
        category: 'Général',
        sources: [w.url],
        kind: 'myth',
        lang,
      }));
    }
    return ok(res, { items: cards });
  } catch (e) {
    // Fallback fichier local
    const fb = readFallback();
    if (fb.length) return ok(res, { items: fb });
    return bad(res, 500, `ff-batch failed: ${e.message}`);
  }
};
