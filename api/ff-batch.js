// /api/ff-batch.js — dataset statique + seed + "seen" (hash courts)
// Vercel Node runtime (cheerio inutile ici, on lit le dataset préparé).
export const config = { runtime: 'nodejs' };

import fs from 'node:fs/promises';
import path from 'node:path';
import url from 'node:url';

const DEFAULT_COUNT = 24;

// -------- utils (mêmes hash que le front) --------
function shortHash(str) {
  let h = 2166136261 >>> 0;
  const s = String(str || '');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h + (h<<1) + (h<<4) + (h<<7) + (h<<8) + (h<<24)) >>> 0;
  }
  return h.toString(36);
}
function mulberry32(a) {
  return function() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffleSeeded(arr, seed) {
  const rnd = mulberry32(seed | 0);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = (rnd() * (i + 1)) | 0;
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
function getQuery(req) {
  if (req.query && typeof req.query === 'object') return req.query; // Next.js (pages dir)
  try {
    const u = new URL(req.url, 'http://localhost');
    return Object.fromEntries(u.searchParams.entries());
  } catch {
    return {};
  }
}

// -------- dataset loader --------
// On lit public/ff-dataset.json (dataset combiné FR/EN/DE ; chaque item a {lang,claim,explain,source})
async function loadDataset() {
  try {
    const modPath = url.fileURLToPath(import.meta.url);
    const repoRoot = path.dirname(path.dirname(modPath));
    const filePath = path.join(repoRoot, 'public', 'ff-dataset.json');
    const raw = await fs.readFile(filePath, 'utf8');
    const data = JSON.parse(raw);
    const items = Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : []);
    return items;
  } catch {
    return [];
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');

  try {
    const q = getQuery(req);
    const lang  = (q.lang || 'fr').slice(0, 2).toLowerCase();
    const count = Math.max(1, Math.min(60, (parseInt(q.count ?? DEFAULT_COUNT, 10) | 0)));
    const seed  = q.seed ? (parseInt(q.seed, 10) || 0) : (Date.now() & 0xffffffff);
    const seenCsv = (q.seen || '').trim();
    const seenSet = new Set(
      seenCsv ? seenCsv.split(',').map(s => s.trim()).filter(Boolean) : []
    );

    const all = await loadDataset();
    // filtre par langue
    let pool = all.filter(it => (it.lang || 'fr').slice(0,2).toLowerCase() === lang);

    // exclusion par shortHash(id) OU shortHash(claim) pour être compatible avec le front
    if (seenSet.size) {
      pool = pool.filter(it => {
        const sid = shortHash(it.id || '');
        const sc  = shortHash(it.claim || '');
        return !seenSet.has(sid) && !seenSet.has(sc);
      });
    }

    // shuffle déterministe + slice
    shuffleSeeded(pool, seed);
    const out = pool.slice(0, count).map(it => ({
      id: it.id || shortHash((it.claim || '') + '|' + (it.source || '')),
      claim: it.claim || '',
      explain: it.explain || '',
      source: it.source || ''
    }));

    return res.status(200).json(out);
  } catch {
    // jamais 500 : on renvoie un tableau vide
    return res.status(200).json([]);
  }
}
