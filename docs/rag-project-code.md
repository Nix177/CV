# RAG profil et code des projets

## Sources

- `public/data/rag-knowledge-base.json` est la source maintenue pour le profil, les projets, les statuts, les limites et les affirmations autorisées ou interdites.
- `public/cv-text.txt` est une version narrative complémentaire, contrôlée par `rag:validate` pour les faits critiques.
- `public/profile.json` est généré par `rag:build` pour compatibilité.
- `public/portfolio-data.js` adapte la base JSON au rendu historique du portfolio.
- `public/rag/project-code-index.json` contient les passages techniques générés depuis les dépôts liés.

## Indexation

`npm run rag:index-projects` clone ou met à jour les dépôts dans `.rag-cache/projects`, sans installer de dépendance ni exécuter leur code. L'option `--source-root` permet d'utiliser des clones locaux déjà présents.

L'indexeur conserve les fichiers source, tests, configurations, données structurées et README utiles. Il exclut les répertoires de dépendances, builds, caches, binaires, médias lourds, fichiers `.env`, noms sensibles et contenus ressemblant à des secrets.

Le découpage privilégie les fonctions, classes, composants, routes, tests, sections de documentation et fichiers de configuration. Chaque passage est borné et porte les métadonnées suivantes :

- `projectId`;
- `repository`;
- `branch`;
- `path`;
- `language`;
- `symbolName`;
- `chunkType`;
- `implementationStatus`;
- `sourceUrl`;
- `lastIndexedCommit`.

## Recherche

La recherche lexicale pondérée combine les mots de la question, le nom du symbole, le chemin, le projet et le type de passage. Les fonctions, routes, tests et configurations sont favorisés; un README reçoit un poids inférieur. Les passages dont le score est nul ne sont jamais retournés.

`retrieve_project_code_context({ projectId, question, language })` renvoie un petit ensemble de preuves, les dépôts et branches, les chemins, les URL GitHub, un résumé prudent, le statut du projet et les divergences README/code documentées. Le contexte total est borné à 8 000 caractères et chaque extrait à 2 400 caractères.

## Règles de réponse

- Une fiche projet suffit pour une question générale.
- Une question technique déclenche la récupération ciblée du code.
- Le README ne prouve pas qu'une fonction est opérationnelle.
- Une présence dans le code ne prouve pas un déploiement en production.
- Les mocks, placeholders, fonctions partielles et données simulées restent explicitement signalés.
- En l'absence de preuve suffisante, la réponse doit indiquer que le dépôt décrit la fonction mais que le code ou les tests ne permettent pas de confirmer son fonctionnement.

## Maintenance

1. Modifier la base de connaissances.
2. Lancer `npm run rag:build`.
3. Lancer `npm run rag:index-projects`.
4. Lancer `npm run rag:validate`.
5. Lancer `npm run rag:test`.
6. Examiner `public/rag/project-index-report.json` avant publication.

La GitHub Action `.github/workflows/rag-project-index.yml` répète cette procédure lors d'une modification des métadonnées, à la demande et selon une planification. Les dépôts liés peuvent aussi envoyer un événement `repository_dispatch` de type `project-repository-updated`.
