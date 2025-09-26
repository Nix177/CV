// api/chat.js — Backend stable pour /api/chat
// - Sans dépendances externes (fetch global Node 18+)
// - ESM (export default) pour Vercel/Node 18
// - Jamais de 500: fallback texte si OPENAI_API_KEY absent ou échec LLM

import fs from "node:fs";
import path from "node:path";

// --- Config ---
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || ""; // renseigner dans Vercel -> Settings -> Environment Variables
const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

// --- Utils ---
function safeReadPublic(rel) {
  try {
    const p = path.join(process.cwd(), "public", rel);
    if (fs.existsSync(p)) return fs.readFileSync(p, "utf8");
  } catch {/* ignore */}
  return "";
}
function safeReadJSON(rel) {
  try {
    const raw = safeReadPublic(rel);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

function normLang(l) {
  const s = String(l || "fr").slice(0,2).toLowerCase();
  return ["fr","en","de"].includes(s) ? s : "fr";
}
function langName(lc) {
  return lc === "en" ? "English" : (lc === "de" ? "German" : "French");
}
function libertyGuidelines(level, lc) {
  if (lc === "en") {
    return level === 0
      ? "Answer strictly with facts from CV/profile. No inference."
      : level === 1
      ? "Prudent mode: you may connect obvious dots without strong inference. Do not invent facts."
      : "Interpretative mode: you may cautiously infer and mark such parts as (Deduction). Never invent credentials.";
  }
  if (lc === "de") {
    return level === 0
      ? "Antworten Sie streng faktenbasiert aus CV/Profil. Keine Schlussfolgerungen."
      : level === 1
      ? "Vorsichtig: Offensichtliche Verknüpfungen sind erlaubt, aber keine starken Schlussfolgerungen. Nichts erfinden."
      : "Interpretativer Modus: vorsichtige Schlussfolgerungen erlaubt, kennzeichnen Sie diese als (Schlussfolgerung). Keine Qualifikationen erfinden.";
  }
  // FR
  return level === 0
    ? "Répondez strictement avec des faits issus du CV/profil. Aucune inférence."
    : level === 1
    ? "Mode prudent : connexions raisonnables possibles, sans extrapolations fortes. Ne rien inventer."
    : "Mode interprétatif : vous pouvez inférer avec prudence et signaler ces parties par (Déduction). N'inventez jamais des diplômes.";
}
function conciseHint(concise, lc) {
  if (!concise) return "";
  return lc === "en" ? "Keep it concise (2–4 sentences)."
       : lc === "de" ? "Bitte prägnant antworten (2–4 Sätze)."
       : "Réponse concise (2–4 phrases).";
}

function makeSystem(lc, liberty, concise) {
  const ln = langName(lc);
  const rules = libertyGuidelines(liberty, lc);
  const short = conciseHint(concise, lc);
  return [
    `You are a recruiting assistant for Nicolas Tuor.`,
    `Always answer ONLY in ${ln}. If the user writes in another language, translate and answer in ${ln}.`,
    `Liberty level: ${liberty}. ${rules}`,
    short,
    `Style: helpful, professional, clear. Mark inferred parts as (Deduction)/(Déduction)/(Schlussfolgerung) depending on language.`
  ].filter(Boolean).join("\n");
}

function makeUserBlock(message, profile, cvText, lc) {
  const labelQ = lc === "en" ? "USER QUESTION" : lc === "de" ? "BENUTZERFRAGE" : "QUESTION UTILISATEUR";
  const labelP = lc === "en" ? "PROFILE (JSON summary)" : lc === "de" ? "PROFIL (JSON-Zusammenfassung)" : "PROFIL (résumé JSON)";
  const labelC = lc === "en" ? "CV TEXT" : lc === "de" ? "LEBENSLAUF-TEXT" : "TEXTE DU CV";
  return [
    `### ${labelQ}\n${message}`,
    profile ? `\n\n### ${labelP}\n${JSON.stringify(profile, null, 2)}` : "",
    cvText  ? `\n\n### ${labelC}\n${cvText}` : ""
  ].join("");
}

async function callOpenAI(messages, temperature) {
  if (!OPENAI_API_KEY) {
    return { ok:false, error:"Missing OPENAI_API_KEY" };
  }
  const r = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "authorization": `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({ model: MODEL, messages, temperature })
  });
  if (!r.ok) {
    return { ok:false, error:`OpenAI HTTP ${r.status}` };
  }
  const json = await r.json();
  const text = json?.choices?.[0]?.message?.content?.trim() || "";
  return { ok:true, text };
}

// --- Fallback local si LLM indisponible ---
function fallbackAnswer(q, lc, profile, cvText, liberty, concise) {
  const L = lc || "fr";
  const P = profile || {};
  const interests = P.interests || P.interets || P.hobbies || [];
  const langs = P.languages || P.langues || [];
  const skills = P.skills || P.competences || {};
  const summary = P.summary || P.resume || "";

  function t(fr, en, de) {
    return L === "en" ? en : L === "de" ? de : fr;
  }

  const ql = (q||"").toLowerCase();
  if (/(hobby|hobbies|intere|int[eé]r[ée]t|loisir)/i.test(ql)) {
    const list = Array.isArray(interests) ? interests : [];
    const text = list.length ? list.join(", ") : t(
      "Centres d’intérêt généraux mentionnés dans le profil et le CV.",
      "General interests mentioned in the profile and CV.",
      "Allgemeine Interessen laut Profil und Lebenslauf."
    );
    return t(
      `Centres d'intérêt : ${text}.`,
      `Hobbies/Interests: ${text}.`,
      `Hobbys/Interessen: ${text}.`
    );
  }
  if (/(langue|language|sprache)/i.test(ql)) {
    const arr = Array.isArray(langs) ? langs.map(o => o.name || o.langue || "").filter(Boolean) : [];
    const text = arr.length ? arr.join(", ") : t("Français (natif), Anglais, Allemand (niveau variable).", "French (native), English, German (varying proficiency).", "Französisch (Muttersprache), Englisch, Deutsch (unterschiedliche Niveaus).");
    return t(
      `Langues : ${text}.`,
      `Languages: ${text}.`,
      `Sprachen: ${text}.`
    );
  }
  if (/(comp[eé]tenc|skill|f[aä]higkeit)/i.test(ql)) {
    const flat = [];
    if (Array.isArray(skills.pedagogy)) flat.push(...skills.pedagogy);
    if (Array.isArray(skills.tech))     flat.push(...skills.tech);
    if (Array.isArray(skills.project))  flat.push(...skills.project);
    const text = flat.length ? flat.slice(0,8).join(", ") : (summary || t("Compétences pédagogiques et numériques.", "Educational and digital skills.", "Pädagogische und digitale Kompetenzen."));
    return t(
      `Compétences clés : ${text}.`,
      `Key skills: ${text}.`,
      `Zentrale Kompetenzen: ${text}.`
    );
  }
  // défaut
  return t(
    "Je peux répondre sur ses compétences, langues, expériences, centres d’intérêt ou projets. Précisez votre question.",
    "I can answer about skills, languages, experiences, interests or projects. Please specify.",
    "Ich kann zu Kompetenzen, Sprachen, Erfahrungen, Interessen oder Projekten antworten. Bitte konkretisieren."
  );
}

// --- Handler principal ---
export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      // utile pour tester rapidement l’API
      return res.status(200).json({ ok:true, ping:"pong" });
    }

    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const message = String(body.message || "").trim();
    const liberty = Number(body.liberty ?? 2) || 2;     // 0/1/2
    const concise = !!body.concise;
    const lang = normLang(body.lang || "fr");

    if (!message) {
      return res.status(200).json({ ok:true, answer:{role:"assistant", content:""}, used:{ liberty, concise, lang, hasProfile:false, hasCvText:false, cvLink:"/CV_Nicolas_Tuor.pdf" }});
    }

    // Charge le profil et le CV texte (optionnels)
    const profile = safeReadJSON("profile.json");
    const cvText  = safeReadPublic("cv-text.txt");
    const hasProfile = !!profile;
    const hasCvText  = !!cvText;

    // Si pas de clé → fallback local (pas de 500)
    if (!OPENAI_API_KEY) {
      const text = fallbackAnswer(message, lang, profile, cvText, liberty, concise);
      return res.status(200).json({
        ok: true,
        answer: { role:"assistant", content: text },
        used: { liberty, concise, lang, hasProfile, hasCvText, cvLink: "/CV_Nicolas_Tuor.pdf", engine:"fallback" }
      });
    }

    // Compose prompts
    const system = makeSystem(lang, liberty, concise);
    const user   = makeUserBlock(message, profile, cvText, lang);
    const temperature = liberty === 2 ? 0.7 : 0.3;

    // Appel OpenAI (protégé)
    const out = await callOpenAI(
      [
        { role:"system", content: system },
        { role:"user",   content: user }
      ],
      temperature
    );

    if (!out.ok) {
      // Fallback si l’API plante
      const text = fallbackAnswer(message, lang, profile, cvText, liberty, concise);
      return res.status(200).json({
        ok: true,
        answer: { role:"assistant", content: text },
        used: { liberty, concise, lang, hasProfile, hasCvText, cvLink: "/CV_Nicolas_Tuor.pdf", engine:"fallback", error: out.error }
      });
    }

    return res.status(200).json({
      ok: true,
      answer: { role:"assistant", content: out.text },
      used: { liberty, concise, lang, hasProfile, hasCvText, cvLink: "/CV_Nicolas_Tuor.pdf", engine:"openai" }
    });

  } catch (e) {
    // Dernier filet : NE PAS envoyer 500, renvoyer un fallback
    const lang = "fr";
    const profile = safeReadJSON("profile.json");
    const cvText  = safeReadPublic("cv-text.txt");
    const text = fallbackAnswer("", lang, profile, cvText, 1, false);
    return res.status(200).json({
      ok: true,
      answer: { role:"assistant", content: text },
      used: { liberty:1, concise:false, lang, hasProfile:!!profile, hasCvText:!!cvText, cvLink:"/CV_Nicolas_Tuor.pdf", engine:"fallback", error:String(e) }
    });
  }
}
