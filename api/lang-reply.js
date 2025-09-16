// Évalue la réponse utilisateur pour une scène donnée.
// Avec clé OpenAI: feedback/explication IA ; sans clé: heuristique locale (keywords).
export default async function handler(req, res){
  try{
    if (req.method !== "POST"){
      res.setHeader("Allow","POST");
      return res.status(405).json({ error:"Method not allowed" });
    }
    const { lang="en", scene={}, user_text="", explain=false, hint=false } = req.body || {};

    // Fallback heuristique direct si pas de clé
    if (!process.env.OPENAI_API_KEY){
      return res.status(200).json(heuristicEval(lang, scene, user_text, { explain, hint }));
    }

    // Appel OpenAI pour l'évaluation/correction/feedback + prochaine ligne PNJ
    const sys = [
      "You are a language tutor inside a short game. Return ONLY JSON.",
      lang==="fr" ? "Parlez poliment (vouvoiement) en français." : "",
      lang==="de" ? "Sprechen Sie im Deutschen in der Sie-Form." : ""
    ].join(" ");

    const user = `
Évaluez la réponse d'un apprenant dans la langue cible "${lang}".
Contexte de scène:
- Titre: ${scene.scene_title||""}
- Consigne: ${scene.situation||""}
- Objectifs: ${(scene.goals||[]).join(" | ")}
- Mots-clés attendus: ${(scene.expected_keywords||[]).join(", ")}
Réponse de l'apprenant: """${user_text}"""

Retournez STRICTEMENT du JSON:
{
  "ok": true/false,
  "met_goals": ["nom objectifs atteints"],
  "feedback": "1-2 phrases polies dans la langue cible. Expliquez en bref.",
  "correction": "phrase corrigée si besoin, sinon null",
  "npc_line": "prochaine réplique role-play du tuteur (langue cible, ton naturel, poli).",
  "hint": ${hint ? '"indice concis basé sur expected_keywords"' : "null"},
  "done": true/false,
  "score_inc": number
}
Contraintes:
- Marquez "done": true si la réponse répond suffisamment à la consigne (pas besoin d'être parfaite).
- score_inc: 20 si done, sinon 5 (encouragement).
- "feedback" et "npc_line" DOIVENT être en langue cible (${lang}).
- "correction": si la phrase a des erreurs notables, proposez une reformulation correcte (1 phrase).
${explain ? '- Ajoutez dans "feedback" une explication claire des points clés.' : ''}
`.trim();

    const data = await callOpenAI(sys, user);
    const out = safeParseJSON(data) || {};
    // garde-fous min
    if (typeof out.ok !== "boolean"){
      return res.status(200).json(heuristicEval(lang, scene, user_text, { explain, hint }));
    }
    // bornes
    out.score_inc = clampNumber(out.score_inc, 0, 30, 10);
    if (typeof out.done !== "boolean") out.done = out.ok;
    return res.status(200).json(out);

  } catch(err){
    console.error("lang-reply error:", err);
    return res.status(200).json(heuristicEval("en", {}, "", {}));
  }
}

function clampNumber(n, min, max, def){ n = +n; return isFinite(n) ? Math.max(min, Math.min(max, n)) : def; }

async function callOpenAI(system, user){
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.4,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ]
    })
  });
  const j = await r.json();
  return j?.choices?.[0]?.message?.content || "{}";
}

function safeParseJSON(s){ try{ return JSON.parse(s); }catch{ return null; } }

// Fallback local (sans IA)
function heuristicEval(lang, scene={}, user_text="", { explain=false, hint=false }={}){
  const clean = (s)=> (s||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
  const u = clean(user_text);
  const kws = (scene.expected_keywords||[]).map(clean);
  let hit = 0; kws.forEach(k=>{ if(k && u.includes(k)) hit++; });
  const ok = hit >= Math.max(1, Math.ceil(kws.length/2));

  const lineOK = (lang==="fr")?"Très bien, merci.":"Gut, danke.";
  const lineKO = (lang==="fr")?"Je vous propose une reformulation :":"Ich schlage eine Umformulierung vor:";

  const corrFR = "Exemple possible : « Excusez-moi, où puis-je acheter un billet pour le centre-ville ? »";
  const corrDE = "Beispiel: „Entschuldigen Sie, wo kann ich ein Ticket für das Stadtzentrum kaufen?“";
  const corrEN = "Possible: “Excuse me, where can I buy a ticket to the city center?”";

  const out = {
    ok,
    met_goals: ok ? (scene.goals||[]) : [],
    feedback: ok
      ? (lang==="fr"?"✅ Votre réponse répond à la consigne.":"✅ Ihre Antwort passt zur Aufgabe.")
      : (lang==="fr"?"❌ Il manque certains éléments clés.":"❌ Einige Schlüsselteile fehlen."),
    correction: ok ? null : (lang==="fr"?corrFR:(lang==="de"?corrDE:corrEN)),
    npc_line: ok ? lineOK : lineKO,
    hint: hint ? ((scene.hints && scene.hints[0]) || ((lang==="fr")?"Utilisez un ton poli et un mot-clé du thème.":"Benutzen Sie die Höflichkeitsform und ein thematisches Schlüsselwort.")) : null,
    done: ok,
    score_inc: ok ? 20 : 5
  };

  if (explain){
    out.feedback += (lang==="fr")
      ? " Objectifs : ton poli et au moins deux mots-clés attendus."
      : (lang==="de")
      ? " Ziele: höflicher Ton und mindestens zwei erwartete Schlüsselwörter."
      : " Goals: polite tone and at least two expected keywords.";
  }
  return out;
}
