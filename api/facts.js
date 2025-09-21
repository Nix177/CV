// /api/facts  — renvoie un tableau [{ id,type,category,title,body,sources:[{href,label}]}]
// Stratégie :
// 1) Scrape Wikipedia (FR → EN fallback) avec extraction plus robuste, cache 12h.
// 2) Filtre/échantillonne côté serveur selon ?lang ?n ?kind ?seen.

import cheerio from "cheerio";

const CACHE_TTL = 12 * 60 * 60 * 1000;
const mem = new Map(); // key: lang -> {ts, items}

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

// FR principal
const WIKI_FR = "https://fr.wikipedia.org/wiki/Liste_d%27id%C3%A9es_re%C3%A7ues";
// EN : page racine + sous-listes
const WIKI_EN_PAGES = [
  "https://en.wikipedia.org/wiki/List_of_common_misconceptions",
  "https://en.wikipedia.org/wiki/List_of_common_misconceptions_about_arts_and_culture",
  "https://en.wikipedia.org/wiki/List_of_common_misconceptions_about_history",
  "https://en.wikipedia.org/wiki/List_of_common_misconceptions_about_science,_technology,_and_mathematics",
];

async function fetchWiki(url){
  const r = await fetch(url, { headers: { "user-agent": "cv-nicolas-tuor-facts/1.0" }});
  if(!r.ok) throw new Error(`fetch ${url}: ${r.status}`);
  return await r.text();
}

// Extraction plus robuste : on prend tous les <ul> jusqu’au prochain h2/h3
function extractFacts(html, lang){
  const $ = cheerio.load(html);
  const out = [];
  const seen = new Set();

  $("h2, h3").each((_,h)=>{
    const $h = $(h);
    const cat = $h.text().replace(/\[.*?\]/g,"").trim();

    // Tous les contenus jusqu’au prochain heading
    const $scope = $h.nextUntil("h2, h3");
    const $uls = $scope.filter("ul").add($scope.find("ul"));

    $uls.each((__, ul)=>{
      $(ul).find("> li").each((i,li)=>{
        const $li = $(li);
        const text = $li.text().replace(/\s+/g," ").replace(/\[.*?\]/g,"").trim();
        if(text.length < 25) return;

        // phrase 1 = formulation du mythe ; reste = explication
        const m = text.match(/^([^\.!?]{10,}?[\.!?])\s+(.*)$/);
        const title = m ? m[1].trim() : text.slice(0,90)+"…";
        const body  = m ? m[2].trim() : text;

        const key = `${title}||${body.slice(0,80)}`;
        if (seen.has(key)) return; // anti-doublon sur la même page
        seen.add(key);

        // liens (sources) présents dans l’item
        const sources = [];
        $li.find("a[href]").each((_,a)=>{
          const href = $(a).attr("href");
          if(!href || href.startsWith("#")) return;
          const abs = href.startsWith("http") ? href : `https://${lang==="fr"?"fr":"en"}.wikipedia.org${href}`;
          const label = $(a).text().trim() || niceLabel(abs);
          sources.push({ href: abs, label });
        });

        out.push({
          id: `wiki:${lang}:${cat}:${i}:${Math.abs(key.hashCode?.()||0)}`,
          type: "myth",
          category: cat || "Général",
          title,
          body,
          sources
        });
      });
    });
  });

  return normalize(out);
}

// petit hash (pas critique, juste pour id stable)
String.prototype.hashCode = function(){let h=0; for(let i=0;i<this.length;i++){h=((h<<5)-h)+this.charCodeAt(i); h|=0;} return h;};

async function fetchAllEN(){
  const pages = await Promise.allSettled(WIKI_EN_PAGES.map(fetchWiki));
  const htmlParts = pages.filter(p=>p.status==="fulfilled").map(p=>p.value);
  const items = [];
  for (const html of htmlParts) items.push(...extractFacts(html, "en"));
  // dédoublonne entre pages EN
  const uniq = new Map();
  for(const it of items){ const k = `${it.title}||${it.body.slice(0,80)}`; if(!uniq.has(k)) uniq.set(k,it); }
  return Array.from(uniq.values());
}

async function getAllFacts(lang){
  const key = (lang || "fr").slice(0,2);
  const now = Date.now();
  const cached = mem.get(key);
  if(cached && now - cached.ts < CACHE_TTL) return cached.items;

  let items = [];
  try{
    if (key === "fr") {
      const html = await fetchWiki(WIKI_FR);
      items = extractFacts(html, "fr");
    } else {
      items = await fetchAllEN();
    }
    if (!items.length && key === "fr") {
      // fallback → EN si la page FR change
      items = await fetchAllEN();
    }
  }catch{
    items = [];
  }

  mem.set(key, { ts: now, items });
  return items;
}

function sampleServerSide(all, {n, kind, seen}){
  let list = all.slice();
  if(kind) list = list.filter(x=>x.type===kind);
  const seenSet = new Set((seen||"").split(",").filter(Boolean));
  if(seenSet.size) list = list.filter(x=>!seenSet.has(x.id));
  for(let i=list.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1)); [list[i],list[j]]=[list[j],list[i]];}
  if(n) list = list.slice(0, n);
  return list;
}

export default async function handler(req, res){
  try{
    const { lang="fr", n="", kind="", seen="" } = req.query || {};
    const N = Math.max(0, parseInt(n||"0",10)) || 0;
    const all = await getAllFacts(lang);
    const out = sampleServerSide(all, { n: N, kind, seen });
    res.setHeader("cache-control","s-maxage=600, stale-while-revalidate=600");
    res.status(200).json(out);
  }catch{
    res.status(200).json([]); // le front a son fallback local
  }
}
