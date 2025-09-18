// api/chat.js — LLM endpoint with hard language enforcement
// Works on Vercel or Node/Express. Requires OPENAI_API_KEY.

const fs = require("fs");
const path = require("path");
const fetch = require("node-fetch");

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini"; // mettez votre modèle

// -- Util
function safeReadPublic(rel) {
  try {
    const p = path.join(process.cwd(), "public", rel);
    if (fs.existsSync(p)) return fs.readFileSync(p, "utf-8");
  } catch { /* ignore */ }
  return "";
}
function safeReadJSON(rel) {
  try {
    const raw = safeReadPublic(rel);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

function langNameOf(code) {
  switch ((code||"fr").toLowerCase()) {
    case "en": return "English";
    case "de": return "German";
    default:   return "French";
  }
}

function libertyGuidelines(level, langCode) {
  if (langCode === "en") {
    return level === 0 ? 
      "Answer strictly with facts from CV or profile. No inference." :
      level === 1 ?
      "Be prudent: you may gently connect dots when reasonable, but avoid strong inference. Do not invent facts." :
      "Interpretative mode allowed: you may infer cautiously and mark such parts as (Deduction). Never invent credentials.";
  }
  if (langCode === "de") {
    return level === 0 ?
      "Antworten Sie streng faktenbasiert aus CV/Profil. Keine Schlussfolgerungen." :
      level === 1 ?
      "Vorsichtig: Sie dürfen vorsichtig Verbindungen ziehen, aber keine starken Schlussfolgerungen. Nichts erfinden." :
      "Interpretativer Modus erlaubt: Sie dürfen vorsichtig schlussfolgern und solche Teile als (Schlussfolgerung) kennzeichnen. Niemals Qualifikationen erfinden.";
  }
  // FR par défaut
  return level === 0 ?
    "Répondez strictement avec des faits issus du CV/profil. Aucune inférence." :
    level === 1 ?
    "Mode prudent : connexions raisonnables possibles, sans extrapolations fortes. Ne rien inventer." :
    "Mode interprétatif autorisé : vous pouvez inférer avec prudence et signaler ces parties par (Déduction). N'inventez jamais des diplômes.";
}

function conciseHint(concise, langCode) {
  if (!concise) return "";
  if (langCode === "en") return "Keep the answer concise (2–4 sentences).";
  if (langCode === "de") return "Antworten Sie prägnant (2–4 Sätze).";
  return "Réponse concise (2–4 phrases).";
}

// Compose system prompt
function makeSystem(langCode, liberty, concise) {
  const ln = langNameOf(langCode);
  const rules = libertyGuidelines(liberty, langCode);
  const short = conciseHint(concise, langCode);

  return [
`You are a recruiting assistant for Nicolas Tuor.
Always answer ONLY in ${ln}. Never switch language unless explicitly asked.
If the user writes in another language, translate and answer in ${ln}.`,
`Liberty level: ${liberty}. ${rules}`,
short,
`Style: helpful, professional, clear. If you make a deduction at liberty=2, mark it with (Deduction) / (Déduction) / (Schlussfolgerung) depending on the target language.`
  ].filter(Boolean).join("\n");
}

function makeUserBlock(message, profile, cvText, langCode) {
  const header = langCode === "en" ? "USER QUESTION"
               : langCode === "de" ? "BENUTZERFRAGE"
               : "QUESTION UTILISATEUR";
  const pLabel = langCode === "en" ? "PROFILE (structured JSON summary)"
               : langCode === "de" ? "PROFIL (strukturierte JSON-Zusammenfassung)"
               : "PROFIL (résumé JSON structuré)";
  const cLabel = langCode === "en" ? "CV TEXT"
               : langCode === "de" ? "LEBENSLAUF-TEXT"
               : "TEXTE DU CV";

  return [
    `### ${header}\n${message}`,
    profile ? `\n\n### ${pLabel}\n${JSON.stringify(profile, null, 2)}` : "",
    cvText  ? `\n\n### ${cLabel}\n${cvText}` : ""
  ].join("");
}

async function callOpenAI(messages, temperature = 0.4) {
  if (!OPENAI_API_KEY) {
    return { ok:false, error: "Missing OPENAI_API_KEY" };
  }
  const body = {
    model: MODEL,
    messages,
    temperature
  };
  const r = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "authorization": `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify(body)
  });
  if (!r.ok) {
    return { ok:false, error: `OpenAI HTTP ${r.status}` };
  }
  const json = await r.json();
  const text = json?.choices?.[0]?.message?.content?.trim() || "";
  return { ok:true, text };
}

// ------------- Handler -------------
async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok:false, error:"Method Not Allowed" });
    }

    const { message, liberty = 2, concise = false, lang = "fr" } = req.body || {};
    if (!message || typeof message !== "string") {
      return res.status(400).json({ ok:false, error:"Missing message" });
    }
    const L = (["fr","en","de"].includes((lang||"fr").toLowerCase()) ? lang.toLowerCase() : "fr");

    // Charge le profil et le CV text (si présents)
    const profile = safeReadJSON("profile.json");         // /public/profile.json
    const cvText = safeReadPublic("cv-text.txt");         // /public/cv-text.txt
    const hasProfile = !!profile;
    const hasCvText  = !!cvText;

    // Compose prompts
    const system = makeSystem(L, Number(liberty)||2, !!concise);
    const user   = makeUserBlock(message, profile, cvText, L);

    // Température : légèrement plus haute à liberté=2
    const temp = (Number(liberty)||2) === 2 ? 0.7 : 0.3;

    const { ok, text, error } = await callOpenAI([
      { role:"system", content: system },
      { role:"user",   content: user }
    ], temp);

    if (!ok) {
      return res.status(500).json({ ok:false, error: error || "LLM error" });
    }

    return res.status(200).json({
      ok: true,
      answer: { role:"assistant", content: text },
      used: {
        liberty: Number(liberty)||2,
        concise: !!concise,
        lang: L,
        hasProfile,
        hasCvText,
        cvLink: "/CV_Nicolas_Tuor.pdf"
      }
    });

  } catch (e) {
    return res.status(500).json({ ok:false, error: String(e) });
  }
}

// ---- Exports (Vercel / Express) ----
module.exports = handler;      // Node/Express: app.post("/api/chat", handler)
// Vercel / Next: décommentez si nécessaire
// export default handler;
