export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    const { lang="anglais", level="A1", topic="vie quotidienne", count=10, language="fr" } = req.body || {};

    const prompt = `
Tu es un coach de vocabulaire. Langue cible: ${lang}. Niveau ${level}. Thème: ${topic}.
Retourne STRICTEMENT le JSON suivant:
{
  "items": [
    { "term": "mot dans la langue cible",
      "translation": "traduction en ${language}",
      "example": "phrase simple illustrant l'usage",
      "tip": "mnémotechnique ou dérivation" }
  ]
}
- ${count} items maximum.
- Tout en ${language}, sauf "term" dans la langue cible.
    `.trim();

    const j = await callOpenAIJSON(prompt);
    if (!j?.items) throw new Error("bad-json");
    res.status(200).json(j);
  } catch (err) {
    console.error("vocab:", err);
    res.status(200).json({ items: [] });
  }
}

async function callOpenAIJSON(prompt) {
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Tu renvoies du JSON strictement valide et rien d'autre." },
        { role: "user", content: prompt }
      ],
      temperature: 0.7,
    })
  });
  const data = await r.json();
  const text = data?.choices?.[0]?.message?.content || "{}";
  try { return JSON.parse(text); } catch { return {}; }
}
