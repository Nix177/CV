// api/generate-quiz.js
export default async function handler(req, res){
  try{
    const { branch, theme, age, n=5, per, lang='fr' } = req.body || {};
    const nQ = Math.max(3, Math.min(10, parseInt(n,10)||5));
    const grade = Math.max(5, Math.min(18, parseInt(age,10)||10));

    const sys = (lang==='fr')
      ? `Tu es un générateur de quiz scolaire aligné au PER. 
Rédige des QCM clairs, lisibles à l'âge ${grade}. Langue: français. 
Réponds STRICTEMENT au format JSON: {"questions":[{"q":"","choices":["","","",""],"answer":"","explain":""}], "gradeLevel":${grade}}`
      : `You are a PER-aligned school quiz generator. Age ${grade}. Language: ${lang}. 
Return STRICT JSON {"questions":[{"q":"","choices":["","","",""],"answer":"","explain":""}], "gradeLevel":${grade}}`;

    const user = `
Branche: ${branch}
Thématique: ${theme}
Âge: ${grade}
Objectifs PER (extraits): ${per?.objectives?.join(' ; ') || '—'}

Consignes:
- ${nQ} questions, 4 choix chacune (A-D). "answer" DOIT être exactement l’un des items de "choices".
- "explain" = explication courte, calibrée à l’âge ${grade}, simple à comprendre.
- Varie les types (définition, application, lien avec objectif).
- Évite le hors-sujet; colle à la thématique.
`;

    const r = await fetch('https://api.openai.com/v1/chat/completions',{
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        'Authorization':`Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.4,
        response_format: { type: 'json_object' },
        messages: [
          { role:'system', content: sys },
          { role:'user',   content: user }
        ]
      })
    });

    if(!r.ok){
      const t = await r.text();
      throw new Error('OpenAI error: '+t);
    }
    const data = await r.json();
    const json = JSON.parse(data.choices[0].message.content);
    res.status(200).json(json);
  }catch(e){
    res.status(500).json({ error: e.message, fallback: true, questions:[], gradeLevel: null });
  }
}
