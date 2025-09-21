// api/facts.js
// Node (Vercel) serverless function — robust Wikipedia scraper
import * as cheerio from 'cheerio';

const WIKI = {
  fr: ['https://fr.wikipedia.org/wiki/Liste_d%27id%C3%A9es_re%C3%A7ues'],
  en: [
    'https://en.wikipedia.org/wiki/List_of_common_misconceptions_about_arts_and_culture',
    'https://en.wikipedia.org/wiki/List_of_common_misconceptions_about_history',
    'https://en.wikipedia.org/wiki/List_of_common_misconceptions_about_science,_technology,_and_mathematics'
  ]
};

const UA = 'nicolas-tuor-cv-facts/1.1 (+https://nicolastuor.ch)';

function trimSpaces(s) { return (s || '').replace(/\s+/g, ' ').trim(); }
function stripRefs($el) {
  return $el
    .clone()
    .find('sup,.reference,.nowrap,table,.hatnote,.mw-ref,.noprint')
    .remove()
    .end();
}
function nearestHeading($, el) {
  // Dernier h3 ou h2 avant l'élément
  const $h = $(el).prevAll('h3,h2').first();
  return trimSpaces($h.text()).replace(/\[\s*edit\s*\]|\[.*?\]/gi, '');
}
function firstSentence(s) {
  const txt = trimSpaces(s).replace(/\(\s*\)/g, '');
  // coupage raisonnable
  const m = txt.match(/(.+?[.!?])(\s|$)/);
  return m ? m[1] : txt;
}
function shortenWords(s, n = 20) {
  const words = trimSpaces(s).split(/\s+/);
  return words.length <= n ? trimSpaces(s) : words.slice(0, n).join(' ') + '…';
}
function absolutize(lang, href) {
  if (!href) return null;
  if (/^https?:\/\//i.test(href)) return href;
  const host = lang === 'fr' ? 'https://fr.wikipedia.org' : 'https://en.wikipedia.org';
  return href.startsWith('/') ? host + href : host + '/' + href;
}
function hashId(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(16);
}

function extractFromHtml(lang, url, html) {
  const $ = cheerio.load(html);
  const root = $('.mw-parser-output');

  const items = [];
  // Toutes les UL/OL « de contenu »
  root.find('ul,ol').each((_, list) => {
    const $list = $(list);
    // ignorer les navboxes/infobox/refs
    if ($list.closest('.navbox,.infobox,.toc,.reflist,.haudio').length) return;

    const category = nearestHeading($, list);

    $list.children('li').each((__, li) => {
      const $li = stripRefs($(li));
      // éviter sous-listes qui sont des conteneurs
      const txt = trimSpaces($li.text())
        .replace(/\[[^\]]*?\]/g, '') // [1], [note]
        .replace(/\s\(\)/g, '')
        .replace(/\s*;$/, '');
      if (!txt || txt.length < 15) return;

      // Titre = 1ère phrase « accroche », le reste = explication
      const title = firstSentence(txt);
      const rest = trimSpaces(txt.slice(title.length)) || txt;

      // Source = premier lien « plausible »
      const a = $li.find('a[href]').filter((i, el) => {
        const href = $(el).attr('href') || '';
        return !href.startsWith('#') && !href.includes('redlink=');
      }).first();
      const href = absolutize(lang, a.attr('href'));

      const id = `myth-${hashId(title)}`;
      const explanation = rest;
      const explainShort = shortenWords(rest || title, 20);

      items.push({
        id,
        type: 'myth',
        category: category || '',
        title,
        explanation,
        explainShort,
        sources: href ? [{ href, label: trimSpaces(a.text()) || 'Wikipédia' }] : [{ href: url, label: 'Wikipédia' }]
      });
    });
  });

  // dédup par titre
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
  const urls = WIKI[lang] || WIKI.en;
  const all = [];
  for (const url of urls) {
    try {
      const res = await fetch(url, { headers: { 'user-agent': UA, 'accept-language': lang } });
      if (!res.ok) continue;
      const html = await res.text();
      all.push(...extractFromHtml(lang, url, html));
    } catch {
      // ignore — on tente les autres
    }
  }
  return all;
}

export default async function handler(req, res) {
  const lang = (req.query.lang || 'fr').toLowerCase();
  const n = Math.max(1, Math.min(parseInt(req.query.n || '24', 10), 48));
  const seen = new Set((req.query.seen || '').split(',').filter(Boolean));

  try {
    const primary = await scrapeLang(lang);
    const fallback = lang === 'fr' ? await scrapeLang('en') : [];
    const pool = [...primary, ...fallback];

    // filtrer « seen »
    const fresh = pool.filter(it => !seen.has(it.id));

    // shuffle simple
    for (let i = fresh.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [fresh[i], fresh[j]] = [fresh[j], fresh[i]];
    }

    const out = fresh.slice(0, n);

    res.setHeader('access-control-allow-origin', '*');
    res.setHeader('cache-control', 's-maxage=600, stale-while-revalidate=3600');
    res.status(200).json({ items: out, count: out.length });
  } catch (e) {
    res.setHeader('access-control-allow-origin', '*');
    res.status(200).json({ items: [], count: 0, error: String(e) });
  }
}
