// api/factcheck.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only' });
  }
  const { mode = 'generate', lang = 'fr', topic = '', age = '', notes = '', urls = [] } =
    (req.body || {});

  // Petite fabrique de prompts multilingues.
  const L = {
    fr: {
      generate: (t, a) => `Tu es un conseiller pédagogique. Sujet: "${t}". Public: "${a}".
Propose 3 à 5 étapes brèves, concrètes, éthiques et faisables avec (ou sans) IA.
Réponds sous forme de liste d’items, sans blabla.`,
      judge: (t, a, n, u) => `Évalue le plan d’activité suivant (niveau: "${a}", sujet: "${t}").
Notes de l'enseignant: """${n}"""
Sources éventuelles: ${Array.isArray(u) && u.length ? u.join(', ') : 'aucune'}
Analyse didactique concise: points forts, risques, ajustements concrets.`
    },
    en: {
      generate: (t, a) => `You are an instructional coach. Topic: "${t}". Learners: "${a}".
List 3–5 brief, doable, ethical AI-supported steps. Use bullet points.`,
      judge: (t, a, n, u) => `Review the plan (level: "${a}", topic: "${t}").
Teacher notes: """${n}"""
Sources: ${Array.isArray(u)&&u.length?u.join(', '):'none'}
Give concise strengths, risks, and concrete tweaks.`
    },
    de: {
      generate: (t, a) => `Du bist Unterrichtscoach. Thema: "${t}". Lernende: "${a}".
Nenne 3–5 kurze, machbare und verantwortungsvolle KI-Schritte (Stichpunkte).`,
      judge: (t, a, n, u) => `Bewerte den Plan (Niveau: "${a}", Thema: "${t}").
Notizen der Lehrperson: """${n}"""
Quellen: ${Array.isArray(u)&&u.length?u.join(', '):'keine'}
Gib Stärken, Risiken und konkrete Anpassungen.`
    }
  }[lang] || L_fr;

  // --- Appel modèle (placeholder sans clé ici) ---
  // Branchez votre fournisseur habituel. Pour la démo on renvoie des données “mock”.
  if (mode === 'generate') {
    const steps = [
      `Activer les pré-requis avec 3 exemples/commentaires d’IA (niveau ${age}).`,
      `Atelier guidé: élèves expliquent à l’IA puis comparent avec un pair.`,
      `Mini-défi avec critères de succès affichés.`,
      `Auto-évaluation rapide + trace écrite synthétique.`
    ];
    return res.json({ steps });
  }
  if (mode === 'judge') {
    const feedback =
`✓ Points forts: contexte précisé (${age}), intention claire.
⚠ Risques: surcharge/outils non maîtrisés → prévoir démonstration courte.
→ Ajustements: limiter à 2 prompts modèles, afficher 3 critères de réussite,
prévoir 1 vérification de source par groupe (${(urls||[]).length ? 'sources fournies' : 'sources à ajouter'}).`;
    return res.json({ feedback });
  }

  res.status(400).json({ error: 'Unknown mode' });
}
