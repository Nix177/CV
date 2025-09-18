// /api/chat — chat CV/Profil (FR)
// - lit public/profile.json (màj facile)
// - le prompt système priorise ces données
// - répond en FR, nuance les niveaux (ex: langues) sans exagérer
// - pointe vers /CV_Nicolas_Tuor.pdf si l’utilisateur évoque le CV

import fs from "fs";
import path from "path";

const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const API_KEY = process.env.OPENAI_API_KEY;

let PROFILE = null;
function loadProfile() {
  if (PROFILE) return PROFILE;
  const p = path.join(process.cwd(), "public", "profile.json");
  try {
    const raw = fs.readFileSync(p, "utf8");
    PROFILE = JSON.parse(raw);
  } catch (e) {
    PROFILE = { name: "Nicolas Tuor", cv_link: "/CV_Nicolas_Tuor.pdf", summary: "" };
  }
  return PROFILE;
}

function systemPrompt(profile) {
  const cvLink = profile.cv_link || "/CV_Nicolas_Tuor.pdf";
  return `
Tu es l'assistant de candidature de **Nicolas Tuor**. Tu réponds **en français** de façon précise, synthétique et factuelle.
Tu disposes d'un profil structuré (ci-dessous). Tu t'appuies prioritairement sur ces informations.
- Si l'utilisateur pose une question sur le CV, réponds à partir du profil et indique le lien: ${cvLink}.
- Pour les langues, indique le niveau d'usage tel que présent dans le profil et ajoute de manière honnête que le candidat apprend rapidement (sans survendre).
- Si une information n'apparaît pas, dis-le simplement (pas d'invention). Tu peux extrapoler à partir des données à ta disposition mais tu dois le dire.

=== PROFIL STRUCTURÉ ===
${JSON.stringify(profile, null, 2)}
`.trim();
}

async function openAIChat(messages) {
  if (!API_KEY) {
    // Mode dégradé : simple echo pour éviter de casser en dev local
    const last = messages[messages.length - 1]?.content || "";
    return { role: "assistant", content: "Mode local : je n’ai pas accès au modèle. Demande : " + last };
  }
  const r = await fetch("https://api.openai.com/v1/chat/completions",{
    method:"POST",
    headers:{ "content-type":"application/json", "authorization":"Bearer "+API_KEY },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.2,
      messages
    })
  });
  if(!r.ok){
    const text = await r.text().catch(()=>String(r.status));
    throw new Error("OpenAI error: "+text);
  }
  const json = await r.json();
  const msg = json?.choices?.[0]?.message || { role:"assistant", content:"(réponse vide)" };
  return msg;
}

export default async function handler(req, res){
  try{
    const profile = loadProfile();
    const body = req.method === "POST" ? (await req.json?.().catch(()=>null) || req.body) : null;
    const userText = (body && body.message) || (req.query && req.query.q) || "";
    const history = (body && Array.isArray(body.history) && body.history) || [];

    const messages = [
      { role:"system", content: systemPrompt(profile) },
      ...history.slice(-6),
      { role:"user", content: userText }
    ];
    const answer = await openAIChat(messages);
    res.status(200).json({ ok:true, answer });
  }catch(e){
    res.status(200).json({ ok:false, error: String(e?.message||e) });
  }
}
