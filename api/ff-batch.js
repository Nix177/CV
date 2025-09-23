// /api/ff-batch.js
// Node 18+, CommonJS (Vercel). Renvoie un tableau d'items normalisés.
// Chaque item: { id, type:'myth'|'fact', title, explanation, explainShort, sources:[{title,url}] }

const cheerio = require('cheerio');

const PAGES = {
  fr: [
    // La page FR n'est pas un “listicle” parfait → on complète par EN si besoin
    'https://fr.wikipedia.org/wiki/Id%C3%A9e_re%C3%A7ue',
    'https://fr.wikipedia.org/wiki/Liste_d%27id%C3%A9es_re%C3%A7ues'
  ],
  en: [
    'https://en.wikipedia.org/wiki/List_of_common_misconceptions'
  ],
  de: [
    'https://de.wikipedia.org/wiki/Liste_weit_verbreiteter_Irrt%C3%BCmer'
  ]
};

const UA = 'nicolastuor.ch/fun-facts (contact: site)';

function trim(s){ return String(s||'').replace(/\s+/g,' ').trim(); }
function shortenWords(s, n=30){
  const w = trim(s).split(' ');
  return (w.length<=n) ? trim(s) : w.slice(0,n).join(' ')+'…';
}
function absolutize(baseUrl, href){
  try {
    if (!href) return baseUrl;
    if (/^https?:\/\//i.test(href)) return href;
    const u = new URL(baseUrl);
    if (href.startsWith('/')) return `${u.protocol}//${u.host}${href}`;
    return baseUrl; // fallback
  } catch { return href || baseUrl; }
}
function hashId(s){
  // petit hash stable
  let h = 0; const str = (s||'').toLowerCase();
  for (let i=0;i<str.length;i++){ h = (h*31 + str.charCodeAt(i))|0; }
  return Math.abs(h).toString(36);
}

// Extraction générique depuis HTML Wikipédia (bullet points)
function extractFromHtml(lang, url, html){
  const $ = cheerio.load(html);
  const $content = $('#mw-content-text');

  const items = [];
  // On cible les <li> notables (éviter les menus)
  $content.find('li').each((i, el) => {
    const $li = $(el);
    const txt = trim($li.text()).replace(/\[\d+\]/g, ''); // retire refs [1]
    if (!txt || txt.length < 60) return; // éviter le bruit

    // Heuristique: une idée reçue se présente souvent comme une phrase assertive.
    // On garde la 1re phrase en “claim”, et le reste en explication.
    const sentenceSplit = txt.split(/(?<=[.!?])\s+/);
    const title = trim(sentenceSplit[0]);
    const rest  = trim(sentenceSplit.slice(1).join(' ')) || title;

    // source plausible = 1er lien
    const a = $li.find('a[href]').filter((i, el) => {
      const href = $(el).attr('href') || '';
      return !href.startsWith('#') && !href.includes('redlink=');
    }).first();
    const href = absolutize(url, a.attr('href'));

    const id = `myth-${hashId(title)}`;
    const explanation = rest;
    const explainShort = shortenWords(explanation || title, 30);

    items.push({
      id,
      type: 'myth',
      category: '',
      title,
      explanation,
      explainShort,
      sources: [{ title: 'Wikipedia', url: href || url }]
    });
  });

  // dédoublonnage par titre
  const seen = new Set();
  const out = [];
  for (const it of items) {
    const key = it.title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(it);
  }
  return out;
}

async function scrapeLang(lang) {
  const urls = PAGES[lang] || PAGES.en;
  const all = [];
  for (const url of urls) {
    try {
      const res = await fetch(url, { headers: { 'user-agent': UA, 'accept-language': lang } });
      if (!res.ok) continue;
      const html = await res.text();
      all.push(...extractFromHtml(lang, url, html));
    } catch {
      // on ignore et on tente l'URL suivante
    }
  }
  return all;
}

module.exports = async (req, res) => {
  const lang = String((req.query.lang || 'fr')).slice(0,2).toLowerCase();
  const count = Math.max(1, Math.min(parseInt(req.query.count || '9', 10), 48));
  const seenSet = new Set(String(req.query.seen || '').split(',').filter(Boolean));

  try {
    const primary = await scrapeLang(lang);
    const fallback = (lang === 'fr' ? await scrapeLang('en') : []);
    // pool = FR + EN fallback (utile si la page FR est pauvre)
    const pool = [...primary, ...fallback];

    // filtre "déjà vu"
    const fresh = pool.filter(it => !seenSet.has(it.id));

    // shuffle Fisher–Yates
    for (let i = fresh.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [fresh[i], fresh[j]] = [fresh[j], fresh[i]];
    }

    const out = fresh.slice(0, count);

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=3600');
    // IMPORTANT: on renvoie un **tableau**
    res.status(200).json(out);
  } catch (e) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    // En cas d’échec: on ne casse pas la page → tableau vide
    res.status(200).json([]);
  }
};
