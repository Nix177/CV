export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    const { question="", topic="", age=12, per="", language="fr" } = req.body || {};
    const prompt = `
Explique clairement en ${language}, adapté à ${age} ans, la démarche pour répondre à la question suivante (sans donner la réponse si c'est un QCM, mais en guidant pas à pas) :
Question: "${question}"
Thème: "${topic}" ${per ? `(PER: ${per})` : ""}
    `.trim();

    const text = await callOpenAIText(prompt);
    res.status(200).json({ explain: text });
  } catch (err) {
    console.error("quiz-explain:", err);
    res.status(200).json({ explain: "Explication indisponible pour l'instant." });
  }
}

async function callOpenAIText(prompt) {
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Aide pédagogique claire et courte." },
        { role: "user", content: prompt }
      ],
      temperature: 0.6,
    })
  });
  const data = await r.json();
  return data?.choices?.[0]?.message?.content?.trim() || "";
}
