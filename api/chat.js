// /api/chat — Assistant de candidature (FR) pour Nicolas Tuor
// - Lit public/profile.json (profil riche)
// - Lit public/cv-text.json (extraction texte du CV) si présent, sinon lien PDF
// - Paramètre "liberty" (0, 1, 2) pour doser l'interprétation
// - Le modèle répond en FR, explique quand il déduit/extrapole, reste prudent

import fs from "fs";
import path from "path";

// --- Modèle & Auth ---
const MODEL   = process.env.OPENAI_MODEL || "gpt-4o-mini";
const API_KEY = process.env.OPENAI_API_KEY;

// --- Cache mémoire basique ---
let PROFILE = null;
let CV_TEXT = null;
let CV_LINK = "/CV_Nicolas_Tuor.pdf";

// ----- Helpers de lecture fichiers -----
function readJSON(p) {
  try { return JSON.parse(fs.readFileSync(p, "utf8")); }
  catch { return null; }
}
function readText(p, max = 18000) {
  try {
    const raw = fs.readFileSync(p, "utf8");
    return raw.slice(0, max);
  } catch { return null; }
}

function loadProfile() {
  if (PROFILE) return PROFILE;
  const p = path.join(process.cwd(), "public", "profile.json");
  PROFILE = readJSON(p) || {
    name: "Nicolas Tuor",
    cv_link: CV_LINK,
    summary: "Profil synthétique indisponible. Voir le CV PDF.",
  };
  if (PROFILE.cv_link) CV_LINK = PROFILE.cv_link;
  return PROFILE;
}

function loadCvText() {
  if (CV_TEXT !== null) return CV_TEXT;
  const pJson = path.join(process.cwd(), "public", "cv-text.json");
  const pTxt  = path.join(process.cwd(), "public", "cv.txt");

  // priorité au JSON structuré si existant (ex: { text: "...", meta: {...} })
  const json = readJSON(pJson);
  if (json && (json.text || json.plain)) {
    CV_TEXT = (json.text || json.plain || "").slice(0, 20000);
    return CV_TEXT;
  }
  // sinon un txt à plat
  const txt = readText(pTxt, 20000);
  if (txt) {
    CV_TEXT = txt;
    return CV_TEXT;
  }
  // sinon pas d'extraction dispo => on utilisera le lien PDF dans le prompt
  CV_TEXT = "";
  return CV_TEXT;
}

// ----- Prompt système en fonction de la "liberté" -----
function systemPrompt({ profile, cvText, liberty }) {
  // Règle d’interprétation :
  //   0 = strict / factuel / sobre
  //   1 = prudent / reformulation ok / petites inférences
  //   2 = interprétatif responsable / rapprocher & expliciter / signaler "Déduction"
  const tones = {
    0: "STRICT, factuel, concis. Aucune supposition. Si info absente : 'Je ne dispose pas de cette information.'",
    1: "PRUDENT : reformule clairement, fais de petites inférences raisonnables. Si tu infères, signale-le ('Déduction').",
    2: "INTERPRÉTATIF RESPONSABLE : tu peux rapprocher, relier, expliciter, donner des exemples ou analogies **en signalant clairement** quand c’est une déduction ('Déduction : ...'). Reste honnête.",
  };

  const cvPart = cvText
    ? `=== EXTRAIT TEXTE DU CV (pour référence) ===\n${cvText}\n=== FIN CV ===`
    : `Le texte intégral du CV n’est pas fourni ici. Lien : ${CV_LINK}`;

  return `
Tu es l’assistant de candidature de **Nicolas Tuor**. Tu réponds **en français**.
Ton style dépend du niveau de *Liberté* demandé : ${tones[liberty]}

1) T’appuyer **en priorité** sur le PROFIL structuré ci-dessous.
2) T’appuyer ensuite sur le texte du CV s’il est présent (ou mentionner le lien PDF si besoin).
3) Quand tu **infères/interprètes** (niveau 1 ou 2), **signale-le** explicitement : commence la phrase par "Déduction : ...".
4) Ne sur-vends pas. Sois précis, utile, et adapté à un contexte de recrutement.
5) Si l’utilisateur demande de "citer le CV", tire tes éléments de la section CV (ou renvoie au PDF si texte non fourni).

=== PROFIL STRUCTURÉ ===
${JSON.stringify(profile, null, 2)}

${cvPart}
`.trim();
}

// ----- Appel OpenAI -----
async function openAIChat(messages, temperature) {
  if (!API_KEY) {
    const last = messages[messages.length - 1]?.content || "";
    return { role: "assistant", content: "(mode local sans clé) " + last };
  }

  const r = await fetch("https://api.openai.com/v1/chat/completions",{
    method: "POST",
    headers: {
      "content-type": "application/json",
      "authorization": "Bearer " + API_KEY
    },
    body: JSON.stringify({
      model: MODEL,
      temperature,
      messages
    })
  });

  if (!r.ok) {
    const text = await r.text().catch(()=>String(r.status));
    throw new Error("OpenAI error: " + text);
  }
  const json = await r.json();
  return json?.choices?.[0]?.message || { role: "assistant", content: "(réponse vide)" };
}

// ----- Handler API -----
export default async function handler(req, res) {
  try {
    // body & query
    const body    = req.method === "POST"
      ? (await req.json?.().catch(()=>null) || req.body || {})
      : {};
    const message = (body.message || req.query.q || "").toString();
    const history = Array.isArray(body.history) ? body.history.slice(-8) : [];
    const liberty = Math.max(0, Math.min(2, Number(body.liberty ?? req.query.liberty ?? 1)));

    // charge données
    const profile = loadProfile();
    const cvText  = loadCvText();

    // mapping liberté -> température
    const temp = liberty === 0 ? 0.1 : liberty === 1 ? 0.3 : 0.6;

    const messages = [
      { role: "system", content: systemPrompt({ profile, cvText, liberty }) },
      ...history.map(x => ({ role: x.role || "user", content: String(x.content||"") })),
      { role: "user", content: message }
    ];

    const answer = await openAIChat(messages, temp);

    res.status(200).json({
      ok: true,
      answer,
      used: {
        liberty,
        temperature: temp,
        hasProfile: !!profile,
        hasCvText: !!cvText && cvText.length > 0,
        cvLink: CV_LINK
      }
    });
  } catch (e) {
    res.status(200).json({ ok:false, error: String(e?.message || e) });
  }
}
