// api/facts/index.js
// Vercel serverless — fabrique des cartes "mythe / explication" propres à partir de Wiki + OpenAI.
// Paramètres : ?lang=fr|en|de&n=9

export const config = { runtime: 'edge' }; // évite les soucis de "Function Runtimes must have a valid version"

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// 👉 Ajuste cette URL si besoin : c’est la liste de repli (ton dépôt GitHub).
// Format attendu : { "items": [ { "myth": "...", "source": "https://xx.wikipedia.org/wiki/..." }, ... ] }
// Seul "source" est indispensable ; "myth" brut peut être vide, on reformule avec l'IA.
const FALLBACK_JSON_URL =
  'https://raw.githubusercontent.com/Nix177/CV/main/public/assets/data/facts-data.json';

const MAX_WORDS = 30;
const MODEL = 'gpt-4o-mini'; // léger, rapide, pas cher

const HEADERS_JSON = { 'content-type': 'application/json; charset=utf-8' };

// -------- Utils
const clean = (s = '') =>
  s
    .replace(/\s*https?:\/\/\S+/g, '')  // vire les URLs
    .replace(/^[\s•*\-–—↑>]+/g, '')     // décore et flèches
    .replace(/\s{2,}/g, ' ')
    .trim();

const pickRandom = (arr, n) => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
};

function langFromUrl(u) {
  try {
    const { hostname } = new URL(u);
    const m = hostname.match(/^([a-z]{2})\.wikipedia\.org$/i);
    return m ? m[1].toLowerCase() : null;
  } catch {
    return null;
  }
}

function wikiTitleFromUrl(u) {
  try {
    const { pathname } = new URL(u);
    const m = pathname.match(/\/wiki\/(.+)$/);
    return m ? decodeURIComponent(m[1]) : null;
  } catch {
    return null;
  }
}

// Extrait court depuis l’API Summary de Wikipedia
async function fetchWikiSummary(sourceUrl) {
  const L = langFromUrl(sourceUrl) || 'en';
  const title = wikiTitleFromUrl(sourceUrl);
  if (!title) return null;

  const url = `https://${L}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
  const r = await fetch(url, { headers: { accept: 'application/json' } });
  if (!r.ok) return null;
  const j = await r.json();
  // `extract` :  résumé en texte clair
  return j?.extract || null;
}

// Appel OpenAI : reformule un MYTHE clair (phrase courte) + réponse explicative ≤ 30 mots, dans la langue demandée
async function rewriteWithAI({ lang, rawClaim, wikiExtract, source }) {
  if (!OPENAI_API_KEY) return null;

  const sys = `Tu écris dans la langue "${lang}". 
Tu es un pédagogue. 
À partir de l'extrait Wikipedia fourni, produis un mythe court (phrase unique) ET une réponse explicative synthétique (<= ${MAX_WORDS} mots), factuelle. 
Renvoie STRICTEMENT un objet JSON : {"myth":"...","explain":"..."} (aucun texte en dehors du JSON).`;

  const user = `LANG=${lang}
SOURCE=${source}
RAW_CLAIM:
${rawClaim || '(non fourni)'}
WIKIPEDIA_EXTRACT:
${wikiExtract || '(absent)'}
`;

  const body = {
    model: MODEL,
    temperature: 0.2,
    messages: [
      { role: 'system', content: sys },
      { role: 'user', content: user }
    ]
  };

  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!resp.ok) {
    // console.warn('[facts] OpenAI non OK', await resp.text());
    return null;
  }
  const data = await resp.json();
  const text = data?.choices?.[0]?.message?.content || '';

  // Essaie de parser un JSON strict ; si l’IA renvoie du texte autour, on tente de récupérer l’objet.
  let obj = null;
  try {
    obj = JSON.parse(text);
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) {
      try { obj = JSON.parse(m[0]); } catch {}
    }
  }
  if (!obj || typeof obj !== 'object') return null;

  let myth = clean(obj.myth || rawClaim || '');
  let explain = clean(obj.explain || '');

  // Coupe dur à MAX_WORDS si besoin
  if (explain) {
    const words = explain.split(/\s+/).filter(Boolean);
    if (words.length > MAX_WORDS) explain = words.slice(0, MAX_WORDS).join(' ') + '…';
  }

  return { myth, explain, source };
}

// Fallback si l’IA est indispo : prend la première(s) phrase(s) de l’extrait wiki
function fallbackFromExtract({ lang, rawClaim, wikiExtract, source }) {
  let myth = clean(rawClaim || '');
  if (!myth) {
    // petite reformulation minimale par défaut
    myth = lang === 'fr'
      ? "Idée reçue courante."
      : lang === 'de'
      ? "Weitverbreiteter Irrglaube."
      : "Common misconception.";
  }
  let explain = '';
  if (wikiExtract) {
    // on garde ~30 mots max
    const words = clean(wikiExtract).split(/\s+/).filter(Boolean);
    explain = words.slice(0, MAX_WORDS).join(' ') + (words.length > MAX_WORDS ? '…' : '');
  } else {
    explain = lang === 'fr'
      ? "Consultez la source pour une explication fiable."
      : lang === 'de'
      ? "Siehe Quelle für eine verlässliche Erklärung."
      : "See the source for a reliable explanation.";
  }
  return { myth, explain, source };
}

// -------- Handler
export default async function handler(req) {
  try {
    const { searchParams } = new URL(req.url);
    const lang = (searchParams.get('lang') || 'fr').toLowerCase();
    const n = Math.min(Math.max(parseInt(searchParams.get('n') || '9', 10) || 9, 1), 20);

    // 1) Récupère la liste fallback (publique)
    let pool = [];
    try {
      const r = await fetch(FALLBACK_JSON_URL, { headers: { accept: 'application/json' } });
      if (r.ok) {
        const j = await r.json();
        pool = Array.isArray(j) ? j : Array.isArray(j?.items) ? j.items : [];
      }
    } catch {}

    // Filtre : il faut une source (wiki de préférence)
    pool = pool.filter(it => it?.source && /wikipedia\.org\/wiki\//i.test(it.source));
    if (pool.length === 0) {
      return new Response(JSON.stringify({ items: [] }), { status: 200, headers: HEADERS_JSON });
    }

    const chosen = pickRandom(pool, n);

    // 2) Pour chaque item : récupère l’extrait wiki puis reformule avec OpenAI (sinon fallback)
    const tasks = chosen.map(async (raw) => {
      const source = raw.source;
      const rawClaim = clean(raw.myth || raw.claim || raw.title || '');
      const wikiExtract = await fetchWikiSummary(source);

      // Tente l'IA
      let built = null;
      try {
        built = await rewriteWithAI({ lang, rawClaim, wikiExtract, source });
      } catch {}
      if (!built) {
        built = fallbackFromExtract({ lang, rawClaim, wikiExtract, source });
      }
      return built;
    });

    // on limite la casse si certains échouent
    const settled = await Promise.allSettled(tasks);
    const items = settled
      .filter(s => s.status === 'fulfilled' && s.value)
      .map(s => s.value);

    return new Response(JSON.stringify({ items }), { status: 200, headers: HEADERS_JSON });
  } catch (err) {
    // console.error('[facts] fatal', err);
    return new Response(JSON.stringify({ items: [], error: 'internal_error' }), {
      status: 200,
      headers: HEADERS_JSON
    });
  }
}
