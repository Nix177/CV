// Nœuds pour la constellation (compétences)
const CV_SKILLS = [
  { id: "critique", label: "Pensée critique", group: "méthodes", weight: 3 },
  { id: "didactique", label: "Didactique info", group: "pédago", weight: 4 },
  { id: "primaire", label: "Enseignement primaire", group: "exp", weight: 4 },
  { id: "ia", label: "IA responsable", group: "tech", weight: 3 },
  { id: "python", label: "Python", group: "tech", weight: 2 },
  { id: "web", label: "HTML/CSS/JS", group: "tech", weight: 2 },
  { id: "moodle", label: "Moodle", group: "tech", weight: 2 },
  { id: "eval", label: "Évaluation", group: "pédago", weight: 3 },
  { id: "guidage", label: "Guidage progressif", group: "pédago", weight: 3 },
  { id: "com", label: "Communication claire", group: "méthodes", weight: 2 }
];
// Liens conceptuels
const CV_LINKS = [
  ["didactique","eval"],["didactique","guidage"],["didactique","primaire"],
  ["ia","python"],["ia","web"],["ia","moodle"],["critique","ia"],
  ["primaire","com"],["eval","com"]
];

// Étapes pour la vue “Story/Leçon”
const CV_STEPS = [
  { title:"Contexte", body:"Cycle 2 / 5H — initiation aux boucles en programmation." },
  { title:"Objectif", body:"Écrire une boucle 1→10 et expliquer while vs for sur son propre exemple." },
  { title:"Guidage", body:"Exemple narré, code modèle, puis défis gradués." },
  { title:"Critères", body:"Sortie correcte, absence d'erreur, vocabulaire précis." },
  { title:"Évaluation", body:"Mini-oral + test pratique court, feedback ciblé." }
];
