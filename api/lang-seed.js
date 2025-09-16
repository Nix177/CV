// Génère la mission de l’Aventure linguistique : titre, intro, scènes, objectifs, vocabulaire.
// Un seul appel IA au lancement (coût maîtrisé). Fallback si pas de clé.
export default async function handler(req, res){
  try{
    if (req.method !== "POST"){
      res.setHeader("Allow","POST");
      return res.status(405).json({ error:"Method not allowed" });
    }
    const { lang="en", level="A2", topic="travel" } = req.body || {};

    // Fallback direct si pas de clé
    if (!process.env.OPENAI_API_KEY){
      return res.status(200).json(fallbackSeed({ lang, level, topic }));
    }

    const sys = [
      "Tu produis UNIQUEMENT un JSON valide et rien d'autre.",
      "Tu es un concepteur pédagogique pour un jeu de conversation linguistique.",
      lang==="de" ? "Nutze konsequent die Sie-Form im Deutschen." : "Utilise la forme de politesse (vous) en français."
    ].join(" ");

    const prompt = `
Génère un JSON pour une mission d'« Aventure linguistique » en ${lang}.
Paramètres: niveau "${level}", thème "${topic}".
Structure STRICTE:

{
  "title": "courte mission",
  "intro": "2-3 phrases polies (${lang==="de"?"Sie":"vous"}) pour exposer le contexte et le but.",
  "npc": { "name": "nom court", "persona": "1 phrase sur son rôle" },
  "badges": [ {"label": "Thématique"}, {"label": "Niveau ${level}"} ],
  "scenes": [
    {
      "id": "scene1",
      "scene_title": "titre concis",
      "situation": "brief, ce que l'utilisateur doit faire",
      "goals": ["objectif 1", "objectif 2"],
      "expected_keywords": ["mot clé 1","mot clé 2","mot clé 3"],
      "hints": ["indice 1","indice 2"],
      "vocab": [ {"term":"mot","translation":"gloss"} ]
    },
    { "id":"scene2", ... },
    { "id":"scene3", ... }
  ]
}

Contraintes:
- 3 scènes maximum. Objectifs clairs et atteignables au niveau ${level}.
- Vocabulaire utile au thème.
- FR: vouvoiement. DE: Sie-Form. EN: ton pro neutre.
- Aucune phrase hors JSON.
    `.trim();

    const data = await callOpenAI(sys, prompt);
    let out = safeParseJSON(data) || {};
    // garde-fous
    if (!out.title || !Array.isArray(out.scenes) || out.scenes.length < 1){
      out = fallbackSeed({ lang, level, topic });
    }
    out.scenes = out.scenes.slice(0,3);
    return res.status(200).json(out);

  } catch(err){
    console.error("lang-seed error:", err);
    return res.status(200).json(fallbackSeed({ lang:"en", level:"A2", topic:"travel" }));
  }
}

async function callOpenAI(system, user){
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.6,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ]
    })
  });
  const j = await r.json();
  return j?.choices?.[0]?.message?.content || "{}";
}

function safeParseJSON(s){ try{ return JSON.parse(s); }catch{ return null; } }

function fallbackSeed({lang="en", level="A2", topic="travel"}){
  // Aligne avec les valeurs par défaut du client
  // (voir fallback du front)
  const gl = (s)=>s;
  // On réutilise grossièrement les mêmes contenus que le fallback client pour cohérence
  const f = (new Function("params", "return (" + `
    (function fallback(params){
      const lang=params.lang||"en", level=params.level||"A2", topic=params.topic||"travel";
      const t = topic || (lang==="fr"?"voyage":lang==="de"?"Reise":"travel");
      const npcName = (lang==="fr")?"Agent de gare":(lang==="de")?"Bahnhof-Agent":"Station Agent";
      const title = (lang==="fr")?("Mission: "+t):(lang==="de")?("Mission: "+t):("Mission: "+t);
      const intro = (lang==="fr")
        ? "Vous arrivez dans une gare internationale. Échangez dans la langue cible pour obtenir votre billet et des informations."
        : (lang==="de")
        ? "Sie kommen in einem internationalen Bahnhof an. Sprechen Sie in der Zielsprache, um Ticket und Informationen zu erhalten."
        : "You arrive at an international station. Use the target language to get your ticket and information.";
      const scenes = ${JSON.stringify(fallbackScenesTemplate())};
      return { title, intro, npc:{name:npcName, persona:(lang==="fr")?"Agent serviable, ton formel (vous).":(lang==="de")?"Hilfsbereiter Agent, Sie-Form.":"Helpful agent, polite tone."}, badges:[{label:t},{label:"Niveau "+level}], scenes };
    })
  ` + ")"))({lang, level, topic});
  return f;
}

function fallbackScenesTemplate(){
  // même structure que côté client (les champs textes seront ajustés par le client selon la langue)
  return [
    {
      "id":"scene1",
      "scene_title":"Find the ticket desk",
      "situation":"Politely ask where to buy a ticket to the city center.",
      "goals":["Formulate a polite question","Use transport vocabulary"],
      "expected_keywords":["where","ticket","city center"],
      "hints":["Start with 'Excuse me…'","Include the word 'ticket'"],
      "vocab":[{"term":"ticket desk","translation":"guichet"},{"term":"one-way","translation":"aller simple"}]
    },
    {
      "id":"scene2",
      "scene_title":"Choose the ticket",
      "situation":"Ask for a return ticket for today and check the platform.",
      "goals":["Specify ticket type","Ask for the platform"],
      "expected_keywords":["return","today","platform"],
      "hints":["Say 'return ticket'","Ask: 'Which platform?'"],
      "vocab":[{"term":"platform","translation":"quai"},{"term":"timetable","translation":"horaire"}]
    },
    {
      "id":"scene3",
      "scene_title":"Unexpected situation",
      "situation":"The train is delayed. Ask about the delay and an alternative.",
      "goals":["Ask politely","Understand the alternative"],
      "expected_keywords":["delay","how long","alternative/next train"],
      "hints":["Ask 'How long?'","'Is there another train?'"],
      "vocab":[{"term":"delay","translation":"retard"},{"term":"connection","translation":"correspondance"}]
    }
  ];
}
