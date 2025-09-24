// /api/ff-batch.js
// Next.js API route — Node runtime forced (works on Vercel).
// Scrapes Wikipedia "misconceptions" lists and returns normalized items.
// Always replies 200 (empty array on failure). Minimal + robust.

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

// ---------- utils ----------
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const trim = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const hash = (s) => { let h=0; for (let i=0;i<s.length;i++) h=(h*31 + s.charCodeAt(i))|0; return (h>>>0).toString(36); };
const keyOf = (txt) => hash(trim(txt).slice(0, 140));
const splitClaimExplain = (txt) => {
  const t = trim(txt).replace(/\[\d+\]/g, '');
  const m = t.match(/^(.+?[.!?…])\s+(.+)$/);
  if (m) return { claim: trim(m[1]), explanation: trim(m[2]) };
  return { claim: t, explanation: '' };
};
const shuffleInPlace = (arr) => { for (let i=arr.length-1;i>0;i--){ const j=(Math.random()*(i+1))|0; [arr[i],arr[j]]=[arr[j],arr[i]]; } return arr; };

function extractListItemsByRegex(html) {
  const items = [];
  const re = /<li[^>]*>([\s\S]*?)<\/li>/gi;
  let m;
  while ((m = re.exec(html))) {
    let block = m[1]
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<sup[\s\S]*?<\/sup>/gi, ' ')
      .replace(/<[^>]+>/g, ' ');
    block = trim(block);
    if (block && block.length >= 60) items.push(block);
  }
  return items;
}

async function tryCheerioExtract(html) {
  let cheerio;
  try {
    const mod = await import('cheerio'); // ok si installé, sinon throw
    cheerio = mod.default || mod;
  } catch { return null; }

  try {
    const $ = cheerio.load(html);
    const items = [];
    $('#mw-content-text').find('li').each((_, el) => {
      let txt = $(el).text();
      txt = trim(txt).replace(/\[\d+\]/g, '');
      if (txt && txt.length >= 60) items.push(txt);
    });
    return items;
  } catch { return null; }
}

async function fetchHtml(url, lang) {
  const r = await fetch(url, {
    headers: {
      'user-agent': 'ff-batch/1.0 (educational project)',
      'accept-language': lang === 'fr' ? 'fr,en;q=0.9' : lang === 'de' ? 'de,en;q=0.9' : 'en;q=0.9'
    }
  });
  if (!r.ok) throw new Error(`HTTP ${r.status} on ${url}`);
  return r.text();
}

function getQuery(req) {
  if (req.query && typeof req.query === 'object') return req.query; // pages/api
  try {
    const u = new URL(req.url, 'http://localhost');
    return Object.fromEntries(u.searchParams.entries());
  } catch { return {}; }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=3600');

  try {
    const q = getQuery(req);
    const lang = (q.lang || 'fr').toLowerCase();
    const count = clamp(parseInt(q.count ?? DEFAULT_COUNT, 10) | 0, 1, 60);

    // NB: on tolère 'seen', mais on n’en dépend pas pour la stabilité
    const seenParam = trim(q.seen || '');
    const seen = new Set(seenParam ? seenParam.split(',').map(s => s.trim()).filter(Boolean) : []);

    const pages = PAGES[lang] || PAGES.fr;

    let candidates = [];
    for (const pageUrl of pages) {
      try {
        const html = await fetchHtml(pageUrl, lang);
        let texts = await tryCheerioExtract(html);
        if (!texts) texts = extractListItemsByRegex(html);

        const items = texts.map((t) => {
          const { claim, explanation } = splitClaimExplain(t);
          const id = keyOf(pageUrl + '|' + t);
          return {
            id,
            type: 'myth',
            title: claim,
            explanation,
            explainShort: explanation ? explanation.split(/\s+/).slice(0, 28).join(' ') : '',
            sources: [{ title: 'Wikipedia', url: pageUrl }]
          };
        });

        candidates.push(...items);
      } catch (e) {
        console.error('ff-batch: page error', pageUrl, e?.message || e);
      }
    }

    // Fallback EN si rien trouvé (ex: pages FR changeantes)
    if (!candidates.length && lang !== 'en') {
      for (const pageUrl of PAGES.en) {
        try {
          const html = await fetchHtml(pageUrl, 'en');
          let texts = await tryCheerioExtract(html);
          if (!texts) texts = extractListItemsByRegex(html);
          const items = texts.map((t) => {
            const { claim, explanation } = splitClaimExplain(t);
            const id = keyOf(pageUrl + '|' + t);
            return {
              id, type: 'myth', title: claim, explanation,
              explainShort: explanation ? explanation.split(/\s+/).slice(0, 28).join(' ') : '',
              sources: [{ title: 'Wikipedia', url: pageUrl }]
            };
          });
          candidates.push(...items);
        } catch (e) {
          console.error('ff-batch: EN fallback error', pageUrl, e?.message || e);
        }
      }
    }

    // Dédoublonnage
    const byId = new Map();
    for (const it of candidates) if (!byId.has(it.id)) byId.set(it.id, it);
    let fresh = [...byId.values()];

    // Exclusion 'seen' (si jamais ça matche)
    if (seen.size) fresh = fresh.filter(it => !seen.has(it.id));

    shuffleInPlace(fresh);
    const out = fresh.slice(0, count);

    return res.status(200).json(out);
  } catch (e) {
    console.error('ff-batch: fatal', e?.stack || e?.message || e);
    return res.status(200).json([]); // jamais 500
  }
}
