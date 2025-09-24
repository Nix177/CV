// /api/ff-batch.js
// Robust Wikipedia batch scraper for "misconceptions" lists.
// - Works WITH or WITHOUT 'cheerio' installed (no hard require at module load).
// - Never throws to the client: always returns 200 with an array (possibly empty).
// - Supports ?lang=fr|en|de, ?count=number, ?seen=comma-separated-ids
//
// Next.js (pages/api) — Node runtime.

const DEFAULT_COUNT = 24;

// Misconception list pages per language
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
const hash = (s) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0; }
  return (h >>> 0).toString(36);
};
const keyOf = (txt) => hash(trim(txt).slice(0, 140));

const splitClaimExplain = (txt) => {
  // Heuristic: first sentence = claim, rest = explanation
  const t = trim(txt).replace(/\[\d+\]/g, ''); // remove [1] refs
  const m = t.match(/^(.+?[.!?…])\s+(.+)$/);
  if (m) return { claim: trim(m[1]), explanation: trim(m[2]) };
  return { claim: t, explanation: '' };
};

const ensureHttps = (u) => {
  try {
    const url = new URL(u, 'https://en.wikipedia.org');
    // Keep only wikipedia domains
    if (!/\.wikipedia\.org$/i.test(url.hostname)) return '';
    return url.toString();
  } catch { return ''; }
};

const shuffleInPlace = (arr) => {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

// Minimal <li> text extractor without cheerio (regex-based, best-effort)
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
  // Try dynamic import so absence of cheerio doesn't crash the function
  let cheerio;
  try {
    // Works when cheerio is present in dependencies; otherwise throws
    const mod = await import('cheerio');
    cheerio = mod.default || mod;
  } catch {
    return null; // signal caller to use regex fallback
  }

  try {
    const $ = cheerio.load(html);
    const $content = $('#mw-content-text');
    const items = [];
    $content.find('li').each((i, el) => {
      const $li = $(el);
      let txt = $li.text();
      txt = trim(txt).replace(/\[\d+\]/g, '');
      if (txt && txt.length >= 60) items.push(txt);
    });
    return items;
  } catch {
    return null;
  }
}

async function fetchHtml(url) {
  const r = await fetch(url, {
    headers: { 'user-agent': 'ff-batch/1.0 (educational project)' }
  });
  if (!r.ok) throw new Error(`HTTP ${r.status} on ${url}`);
  return r.text();
}

// ---------- handler ----------
module.exports = async function handler(req, res) {
  // Set CORS + cache headers early; we'll always end with 200
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=3600');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  try {
    const urlObj = new URL(req.url, 'http://localhost'); // base won't be used
    const lang = (urlObj.searchParams.get('lang') || 'fr').toLowerCase();
    const count = clamp(parseInt(urlObj.searchParams.get('count') || DEFAULT_COUNT, 10) | 0, 1, 60);
    const seenParam = trim(urlObj.searchParams.get('seen') || '');
    const seen = new Set(seenParam ? seenParam.split(',').map(s => s.trim()).filter(Boolean) : []);

    const pages = PAGES[lang] || PAGES.fr;

    let candidates = [];
    for (const pageUrl of pages) {
      try {
        const html = await fetchHtml(pageUrl);
        // Try cheerio first for accuracy; fallback to regex
        let texts = await tryCheerioExtract(html);
        if (!texts) texts = extractListItemsByRegex(html);

        // Turn into normalized items
        const items = texts.map(t => {
          const { claim, explanation } = splitClaimExplain(t);
          const id = keyOf(t);
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
        // Ignore this page and continue with others
        // console.error('ff-batch page error', pageUrl, e);
      }
    }

    // If FR yielded nothing, fallback to EN list
    if (!candidates.length && lang === 'fr') {
      for (const pageUrl of PAGES.en) {
        try {
          const html = await fetchHtml(pageUrl);
          let texts = await tryCheerioExtract(html);
          if (!texts) texts = extractListItemsByRegex(html);
          const items = texts.map(t => {
            const { claim, explanation } = splitClaimExplain(t);
            const id = keyOf(t);
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
        } catch {}
      }
    }

    // De-dupe by id
    const uniq = [];
    const seenIds = new Set();
    for (const it of candidates) {
      if (!seenIds.has(it.id)) { seenIds.add(it.id); uniq.push(it); }
    }

    // Exclude 'seen' from query
    const fresh = uniq.filter(it => !seen.has(it.id));

    // Shuffle & pick
    shuffleInPlace(fresh);
    const out = fresh.slice(0, count);

    res.status(200).end(JSON.stringify(out));
  } catch (err) {
    // Final safety: never leak 500 to client
    // Return an empty array so client can fallback to /api/facts
    res.status(200).end('[]');
  }
};
