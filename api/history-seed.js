// Génère le "seed" d'une partie d'Histoire Aventure : titre, intro, questions.
// - Un seul appel IA par partie (coût maîtrisé).
// - Fallback intégré si OPENAI_API_KEY absent ou erreur.
export default async function handler(req, res){
  try{
    if (req.method !== "POST"){
      res.setHeader("Allow","POST");
      return res.status(405).json({ error:"Method not allowed" });
    }

    const { age=12, topic="Révolution française", lang="fr", count=3 } = req.body || {};
    const lc = Math.max(3, Math.min(6, +count||3));

    // Si pas de clé : fallback direct
    if (!process.env.OPENAI_API_KEY){
      return res.status(200).json(fallbackSeed(age, topic, lang));
    }

    const sys = [
      "Tu produis UNIQUEMENT un JSON valide et rien d'autre.",
      "Thème: Histoire, adapté au Plan d'études (âge donné).",
      "Évite les anachronismes ou inventions. Réponses factuelles.",
    ].join(" ");

    const prompt = `
Génère un JSON pour un mini-jeu de plateforme pédagogique historique, en ${lang}.
Paramètres: âge ${age}, thématique "${topic}". 
Structure STRICTE:

{
 "title": "Titre concis (époque/événement)",
 "intro": "2-3 phrases claires (registre ${lang==="de"?"Sie":"vous"}) expliquant le contexte et le but (répondre pour franchir les portes).",
 "badges": [ {"label": "Thématique courte"}, {"label": "Âge ${age}"} ],
 "facts": [
   {"q": "...", "choices": ["A","B","C"], "answer": "A", "explain": "phrase courte, claire"},
   {"q": "...", "choices": ["A","B","C"], "answer": "A", "explain": "phrase courte, claire"},
   {"q": "...", "choices": ["A","B","C"], "answer": "A", "explain": "phrase courte, claire"}
 ]
}

Contraintes:
- ${lc} questions maximum, 3 choix plausibles chacune.
- Ton professionnel, pédagogique, ${lang==="de"?"forme Sie":"forme de politesse (vous)"}.
- Pas d'ambiguïtés factuelles; dates et faits corrects.
- Aucune phrase hors JSON.
    `.trim();

    const data = await callOpenAI(sys, prompt);
    let out = safeParseJSON(data) || {};
    // garde-fous
    if (!out.title || !Array.isArray(out.facts) || out.facts.length < 1){
      out = fallbackSeed(age, topic, lang);
    }
    // coupe si trop long
    out.facts = out.facts.slice(0, lc);
    return res.status(200).json(out);

  } catch(err){
    console.error("history-seed error:", err);
    return res.status(200).json(fallbackSeed(12, "Révolution française", "fr"));
  }
}

async function callOpenAI(system, user){
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.6,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ]
    })
  });
  const j = await r.json();
  return j?.choices?.[0]?.message?.content || "{}";
}

function safeParseJSON(s){
  try{ return JSON.parse(s); }catch{ return null; }
}

function fallbackSeed(age, topic, lang){
  const t = topic || (lang==="fr" ? "Révolution française" : lang==="de" ? "Französische Revolution" : "French Revolution");
  const title = lang==="fr" ? `1789 — ${t}` : (lang==="de" ? `1789 — ${t}` : `1789 — ${t}`);
  const intro = (lang==="fr")
    ? "Vous explorez Paris en 1789. Pour franchir chaque porte, répondez correctement aux questions liées aux événements de la Révolution."
    : (lang==="de")
    ? "Sie erkunden Paris im Jahr 1789. Beantworten Sie die Fragen richtig, um jede Tür zu öffnen."
    : "You explore Paris in 1789. Answer correctly to open each gate.";
  const facts = [
    { q: (lang==="fr"?"Quelle date est associée à la prise de la Bastille ?":"Which date is linked to the Storming of the Bastille?"),
      choices: (lang==="de"?["14. Juli 1789", "4. Juli 1776", "1. Januar 1800"]:(lang==="fr"?["14 juillet 1789","4 juillet 1776","1er janvier 1800"]:["July 14, 1789","July 4, 1776","January 1, 1800"])),
      answer: (lang==="fr"?"14 juillet 1789": lang==="de"?"14. Juli 1789":"July 14, 1789"),
      explain: (lang==="fr"?"La Bastille est prise le 14 juillet 1789, symbole du début de la Révolution.": lang==="de"?"Die Bastille wurde am 14. Juli 1789 gestürmt — Symbol des Revolutionsbeginns.":"The Bastille was stormed on July 14, 1789 — symbol of the Revolution’s start.")
    },
    { q: (lang==="fr"?"Quel texte fondateur est adopté en août 1789 ?":"Which foundational text was adopted in August 1789?"),
      choices: (lang==="de"?["Erklärung der Menschen- und Bürgerrechte","Magna Carta","Code Napoléon"]:(lang==="fr"?["Déclaration des droits de l’homme et du citoyen","Magna Carta","Code Napoléon"]:["Declaration of the Rights of Man and of the Citizen","Magna Carta","Napoleonic Code"])),
      answer: (lang==="fr"?"Déclaration des droits de l’homme et du citoyen": lang==="de"?"Erklärung der Menschen- und Bürgerrechte":"Declaration of the Rights of Man and of the Citizen"),
      explain: (lang==="fr"?"Adoptée en août 1789, elle affirme des libertés et des droits fondamentaux.": lang==="de"?"Im August 1789 verabschiedet, bekräftigt sie Grundrechte und -freiheiten.":"Adopted in August 1789, it asserts fundamental rights and liberties.")
    },
    { q: (lang==="fr"?"Qui était roi de France au début de la Révolution ?":"Who was King of France at the start of the Revolution?"),
      choices: (lang==="de"?["Ludwig XVI","Karl X","Napoleon I"]:(lang==="fr"?["Louis XVI","Charles X","Napoléon Ier"]:["Louis XVI","Charles X","Napoleon I"])),
      answer: (lang==="fr"?"Louis XVI": lang==="de"?"Ludwig XVI":"Louis XVI"),
      explain: (lang==="fr"?"Louis XVI règne jusqu’en 1792 ; la monarchie est ensuite abolie.": lang==="de"?"Ludwig XVI regierte bis 1792; danach wurde die Monarchie abgeschafft.":"Louis XVI reigned until 1792; the monarchy was then abolished.")
    }
  ];
  return { title, intro, facts, badges:[{label:t},{label:`Âge ${age}`} ] };
}
