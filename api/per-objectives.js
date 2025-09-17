// api/per-objectives.js
export default async function handler(req, res){
  try{
    const { branch='Sciences', age='10', theme='', lang='fr' } = req.query;
    const a = parseInt(age,10);

    // Mapping âge → cycle PER (approx. pour primaire)
    // Cycle 1 : 4-8 / Cycle 2 : 8-12 / Cycle 3 : 12-15
    const cycle = a < 8 ? 'Cycle 1' : (a < 12 ? 'Cycle 2' : 'Cycle 3');

    // Fallback minimal d’objectifs – à étoffer si besoin
    const DB = {
      'Français': {
        'Cycle 1': [
          "Comprendre un court texte lu à voix haute",
          "Produire des phrases simples cohérentes",
          "Identifier les sons/lettres d’un mot"
        ],
        'Cycle 2': [
          "Repérer les informations explicites d’un texte",
          "Planifier et rédiger un texte court avec connecteurs",
          "Identifier classe grammaticale (nom, verbe, adjectif)"
        ],
        'Cycle 3': [
          "Inférer une information implicite d’un texte",
          "Rédiger un texte argumentatif structuré",
          "Analyser la fonction d’un groupe nominal"
        ]
      },
      'Mathématiques': {
        'Cycle 1': [
          "Comprendre la dizaine et l’unité",
          "Résoudre de petits problèmes additifs",
          "Reconnaître des formes géométriques usuelles"
        ],
        'Cycle 2': [
          "Fractions simples (½, ⅓, ¼) et décimaux",
          "Proportionnalité et pourcentages simples",
          "Périmètre et aire de figures"
        ],
        'Cycle 3': [
          "Équations du 1er degré",
          "Théorème de Pythagore (initiation)",
          "Statistiques simples (moyenne, médiane)"
        ]
      },
      'Sciences': {
        'Cycle 1': [
          "Cycle de vie d’un animal ou d’une plante",
          "États de l’eau et changements",
          "Sens et organes principaux"
        ],
        'Cycle 2': [
          "Cycle de l’eau et phénomènes météo",
          "Écosystèmes et chaînes alimentaires",
          "Énergie et transformations (qualitatives)"
        ],
        'Cycle 3': [
          "Génétique très simple (hérédité)",
          "Énergie, puissance, rendements",
          "Climat et gaz à effet de serre"
        ]
      },
      'Histoire': {
        'Cycle 1': [
          "Notions de passé / présent, repères simples",
          "Vie quotidienne autrefois vs aujourd’hui"
        ],
        'Cycle 2': [
          "Moyen Âge en Europe",
          "Temps modernes: découvertes et échanges"
        ],
        'Cycle 3': [
          "Révolutions industrielles",
          "XXe siècle: conflits mondiaux"
        ]
      },
      'Géographie': {
        'Cycle 1': [
          "Lire un plan simple",
          "Relief et points cardinaux (initiation)"
        ],
        'Cycle 2': [
          "Paysages et activités humaines",
          "Climat et biomes"
        ],
        'Cycle 3': [
          "Mondialisation, mobilités",
          "Développement durable et enjeux"
        ]
      },
      'Citoyenneté': {
        'Cycle 1': [
          "Règles de vie, coopération",
          "Respect des différences"
        ],
        'Cycle 2': [
          "Fonctionnement de la classe/école",
          "Droits et devoirs"
        ],
        'Cycle 3': [
          "Institutions, médias, esprit critique",
          "Participation et débat"
        ]
      },
      'Langues étrangères':{
        'Cycle 1':[
          "Comprendre des consignes très simples",
          "Se présenter, saluer"
        ],
        'Cycle 2':[
          "Vocabulaire thématique (maison, ville, école…) ",
          "Compréhension globale d’un court dialogue"
        ],
        'Cycle 3':[
          "Compréhension détaillée de textes courts",
          "Interaction et expression écrite guidée"
        ]
      }
    };

    const objectives = DB[branch]?.[cycle] || DB['Sciences']['Cycle 2'];
    res.status(200).json({ cycle, branch, age: a, theme, lang, objectives });
  }catch(e){
    res.status(500).json({ error: e.message });
  }
}
