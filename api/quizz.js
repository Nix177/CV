// /api/quiz.js
export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
    if (!process.env.OPENAI_API_KEY) return res.status(500).json({ error: "OPENAI_API_KEY missing" });

    const { topic = "pensée critique", lang = "fr" } = await req.json?.() || req.body || {};
    const locale = { fr:"Français", en:"English", de:"Deutsch" }[lang] || "Français";

    const prompt = `
Génère un petit quiz JSON minimal (exactement 3 questions) en ${locale}.
Format JSON strict:
{
  "questions":[
    {"q":"texte","choices":["A","B","C"],"ok":1,"why":"explication courte"},
    ...
  ]
}
Sujet: ${topic}
    `.trim();

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method:"POST",
      headers:{ "Authorization":`Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type":"application/json" },
      body: JSON.stringify({ model:"gpt-4o-mini", messages:[{role:"user", content: prompt}], temperature:0.5 })
    });

    const j = await r.json();
    if (!r.ok) return res.status(500).json({ error: j.error?.message || "OpenAI error" });

    let data = {};
    try { data = JSON.parse(j.choices?.[0]?.message?.content || "{}"); }
    catch { return res.status(500).json({ error: "Bad JSON from model" }); }

    res.status(200).json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
}
