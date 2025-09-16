// /api/factcheck.js
export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
    if (!process.env.OPENAI_API_KEY) return res.status(500).json({ error: 'OPENAI_API_KEY missing' });

    const { mode, claim, topic, lang = 'fr', lab, answers, self } =
      (await req.json?.()) || req.body || {};

    if (mode === 'generate') {
      const prompt = `
Tu es un formateur en pensée critique. Pour l'affirmation ci-dessous,
génère un petit "parcours de vérification" en JSON avec exactement 3 tâches.
Chacune a: title, hint (1 phrase), options (3 choix concis), sources (2-3 types de sources).
Ne fournis AUCUNE solution; c'est pour guider l'élève.

Affirmation: "${claim}"
Sujet (optionnel): "${topic || '—'}"

Réponds en ${lang === 'de' ? 'allemand' : lang === 'en' ? 'anglais' : 'français'}.
      `.trim();

      const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method:'POST',
        headers:{'Authorization':`Bearer ${process.env.OPENAI_API_KEY}`,'Content-Type':'application/json'},
        body: JSON.stringify({ model:'gpt-4o-mini', temperature:0.5, messages:[{role:'user', content: prompt}] })
      });
      const j = await resp.json();
      if (!resp.ok) return res.status(500).json({ error: j.error?.message || 'OpenAI error' });

      // essaie d'attraper le JSON
      let data = {};
      try { data = JSON.parse(j.choices?.[0]?.message?.content || '{}'); }
      catch { // fallback simple si le modèle a répondu en texte
        data = { tasks: [
          { title: "Chercher la source d'origine", hint: "Qui publie ? Quand ? Connu fiable ?", options:["Blog anonyme récent","Site officiel avec auteur","Post viral sans auteur"], sources:["Site officiel","Archive","À propos"] },
          { title: "Comparer plusieurs sources", hint: "Y a-t-il consensus ?", options:["1 seule source","Plusieurs sources fiables","Réseaux sociaux uniquement"], sources:["Articles de presse","Synthèses","Revues"] },
          { title: "Repérer indices d'intox", hint: "Langage, tonalité, appels à l'émotion", options:["Titres modérés","Beaucoup d'insultes","Aucune référence"], sources:["Guide d'évaluation","Décodage / fact-checkers","FAQ du site"] }
        ]};
      }

      return res.status(200).json({ tasks: data.tasks || [] });
    }

    if (mode === 'judge') {
      const judgePrompt = `
Tu évalues un élève qui a suivi un parcours de vérification en ${lang}.
Tu reçois :
- l'affirmation de départ
- la liste des tâches (title, hint, options, sources)
- les réponses choisies (indices 0..2, ou null si sans réponse)
- l'analyse rédigée par l'élève ("self")

Donne un retour en 6–8 lignes : points positifs, angles manquants, propositions de vérification concrètes.
Termine par une phrase d'encouragement. Pas de note chiffrée.

JSON attendu:
{ "summary": "texte", "tips": "2–3 pistes concrètes en une phrase" }
      `.trim();

      const content = JSON.stringify({ lab, answers, self });
      const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method:'POST',
        headers:{'Authorization':`Bearer ${process.env.OPENAI_API_KEY}`,'Content-Type':'application/json'},
        body: JSON.stringify({
          model:'gpt-4o-mini', temperature:0.4,
          messages:[{ role:'system', content: judgePrompt }, { role:'user', content }]
        })
      });
      const j = await resp.json();
      if (!resp.ok) return res.status(500).json({ error: j.error?.message || 'OpenAI error' });

      let out = {};
      try { out = JSON.parse(j.choices?.[0]?.message?.content || '{}'); }
      catch { out = { summary: j.choices?.[0]?.message?.content || '', tips:'' }; }

      return res.status(200).json(out);
    }

    return res.status(400).json({ error: 'Invalid mode' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
