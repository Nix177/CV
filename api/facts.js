// api/facts.js
export const config = { runtime: 'edge' };

// Utilise l’API REST de Wikipédia (page/plain) pour récupérer un contenu texte
// et y extraire des lignes de type "•" / "-" / "*" comme items "myth : explanation".
async function handler(req) {
  try {
    const { searchParams } = new URL(req.url);
    const lang = (searchParams.get('lang') || 'fr').toLowerCase();
    const n = Math.min(parseInt(searchParams.get('n') || '9', 10) || 9, 30);
    const seen = new Set((searchParams.get('seen')||'').split(',').map(s=>s.trim()).filter(Boolean));

    const pages = pickPagesFor(lang);
    let pool = [];
    for (const slug of pages) {
      try{
        const items = await fetchAndExtract(lang, slug);
        pool = pool.concat(items);
      }catch(e){ /* next page */ }
      if (pool.length >= 60) break; // suffisant
    }

    // dédup + shuffle
    const map = new Map();
    pool.forEach(it => { if (!map.has(it.id)) map.set(it.id, it); });
    let arr = [...map.values()].filter(it=>!seen.has(it.id));

    for (let i=arr.length-1;i>0;i--){
      const j = Math.floor(Math.random()*(i+1)); [arr[i],arr[j]]=[arr[j],arr[i]];
    }
    arr = arr.slice(0, n);

    return new Response(JSON.stringify({ items: arr }, null, 2), {
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ items: [], error: 'facts_failed' }), {
      status: 200, // pour laisser le front tomber sur le fallback
      headers: { 'content-type': 'application/json; charset=utf-8' },
    });
  }
}
export default handler;

// ----------------------------------------------------------------

function pickPagesFor(lang){
  // Sans prétendre à l’exhaustivité — on priorise les listes.
  if (lang === 'en') return [
    'List_of_common_misconceptions',
    'List_of_common_misconceptions_in_science',
  ];
  if (lang === 'de') return [
    'Liste_von_Irrtümern',           // si elle existe
    'Irrtum',                         // fallback : article (peu d’items, mais on tente)
    'Liste_von_modernen_Sagen',      // autre liste potentielle
    'Populärwissenschaft'            // backup
  ];
  // fr (défaut)
  return [
    'Liste_d%27id%C3%A9es_re%C3%A7ues', // "Liste d'idées reçues"
    'Id%C3%A9e_re%C3%A7ue',             // article générique
    'Id%C3%A9es_re%C3%A7ues'            // variante
  ];
}

async function fetchAndExtract(lang, slug){
  const url = `https://${lang}.wikipedia.org/api/rest_v1/page/plain/${slug}`;
  const r = await fetch(url, { headers: { 'accept': 'text/plain' }});
  if (!r.ok) throw new Error('wiki fetch failed');
  const text = await r.text();

  // On prend les lignes commençant par puce, tiret ou astérisque
  const lines = text.split(/\r?\n/).filter(l => /^[\u2022\-\*]\s+/.test(l.trim()));
  const baseUrl = `https://${lang}.wikipedia.org/wiki/${slug}`;

  const items = [];
  for (const raw of lines) {
    const line = raw.replace(/^[\u2022\-\*]\s+/, '').trim();
    if (!line || line.length < 12) continue;

    // Heuristique : "mythe — explication" / "mythe : explication"
    const m = line.match(/^(.+?)(?:\s*[–—-:]\s+)(.+)$/); // tirets & deux-points
    const title = (m ? m[1] : line).replace(/\s+/g,' ').trim();
    const explain = (m ? m[2] : '').replace(/\s+/g,' ').trim();

    // id stable-ish
    const id = (title.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'').slice(0,80)) || Math.random().toString(36).slice(2);
    items.push({
      id,
      type: 'myth',
      category: 'general',
      title,
      explanation: explain,
      explainShort: '', // le front coupera à 30 mots proprement
      sources: [baseUrl]
    });
    if (items.length >= 120) break;
  }
  return items;
}
