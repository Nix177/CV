// api/facts.js
// Scrape Wikipedia (FR/EN/DE) : List of common misconceptions (+ équivalents) et renvoie des "myths" normalisés.
// Cache mémoire 12h pour limiter les hits, + cache CDN (s-maxage).

import * as cheerio from "cheerio";

const SOURCES = {
  en: "https://en.wikipedia.org/wiki/List_of_common_misconceptions",
  fr: "https://fr.wikipedia.org/wiki/Liste_d%27id%C3%A9es_re%C3%A7ues",
  de: "https://de.wikipedia.org/wiki/Liste_verbreiteter_Irrt%C3%BCmer",
};

const TTL = 12 * 60 * 60 * 1000; // 12h
let CACHE = { ts: 0, data: { en: [], fr: [], de: [] } };

export default async function handler(req, res) {
  try {
    const url = new URL(req.url, "http://dummy");
    const lang = (url.searchParams.get("lang") || "fr").slice(0, 2);
    const n = clamp(parseInt(url.searchParams.get("n") || "8", 10), 1, 40);
    const kind = (url.searchParams.get("kind") || "all").toLowerCase(); // myth|fact|all
    const withLocalFacts = url.searchParams.get("withLocal") === "1";
    const seen = (url.searchParams.get("seen") || "").split(",").filter(Boolean);

    await ensureCache();

    // Pool par langue avec fallback vers EN
    let pool =
      (CACHE.data[lang] && CACHE.data[lang].length && CACHE.data[lang]) ||
      CACHE.data.en;

    // Ajoute des "facts" locaux si demandé
    if (withLocalFacts) {
      pool = pool.concat(LOCAL_FACTS.map((f) => ({ ...f, lang })));
    }

    if (kind === "myth") pool = pool.filter((x) => x.type === "myth");
    else if (kind === "fact") pool = pool.filter((x) => x.type === "fact");

    // Filtre les déjà-vus (id)
    if (seen.length) pool = pool.filter((x) => !seen.includes(x.id));

    // Échantillon unique aléatoire
    const out = sampleUnique(pool, n);

    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
    res.status(200).json(out);
  } catch (e) {
    console.error(e);
    res.status(200).json(sampleUnique(LOCAL_FALLBACK, 8)); // fallback propre
  }
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n || a));
}
function hash(s) {
  let h = 0,
    i = 0,
    len = s.length;
  while (i < len) h = (h << 5) - h + s.charCodeAt(i++) | 0;
  return (h >>> 0).toString(36);
}
function sampleUnique(arr, n) {
  if (arr.length <= n) return arr.slice().sort(() => Math.random() - 0.5);
  const out = [];
  const used = new Set();
  while (out.length < n && used.size < arr.length) {
    const i = (Math.random() * arr.length) | 0;
    if (!used.has(i)) {
      used.add(i);
      out.push(arr[i]);
    }
  }
  return out;
}

async function ensureCache() {
  const now = Date.now();
  if (now - CACHE.ts < TTL && CACHE.data.en.length) return;

  const next = { en: [], fr: [], de: [] };

  await Promise.all(
    Object.entries(SOURCES).map(async ([lang, url]) => {
      try {
        const html = await (await fetch(url, { headers: { "User-Agent": "NT-FunFacts/1.0" }})).text();
        next[lang] = scrapeWikipedia(html, lang, url);
      } catch (e) {
        console.error("Scrape error", lang, e);
        next[lang] = [];
      }
    })
  );

  CACHE = { ts: Date.now(), data: next };
}

function scrapeWikipedia(html, lang, sourceUrl) {
  const $ = cheerio.load(html);
  // on vise le contenu principal
  const root = $("#mw-content-text");
  const out = [];

  // Parcourt sections H2 -> listes <ul><li>
  // Chaque <li> est une "idée reçue" → type "myth"
  root.find("h2").each((_, h2) => {
    const $h2 = $(h2);
    const cat = cleanText($h2.text().replace("[edit]", "").trim());
    let p = $h2.next();

    while (p.length && !p.is("h2")) {
      if (p.is("ul")) {
        p.find("> li").each((__, li) => {
          const $li = $(li).clone();

          // supprime citations [x]
          $li.find("sup").remove();

          // texte principal
          const text = cleanText($li.text());

          // liens externes (sources), on garde http/https absolus
          const sources = [];
          $li.find("a[href]").each((___, a) => {
            const href = $(a).attr("href");
            if (!href) return;
            if (/^https?:\/\//i.test(href)) sources.push(href);
          });

          if (text && text.length > 40) {
            const id = `${lang}:${hash(cat + "::" + text.slice(0, 160))}`;
            out.push({
              id,
              lang,
              category: cat || "Général",
              type: "myth",
              title: summarizeTitle(text),
              body: text,
              sources: sources.length ? dedupe(sources).slice(0, 5) : [sourceUrl],
            });
          }
        });
      }
      p = p.next();
    }
  });

  // Nettoyage et diversité rudimentaire
  return dedupeById(out).slice(0, 2000);
}

function cleanText(s = "") {
  return s
    .replace(/\s+/g, " ")
    .replace(/\[citation needed\]/gi, "")
    .replace(/\[[^\]]+\]/g, "") // refs résiduelles
    .trim();
}
function summarizeTitle(text) {
  // prend ~ la première phrase ou 90–120 caractères
  const m = text.match(/^(.{40,120}?[.!?])\s/);
  const t = m ? m[1] : text.slice(0, 110);
  return t.replace(/\s+/g, " ").trim();
}
function dedupe(arr) {
  return Array.from(new Set(arr));
}
function dedupeById(arr) {
  const seen = new Set();
  const out = [];
  for (const x of arr) {
    if (!seen.has(x.id)) { seen.add(x.id); out.push(x); }
  }
  return out;
}

// --- Quelques "facts" locaux pour satisfaire le bouton "Un fait" ---
const LOCAL_FACTS = [
  {
    id: "local:honey",
    lang: "fr",
    type: "fact",
    category: "Alimentation",
    title: "Le miel peut se conserver des millénaires.",
    body: "Des pots comestibles ont été retrouvés dans des tombes antiques.",
    sources: ["https://www.nationalgeographic.com/history/article/131219-ancient-egypt-honey-tombs-beekeeping"]
  },
  {
    id: "local:sharks",
    lang: "fr",
    type: "fact",
    category: "Nature",
    title: "Les requins sont plus anciens que les arbres.",
    body: "Les premiers requins datent d’il y a ~450 Ma ; les arbres modernes ~360 Ma.",
    sources: ["https://ocean.si.edu/ocean-life/sharks-rays/evolution-sharks"]
  }
];

const LOCAL_FALLBACK = LOCAL_FACTS;
