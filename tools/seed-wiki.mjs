#!/usr/bin/env node
import fs from "fs";
import cheerio from "cheerio";

const args = Object.fromEntries(process.argv.slice(2).map(s=>{
  const [k,v] = s.replace(/^--/,'').split('=');
  return [k, v ?? true];
}));
const lang = (args.lang || "fr").toLowerCase();
const out  = args.out || "public/facts-data.json";

const WIKI_FR = "https://fr.wikipedia.org/wiki/Liste_d%27id%C3%A9es_re%C3%A7ues";
const WIKI_EN = "https://en.wikipedia.org/wiki/List_of_common_misconceptions";

const niceLabel = (u)=> String(u||"").replace(/^https?:\/\//,"").slice(0,95);

async function fetchWiki(url){
  const r = await fetch(url, { headers: { "user-agent": "seed-wiki-facts/1.0" }});
  if(!r.ok) throw new Error(`fetch ${url}: ${r.status}`);
  return await r.text();
}
function normalize(items){
  return items.map((it,i)=>({
    id: it.id || `wiki:${i}`,
    type: it.type || "myth",
    category: it.category || "Général",
    title: it.title || "(sans titre)",
    body: it.body || "",
    sources: (it.sources||[]).map(s=>({
      href: String(s.href||s.url||s), label: String(s.label)||niceLabel(s.href||s.url||s)
    })).filter(s=>s.href)
  }));
}
function extractFacts(html, lang){
  const $ = cheerio.load(html);
  const out = [];
  $("h2, h3").each((_,h)=>{
    const $h = $(h);
    const cat = $h.text().replace(/\[.*?\]/g,"").trim();
    let $ul = $h.next();
    let tries = 0;
    while($ul.length && tries<3 && !$ul.is("ul")){$ul=$ul.next();tries++;}
    if(!$ul.length || !$ul.is("ul")) return;
    $ul.find("> li").each((i,li)=>{
      const $li = $(li);
      const text = $li.text().replace(/\s+/g," ").replace(/\[.*?\]/g,"").trim();
      if(text.length < 25) return;
      const m = text.match(/^([^\.!?]{10,}?[\.!?])\s+(.*)$/);
      const title = m ? m[1].trim() : text.slice(0,90)+"…";
      const body  = m ? m[2].trim() : text;

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

(async ()=>{
  const url = lang==="fr" ? WIKI_FR : WIKI_EN;
  let html = await fetchWiki(url);
  let items = extractFacts(html, lang);
  if(!items.length && lang==="fr"){ // fallback EN
    html = await fetchWiki(WIKI_EN);
    items = extractFacts(html, "en");
  }
  fs.writeFileSync(out, JSON.stringify(items, null, 2));
  console.log(`✅ Écrit ${items.length} éléments dans ${out}`);
})().catch(e=>{
  console.error("seed-wiki error:", e);
  process.exit(1);
});
