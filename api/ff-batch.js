export default async function handler(req, res){
  if (req.method !== "GET"){
    res.setHeader("Allow","GET");
    return res.status(405).end("Method Not Allowed");
  }
  try{
    const origin = req.headers.origin || "";
    const allowed = /nicolastuor\.ch$/i.test(new URL(origin).host) || origin === "";
    if (!allowed) return res.status(403).json({error:"forbidden"});

    const lang  = (req.query.lang || "fr").toLowerCase();
    const count = Math.min(12, Math.max(3, parseInt(req.query.count||"9",10)));
    const q     = (req.query.q||"").trim();

    // 1) seed titles (tu peux étendre/adapter)
    const seeds = {
      fr:[
        "Mythe_des_10_%_du_cerveau",
        "Grande_Muraille_de_Chine",
        "Caméléon#Changement_de_couleur",
        "Casque_viking",
        "Effet_Coriolis",
        "Foudre",
        "Fibre_optique"
      ],
      en:[
        "Ten_percent_of_the_brain_myth",
        "Great_Wall_of_China#Visibility_from_space",
        "Chameleon#Color_change",
        "Viking_Age#Popular_misconceptions",
        "Coriolis_effect",
        "Lightning",
        "Fiber-optic_communication"
      ],
      de:[
        "Zehn-Prozent-Mythos",
        "Chinesische_Mauer",
        "Chamäleon#Farbwechsel",
        "Wikinger#Rezeption",
        "Corioliskraft",
        "Blitz",
        "Glasfaser"
      ]
    }[lang] || [];

    // 2) pick some titles
    const titles = shuffle(seeds).slice(0, count);

    // 3) fetch summaries in chosen lang (Wikimedia REST)
    const pages = [];
    for (const t of titles){
      try{
        const url = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(t)}`;
        const r = await fetch(url, {headers:{'accept':'application/json'}});
        if (!r.ok) continue;
        const js = await r.json();
        pages.push({
          title: js.title,
          extract: js.extract || "",
          url: js.content_urls?.desktop?.page || js.desktop?.page || js.canonicalurl || `https://${lang}.wikipedia.org/wiki/${js.title.replace(/\s/g,'_')}`
        });
      }catch{}
    }

    if (!pages.length) return res.status(503).json({error:"no pages"});

    // 4) Summarize into claim/truth (<=30 words) via OpenAI (server-side)
    const key = process.env.OPENAI_API_KEY;
    async function summarize(p){
      // keep it short & deterministic
      const prompt = `
Tu es concis. À partir de l'extrait Wikipedia (langue ${lang}):
- Propose une courte "idée reçue" (mythe) en une phrase.
- Donne une "explication vérifiée" (≤30 mots), claire et factuelle.
- Catégorie simple (Science, Histoire, Nature, etc.)
Réponds en JSON: {"claim":"...", "truth":"...", "category":"..."}.

EXTRAIT:
${p.extract}
`;
      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method:"POST",
        headers:{ "Authorization":`Bearer ${key}`, "Content-Type":"application/json" },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          temperature: 0.2,
          messages: [{role:"user", content: prompt}]
        })
      });
      if (!r.ok) throw new Error("openai error");
      const js = await r.json();
      const txt = js.choices?.[0]?.message?.content || "{}";
      let obj={}; try{ obj=JSON.parse(txt); }catch{ obj={}; }
      return {
        title: { [lang]: p.title },
        claim: { [lang]: obj.claim || p.title },
        truth: { [lang]: (obj.truth||"").slice(0,240) },
        category: { [lang]: obj.category || "Science" },
        type: obj.category || "Science",
        sources: [{ title: "Wikipedia", url: p.url }]
      };
    }

    const out = [];
    for (const p of pages){
      try{
        out.push(await summarize(p));
      }catch{
        // fallback minimal si résumé KO
        out.push({
          title:{[lang]:p.title},
          claim:{[lang]:p.title},
          truth:{[lang]:"Voir la source pour les détails."},
          category:{[lang]:"Divers"},
          type:"Misc",
          sources:[{title:"Wikipedia", url:p.url}]
        });
      }
    }

    // filtre recherche simple côté serveur si q fourni
    const ql = q.toLowerCase();
    const final = q ? out.filter(it =>
      (it.title?.[lang]||"").toLowerCase().includes(ql) ||
      (it.claim?.[lang]||"").toLowerCase().includes(ql) ||
      (it.category?.[lang]||"").toLowerCase().includes(ql)
    ) : out;

    return res.status(200).json(final);
  }catch(e){
    return res.status(500).json({error:"server error", details:String(e)});
  }
}

// util
function shuffle(a){ return a.map(v=>[Math.random(),v]).sort((x,y)=>x[0]-y[0]).map(v=>v[1]); }
