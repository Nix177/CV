// api/facts.js — Edge Runtime
// Essaie Wikipédia -> sinon fallback /facts-data.json. Toujours 200 avec {items:[]}
// Query: ?lang=fr|en|de&n=9&seen=csv
export const config = { runtime: 'edge' };

const SOURCES = {
  fr: [
    'https://fr.wikipedia.org/wiki/Liste_d%27id%C3%A9es_re%C3%A7ues'
  ],
  en: [
    'https://en.wikipedia.org/wiki/List_of_common_misconceptions_about_arts_and_culture',
    'https://en.wikipedia.org/wiki/List_of_common_misconceptions_about_history',
    'https://en.wikipedia.org/wiki/List_of_common_misconceptions_about_science,_technology,_and_mathematics'
  ],
  de: [
    // Il y a plusieurs pages DE possibles; on essaie la plus générale si dispo
    'https://de.wikipedia.org/wiki/Liste_irrt%C3%BCmlicher_Ann%C3%A4hmen', // peut 404 selon renommage
    'https://de.wikipedia.org/wiki/Irrtum' // fallback faible: sera ignoré si pas de listes utiles
  ]
};

export default async function handler(req) {
  const { searchParams } = new URL(req.url);
  const lang = (searchParams.get('lang') || 'fr').toLowerCase();
  const n    = clampInt(searchParams.get('n'), 1, 24, 9);
  const seen = new Set(
    (searchParams.get('seen') || '')
      .split(',').map(s => s.trim()).filter(Boolean)
  );

  // 1) Essaie de récupérer des items depuis Wikipédia
  let items = [];
  try {
    items = await fetchFromWikipedia(lang);
  } catch (e) {
    // on continue, on fera le fallback
    console.error('[facts] wiki error:', e?.message || e);
  }

  // 2) Filtre "seen", mélange, garde n
  items = filterShuffleTake(items, seen, n);

  // 3) Si rien, fallback local
  if (items.length === 0) {
    try {
      const fb = await fetchAsset('/facts-data.json');
      const list = Array.isArray(fb) ? fb : (fb?.items || []);
      items = filterShuffleTake(list.map(normalizeItem), seen, n);
    } catch (e) {
      console.error('[facts] fallback error:', e?.message || e);
      items = []; // on renvoie vide mais pas 500
    }
  }

  return json({ items }, 200);
}

/* ---------------- Helpers ---------------- */

async function fetchFromWikipedia(lang) {
  const urls = SOURCES[lang] || SOURCES.fr;
  const out = [];
  for (const url of urls) {
    try {
      const html = await fetchText(url, 7000);
      // extraction très simple des <li>…</li> “principaux”
      // On retire tables/navbox/références autant que possible
      const cleaned = stripBlocks(html, [
        /<table[\s\S]*?<\/table>/gi,
        /<nav[\s\S]*?<\/nav>/gi,
        /<style[\s\S]*?<\/style>/gi,
        /<script[\s\S]*?<\/script>/gi,
        /<sup[\s\S]*?<\/sup>/gi
      ]);

      const liMatches = cleaned.match(/<li[^>]*>([\s\S]*?)<\/li>/gi) || [];
      for (const li of liMatches) {
        let txt = normalizeWhitespace(
          stripTags(li)
            .replace(/\[[^\]]*\]/g, '')          // [1], [citation needed]
            .replace(/\([^)]*\)/g, (m)=> m.length>80 ? '' : m) // parenthèses très longues
        );
        txt = txt.replace(/^[:–—-]\s*/, '');

        if (txt.length < 40) continue; // rejette les lignes trop courtes
        const { title, explainShort } = splitTitleExplain(txt, lang);

        const item = {
          id: makeId(title),
          type: 'myth',                      // par défaut côté wiki
          title,
          explainShort,
          category: guessCategory(url),
          sources: [url]
        };
        out.push(item);
      }
    } catch (e) {
      // ignore erreur sur une source; on tente les autres
    }
  }
  // dédoublonne par id
  const map = new Map();
  for (const it of out) map.set(it.id, it);
  return [...map.values()];
}

function splitTitleExplain(txt, lang) {
  // Heuristiques: on coupe sur " – ", " — ", ":" si présent
  let title = txt;
  let explain = '';
  for (const sep of [' — ', ' – ', ' : ', ': ', ' —', ' –']) {
    const i = txt.indexOf(sep);
    if (i > 0 && i < txt.length - 4) {
      title = txt.slice(0, i).trim();
      explain = txt.slice(i + sep.length).trim();
      break;
    }
  }
  if (!explain) {
    // fallback court
    const s = txt.split('. ');
    title = s[0].trim();
    explain = s.slice(1).join('. ').trim();
  }
  return {
    title: capitalize(title),
    explainShort: truncateWords(explain || defaultExplain(lang), 30)
  };
}

function defaultExplain(lang) {
  if (lang === 'en') return 'This claim is inaccurate according to the cited source.';
  if (lang === 'de') return 'Diese Behauptung ist laut Quelle nicht korrekt.';
  return 'Cette affirmation est inexacte selon la source citée.';
}

function guessCategory(url) {
  if (url.includes('history')) return 'History';
  if (url.includes('science')) return 'Science';
  if (url.includes('culture')) return 'Culture';
  return 'General';
}

function normalizeItem(x) {
  const id = String(x.id || makeId(x.title || Math.random().toString(36)));
  const title = x.title || '—';
  const explainShort = truncateWords(x.explainShort || x.explanation || '', 30);
  const category = x.category || 'General';
  const type = x.type || 'myth';
  const sources = Array.isArray(x.sources) ? x.sources : (x.source ? [x.source] : []);
  return { id, title, explainShort, category, type, sources };
}

function filterShuffleTake(list, seen, n) {
  const pool = list.filter(it => !seen.has(String(it.id)));
  // shuffle
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, n).map(normalizeItem);
}

async function fetchText(url, timeoutMs = 8000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  const res = await fetch(url, { signal: ctrl.signal });
  clearTimeout(t);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return await res.text();
}

async function fetchAsset(path) {
  const res = await fetch(path, { headers: { 'x-ff': '1' } });
  if (!res.ok) throw new Error('asset ' + path + ' ' + res.status);
  return await res.json();
}

function stripBlocks(html, regexps) {
  let out = html;
  for (const re of regexps) out = out.replace(re, '');
  return out;
}
function stripTags(s) { return s.replace(/<\/?[^>]+>/g, ''); }
function normalizeWhitespace(s){ return s.replace(/\s+/g, ' ').trim(); }
function truncateWords(s, n) {
  const words = normalizeWhitespace(String(s)).split(' ');
  return words.length <= n ? normalizeWhitespace(String(s)) : words.slice(0, n).join(' ') + '…';
}
function clampInt(v, min, max, def) {
  const n = parseInt(v, 10);
  if (Number.isFinite(n)) return Math.max(min, Math.min(max, n));
  return def;
}
function capitalize(s){ return s ? s[0].toUpperCase() + s.slice(1) : s; }
function makeId(s){
  const base = String(s || '').toLowerCase().trim().slice(0, 80);
  const hash = Math.abs(hashCode(base)).toString(36).slice(0, 6);
  return (base.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'id') + '-' + hash;
}
function hashCode(str){
  let h = 0; for (let i=0;i<str.length;i++){ h = ((h<<5)-h + str.charCodeAt(i))|0; } return h;
}
function json(obj, status=200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' }
  });
}
