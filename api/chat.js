// /api/chat.js
export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

    const { question, lang } = await req.json?.() || req.body || {};
    if (!process.env.OPENAI_API_KEY) return res.status(500).json({ error: "OPENAI_API_KEY missing" });
    if (!question) return res.status(400).json({ error: "Missing question" });

    const sys = {
      fr: "Tu es un assistant de candidature. Réponds brièvement et concrètement à partir de ce profil: Enseignant primaire CH, didactique de l’informatique (master), guidage progressif, évaluation, intégration responsable de l’IA (Python, HTML/CSS/JS, Moodle). Parle en français.",
      en: "You are a hiring assistant. Answer briefly and concretely based on this profile: Swiss primary school teacher, master's in CS didactics, scaffolding, assessment, responsible use of AI (Python, HTML/CSS/JS, Moodle). Reply in English.",
      de: "Du hilfst bei Bewerbungen. Antworte kurz und konkret auf Basis dieses Profils: Primarlehrer CH, Master in Informatikdidaktik, Scaffolding, Beurteilung, verantwortungsvoller KI-Einsatz (Python, HTML/CSS/JS, Moodle). Antworte auf Deutsch."
    }[lang || "fr"];

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "system", content: sys }, { role: "user", content: question }],
        temperature: 0.4
      })
    });

    const json = await r.json();
    if (!r.ok) return res.status(500).json({ error: json.error?.message || "OpenAI error" });
    res.status(200).json({ answer: json.choices?.[0]?.message?.content?.trim() || "" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
