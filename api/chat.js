export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { question = "", lang = "fr" } = (await parseJSON(req)) || {};
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: "Missing OPENAI_API_KEY" });
    }
    if (!question.trim()) {
      return res.status(400).json({ error: "Empty question" });
    }

    const profile =
      "Profil: enseignant primaire (FR), didactique de l'informatique, pensée critique," +
      " usages responsables de l'IA, expériences variées; apprenant rapide et pragmatique.";

    const sys =
      `Tu es un assistant de candidature. Reste concis, honnête, factuel, sans exagérer. ` +
      `Si on te demande quelque chose hors expertise, admets les limites et propose d'apprendre rapidement. ` +
      `Langue: ${lang}. Utilise le profil du candidat fourni. ` +
      `Structure: 1–2 phrases claires; éventuellement puces courtes. ` +
      `N'invente pas d'expériences non mentionnées.`;

    const payload = {
      model: "gpt-4o-mini",
      temperature: 0.4,
      max_tokens: 600,
      messages: [
        { role: "system", content: sys },
        { role: "user", content: `Contexte candidat: ${profile}` },
        { role: "user", content: `Question: ${question}` }
      ]
    };

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      const msg = data?.error?.message || "OpenAI error";
      return res.status(500).json({ error: msg });
    }

    const answer = data?.choices?.[0]?.message?.content || "";
    return res.status(200).json({ answer });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Chat error", detail: String(err) });
  }
}

function parseJSON(req) {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch {
        resolve({});
      }
    });
  });
}
