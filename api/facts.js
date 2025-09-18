// /api/facts  — renvoie un tableau [{ id,type,category,title,body,sources:[{href,label}]}]
// Stratégie :
// 1) Tente de scraper Wikipedia “List of common misconceptions” (FR → EN fallback), cache 12h.
// 2) Filtre/échantillonne côté serveur selon ?lang ?n ?kind ?seen.
// NB: le front a déjà un fallback JSON (facts-data.json).

import cheerio from "cheerio";

const CACHE_TTL = 12 * 60 * 60 * 1000;
const mem = new Map(); // key: lang -> {ts, items}

function toArray(x){ return Array.isArray(x) ? x : (x ? [x] : []); }
const toStr = (x)=> (x==null?"":String(x)).trim();
const niceLabel = (u)=> toStr(u).replace(/^https?:\/\//,"").slice(0,95);

function normalize(items){
  return items.map((it,i)=>({
    id: it.id || `wiki:${i}`,
    type: it.type || "myth",
    category: it.category || "Général",
    title: it.title || "(sans titre)",
    body: it.body || "",
    sources: (it.sources||[]).map(s=>({
      href: toStr(s.href||s.url||s), label: toStr(s.label)||niceLabel(s.href||s.url||s)
    })).filter(s=>s.href)
  }));
}

// Pages à tenter (FR puis EN)
const WIKI_FR = "https://fr.wikipedia.org/wiki/Liste_d%27id%C3%A9es_re%C3%A7ues";
const WIKI_EN = "https://en.wikipedia.org/wiki/List_of_common_misconceptions";

async function fetchWiki(url){
  const r = await fetch(url, { headers: { "user-agent": "cv-nicolas-tuor-facts/1.0" }});
  if(!r.ok) throw new Error(`fetch ${url}: ${r.status}`);
  return await r.text();
}

function extractFacts(html, lang){
  const $ = cheerio.load(html);
  const out = [];
  // Heuristique : sections (h2/h3) -> items (li) avec texte + liens
  $("h2, h3").each((_,h)=>{
    const $h = $(h);
    const cat = $h.text().replace(/\[.*?\]/g,"").trim();
    let $ul = $h.next();
    // parfois paragraphes intercalés
    let tries = 0;
    while($ul.length && tries < 3 && !$ul.is("ul")){ $ul = $ul.next(); tries++; }
    if(!$ul.length || !$ul.is("ul")) return;
    $ul.find("> li").each((i,li)=>{
      const $li = $(li);
      const text = $li.text().replace(/\s+/g," ").replace(/\[.*?\]/g,"").trim();
      if(text.length < 25) return;
      // Split grossier : phrase 1 = mythe, reste = explication
      const m = text.match(/^([^\.!?]{10,}?[\.!?])\s+(.*)$/);
      const title = m ? m[1].trim() : text.slice(0,90)+"…";
      const body  = m ? m[2].trim() : text;

      // Sources = liens dans l’item
      const sources = [];
      $li.find("a[href]").each((_,a)=>{
        const href = $(a).attr("href");
        if(!href || href.startsWith("#")) return;
        const abs = href.startsWith("http") ? href : `https://${lang==="fr"?"fr":"en"}.wikipedia.org${href}`;
        sources.push({href: abs, label: $(a).text().trim() || niceLabel(abs)});
      });

      out.push({
        id: `wiki:${lang}:${cat}:${i}`,
        type: "myth",
        category: cat || "Général",
        title,
        body,
        sources
      });
    });
  });
  return normalize(out);
}

async function getAllFacts(lang){
  const key = lang || "fr";
  const now = Date.now();
  const cached = mem.get(key);
  if(cached && now - cached.ts < CACHE_TTL) return cached.items;

  let html, items = [];
  try{
    html = await fetchWiki(key==="fr" ? WIKI_FR : WIKI_EN);
    items = extractFacts(html, key);
  }catch(e){
    // fallback: EN si FR down
    if(key==="fr"){
      try{
        html = await fetchWiki(WIKI_EN);
        items = extractFacts(html, "en");
      }catch(e2){
        items = [];
      }
    }
  }
  mem.set(key, { ts: now, items });
  return items;
}

function sampleServerSide(all, {n, kind, seen}){
  let list = all.slice();
  if(kind) list = list.filter(x=>x.type===kind);
  const seenSet = new Set((seen||"").split(",").filter(Boolean));
  if(seenSet.size) list = list.filter(x=>!seenSet.has(x.id));
  shuffle(list);
  if(n) list = list.slice(0, n);
  return list;
}
function shuffle(a){ for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]];} return a;}

export default async function handler(req, res){
  try{
    const { lang="fr", n="", kind="", seen="" } = req.query || {};
    const N = Math.max(0, parseInt(n||"0",10)) || 0;

    const all = await getAllFacts(lang);
    const out = sampleServerSide(all, { n: N, kind, seen });
    res.setHeader("cache-control","s-maxage=600, stale-while-revalidate=600");
    res.status(200).json(out);
  }catch(e){
    res.status(200).json([]); // le front a son fallback local
  }
}
