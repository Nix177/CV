// /api/chat — Assistant de candidature (FR) pour Nicolas Tuor

import fs from "fs";
import path from "path";

const MODEL   = process.env.OPENAI_MODEL || "gpt-4o-mini";
const API_KEY = process.env.OPENAI_API_KEY;

let PROFILE = null;
let CV_TEXT = null;
let CV_LINK = "/CV_Nicolas_Tuor.pdf";

function readJSON(p){ try{ return JSON.parse(fs.readFileSync(p,"utf8")); }catch{ return null; } }
function readText(p,max=20000){ try{ return fs.readFileSync(p,"utf8").slice(0,max); }catch{ return null; } }

function loadProfile(){
  if (PROFILE) return PROFILE;
  const p = path.join(process.cwd(),"public","profile.json");
  PROFILE = readJSON(p) || { name:"Nicolas Tuor", cv_link: CV_LINK, summary:"Profil synthétique indisponible. Voir le CV PDF." };
  if (PROFILE.cv_link) CV_LINK = PROFILE.cv_link;
  return PROFILE;
}

function loadCvText(){
  if (CV_TEXT !== null) return CV_TEXT;

  // 1) JSON structuré (optionnel)
  const pJson = path.join(process.cwd(),"public","cv-text.json");
  const j = readJSON(pJson);
  if (j && (j.text || j.plain)){
    CV_TEXT = String(j.text || j.plain).slice(0,20000);
    return CV_TEXT;
  }

  // 2) TXT à plat (supporte cv-text.txt ou cv.txt)
  const pTxt1 = path.join(process.cwd(),"public","cv-text.txt");
  const pTxt2 = path.join(process.cwd(),"public","cv.txt");
  CV_TEXT = readText(pTxt1,20000) || readText(pTxt2,20000) || "";
  return CV_TEXT;
}

function systemPrompt({ profile, cvText, liberty }){
  const tones = {
    0: "STRICT, factuel, concis. Aucune supposition. Si info absente : « Je ne dispose pas de cette information. »",
    1: "PRUDENT : reformule clairement, petites inférences raisonnables. Signale-les (« Déduction : … »).",
    2: "INTERPRÉTATIF RESPONSABLE : rapproche, explicite, donne exemples/analogies **en signalant** « Déduction : … ». Reste honnête."
  };

  const cvPart = cvText
    ? `=== EXTRAIT TEXTE DU CV ===\n${cvText}\n=== FIN CV ===`
    : `Texte de CV non fourni ici. Lien PDF : ${CV_LINK}`;

  return `
Tu es l’assistant de candidature de **Nicolas Tuor**. Tu réponds **en français**.
Niveau de Liberté : ${tones[liberty]}

Règles :
1) Appuie-toi d’abord sur le PROFIL (structuré ci-dessous), puis sur le texte du CV.
2) Quand tu infères/interprètes (liberté 1 ou 2), commence la phrase par **« Déduction : »**.
3) Ne sur-vends pas ; réponds utilement pour un recruteur. Si on te demande de « citer le CV », utilise la section CV ou renvoie au PDF.

=== PROFIL ===
${JSON.stringify(profile,null,2)}

${cvPart}
`.trim();
}

async function openAIChat(messages, temperature){
  if (!API_KEY){
    const last = messages[messages.length-1]?.content || "";
    return { role:"assistant", content:"(mode local sans clé) " + last };
  }
  const r = await fetch("https://api.openai.com/v1/chat/completions",{
    method:"POST",
    headers:{ "content-type":"application/json","authorization":"Bearer "+API_KEY },
    body: JSON.stringify({ model: MODEL, temperature, messages })
  });
  if(!r.ok){
    const t = await r.text().catch(()=>String(r.status));
    throw new Error("OpenAI error: "+t);
  }
  const j = await r.json();
  return j?.choices?.[0]?.message || { role:"assistant", content:"(réponse vide)" };
}

export default async function handler(req,res){
  try{
    // Lecture body robuste (Vercel parse déjà req.body)
    const body = req.method==="POST" ? (req.body || {}) : {};
    const message = String(body.message || req.query.q || "");
    const history = Array.isArray(body.history) ? body.history.slice(-8) : [];
    const liberty = Math.max(0,Math.min(2, Number(body.liberty ?? req.query.liberty ?? 1)));

    const profile = loadProfile();
    const cvText  = loadCvText();
    const temp    = liberty===0 ? 0.1 : liberty===1 ? 0.3 : 0.6;

    const messages = [
      { role:"system", content: systemPrompt({ profile, cvText, liberty }) },
      ...history.map(h=>({ role: h.role||"user", content: String(h.content||"") })),
      { role:"user", content: message }
    ];

    const answer = await openAIChat(messages, temp);
    res.status(200).json({
      ok:true, answer,
      used: { liberty, temperature: temp, hasProfile: !!profile, hasCvText: !!cvText && cvText.length>0, cvLink: CV_LINK }
    });
  }catch(e){
    res.status(200).json({ ok:false, error:String(e?.message||e) });
  }
}
