# Revue exhaustive avant publication - RAG, portfolio et conversations - v2

Date de revue finale locale : 2026-07-15

Depot examine : `E:\CV-main`

Branche : `main`

HEAD local : `b772d0a72d33e6f8accc8f44635c1d3f38f88e64`

Etat distant observe apres `git fetch origin --prune` :

- `origin/main` a deux commits d'avance ;
- les deux commits distants ne modifient que `public/news/feed.json` et `public/news/feed-balanced.json` ;
- aucun rebase, merge, reset, stage, commit ou push n'a ete effectue pendant cette revue.

## 1. But de ce document

Ce document decrit l'ensemble du diff local pertinent avant publication, y compris :

- la base de connaissances RAG ;
- l'indexation technique des depots ;
- l'integration du RAG dans les chatbots texte et vocal ;
- les corrections de statuts et d'attribution ;
- les fonctions de consentement, transcription et export deja presentes dans le diff local ;
- les changements de portfolio necessaires a la source de donnees commune ;
- les tests executes ;
- les limites de validation ;
- le perimetre recommande pour un futur stage/commit.

Ce document ne constitue pas une autorisation de commit ou de push.

## 2. Regles suivies pendant la passe v2

- Aucun redesign du site.
- Aucune route publique renommee ou supprimee.
- Aucun changement du robot, de ses animations ou de ses fichiers 3D.
- Aucun changement des PDF du CV.
- Aucun changement de contenu dans le depot externe Histoire d'Os.
- Documate laisse dans son etat RAG existant a la demande de Nicolas.
- Aucun depot complet injecte dans un prompt.
- Aucun code de depot sans licence explicite copie dans l'index public.
- Aucun secret, fichier `.env` ou jeton ajoute.
- Aucune operation Git d'ecriture.

## 3. Baseline avant correction v2

Une baseline reproductible a ete creee avant les corrections finales.

Fichier de resultats :

- `C:\tmp\cv-rag-review-20260715\baseline.json`

Captures :

- `C:\tmp\cv-rag-review-20260715\baseline\home.png`
- `C:\tmp\cv-rag-review-20260715\baseline\cv.png`
- `C:\tmp\cv-rag-review-20260715\baseline\portfolio-fr.png`
- `C:\tmp\cv-rag-review-20260715\baseline\portfolio-en-mobile.png`
- `C:\tmp\cv-rag-review-20260715\baseline\portfolio-de.png`
- `C:\tmp\cv-rag-review-20260715\baseline\chatbot.png`
- `C:\tmp\cv-rag-review-20260715\baseline\voice.png`

Constats baseline :

- 14 pages testees ;
- 14 reponses HTTP 200 ;
- aucune erreur JavaScript de page ;
- aucun debordement horizontal ;
- 16 cartes portfolio en FR, EN et DE ;
- 16 details techniques par langue ;
- 11 liens GitHub visibles ;
- chatbot texte disponible avec OpenAI et Google ;
- assistant vocal disponible avec canvas 3D et bouton microphone ;
- consentement non coche par defaut ;
- telechargement de conversation desactive tant que le consentement n'est pas coche.

## 4. Fichiers existants modifies dans le diff local

### `.gitignore`

- Ajout de `.rag-cache/`.
- Le cache local des clones d'indexation ne doit pas etre versionne.
- Les traces `.playwright-cli/` restent hors du perimetre de commit recommande.

### `package.json`

Ajout de quatre scripts :

- `rag:build` ;
- `rag:index-projects` ;
- `rag:validate` ;
- `rag:test`.

Aucune dependance de production n'a ete ajoutee pour le RAG.

### `README.md`

Documentation ajoutee ou corrigee :

- variables Vercel des chatbots texte et vocal ;
- modeles OpenAI/Gemini recommandes et fallbacks ;
- Responses API OpenAI ;
- source de verite `public/data/rag-knowledge-base.json` ;
- role de compatibilite de `public/profile.json` ;
- commandes de generation et validation RAG ;
- indexation locale avec `--source-root` ;
- politique `metadata-only` pour les depots sans licence claire ;
- traitement des passages ressemblant a des instructions ;
- delimitation du contexte non fiable ;
- workflow GitHub en lecture seule, sans push automatique ;
- procedure de test des routes et fournisseurs.

### `api/chat.js`

Changements fournisseur OpenAI :

- modele par defaut configurable avec `OPENAI_CHAT_MODEL` ;
- valeur locale recommandee `gpt-5.5` ;
- migration vers `POST https://api.openai.com/v1/responses` ;
- payload minimal `model`, `instructions`, `input` ;
- pas de `temperature` pour les modeles OpenAI recents ;
- extraction de `output_text` ou des parties de sortie ;
- gestion explicite des erreurs 400, modele indisponible et 429 ;
- fallback automatique vers Gemini sur 429 si `GOOGLE_API_KEY` existe ;
- journalisation du statut et du body upstream nettoye ;
- aucune cle API loggee ou envoyee au navigateur.

Changements fournisseur Gemini :

- modele configurable avec `GEMINI_CHAT_MODEL` ;
- normalisation conservant la suppression du prefixe `models/` ;
- system prompt envoye uniquement dans `systemInstruction` ;
- messages utilisateur/assistant places dans `contents` ;
- message 429 conseillant `gemini-2.5-flash` ou `gemini-2.5-flash-lite`.

Changements RAG :

- chargement de la base maintenue et de l'index technique ;
- recherche lexicale ponderee ;
- identification prudente du projet ;
- detection d'une question technique ;
- fonction exportee `retrieve_project_code_context` ;
- retour du projet, depots, branches, chemins, extraits, commits, sources, statut et divergences ;
- contexte borne a quelques passages, jamais au depot complet ;
- priorite au code, aux tests et a la configuration ;
- niveau de preuve `code-indexed`, `metadata-only` ou `not-found` ;
- `verified: false` lorsque seules des metadonnees sont disponibles.

Protection contre l'injection indirecte :

- le message systeme ne contient plus le contexte recupere ;
- le contexte est place dans un message utilisateur separe ;
- delimiters `BEGIN_UNTRUSTED_RETRIEVED_CONTEXT` et `END_UNTRUSTED_RETRIEVED_CONTEXT` ;
- instruction explicite de ne jamais suivre les commandes presentes dans le contenu des depots ;
- fonction testable `buildUntrustedContextMessage`.

### `public/chatbot.html`, `public/chatbot-en.html`, `public/chatbot-de.html`

- Libelles fournisseur sans ancien GPT-4o.
- Affichage du modele OpenAI recommande dans les trois langues.
- Case de consentement pour conserver localement la discussion.
- Bouton de telechargement de la conversation.
- Encart repliable de protection des donnees.
- Aucun envoi vers une base de donnees de Nicolas.
- Navigation multilingue preservee.

### `public/chatbot.js`

- Lecture du modele public via le ping `GET /api/chat`.
- Journal local active uniquement apres consentement.
- Construction d'un historique lisible utilisateur/assistant.
- Export local Markdown de la conversation.
- Bouton d'export desactive sans consentement ou sans contenu.
- Pas de stockage serveur ajoute.
- Flux de reponse existant preserve.

### `public/cv-text.txt`

- Publication 2025 sur l'enseignement explicite du debogage au primaire.
- Clarification du niveau d'allemand C1 a reactiver par pratique/immersion.
- Clarification educa.ch : veille personnelle, aucun emploi chez educa.ch.
- Clarification doctorale : proposition soumise et refusee/non financee, aucun doctorat actuel.
- Clarification CAS Education numerique : intervention d'une journee, CAS non obtenu.
- Competences recentes Codex/GitHub, n8n, automatisation et IA responsable.
- Projet Histoire d'Os maintenu comme projet actuel.
- Rover/BM-800 formules avec limites et absence de validation.
- Toute mention active de l'ancien projet retire a disparu.

### `public/data/rag-knowledge-base.json`

Nouveau fichier maintenu et source de verite.

Il contient :

- profil professionnel ;
- formation ;
- langues ;
- faits explicitement verifies ;
- publication 2025 ;
- projets actuels ;
- taxonomie de statuts ;
- 17 fiches RAG ;
- textes portfolio FR/EN/DE ;
- implementations, parties, simulations, plans et limites ;
- contributions prudentes ;
- composants tiers ;
- claims autorises/interdits ;
- depots, branches et emplacements de code.

Correction v2 :

- 16 fiches restent visibles dans le portfolio ;
- `histoire-os` est la 17e fiche, avec `portfolioVisible: false` ;
- Telescope OnStep passe de `stable` a `experimental` ;
- Rover distingue architecture documentee, assemblage et tests non verifies ;
- PetNames passe en `metadata-only` ;
- Documate n'est pas modifie dans cette passe, conformement a la demande de Nicolas.

### `public/profile.json`

- Devient une sortie de compatibilite generee.
- Indique `generatedFrom: /data/rag-knowledge-base.json`.
- Conserve le format attendu par les integrations historiques.
- N'est plus une source manuelle concurrente.
- Regenere le 2026-07-15 apres la correction v2.

### `public/portfolio-data.js`

- Remplacement du grand tableau duplique par un adaptateur de compatibilite.
- Chargement de la base RAG avec `fetch`.
- Reconstruction de `window.portfolioData`, `window.PORTFOLIO` et `window.PORTFOLIO_ITEMS`.
- Filtre `portfolioVisible !== false` pour garder 16 cartes publiques.
- Aucun changement du contrat attendu par `portfolio.js`.

### `public/portfolio.js`

- Attend la promesse `portfolioDataReady`.
- Affiche les statuts selon la taxonomie commune.
- Ajoute des details techniques repliables.
- Affiche limites et liens vers le code lorsque disponibles.
- Conserve filtres, demos et jeux existants.

### `public/portfolio.html`, `public/portfolio-en.html`, `public/portfolio-de.html`

- Texte d'introduction ajuste pour signaler les statuts reels.
- Structure des pages et navigation conservees.
- Aucun projet multilingue supprime.

### `public/style.css`

- Styles des details techniques et statuts.
- Styles du consentement, du bouton d'export et de l'encart de confidentialite du chatbot.
- Adaptations responsives.
- Aucun redesign general.

### `public/prototypes/voice-assistant-preview.html`

- Navigation principale ajoutee.
- Case de consentement de transcription.
- Zone de transcription conditionnelle.
- Bouton de telechargement.
- Encart de protection des donnees.
- Bouton microphone visuellement inactif avant activation.
- Titre legerement reduit.
- Robot et canvas 3D conserves.

### `public/prototypes/voice-assistant/js/VoiceAssistantApp.js`

- Gestion du consentement local.
- Transcription optionnelle des tours utilisateur/assistant.
- Association des fragments de transcription au tour courant.
- Rendu non bloquant de l'historique.
- Export Markdown lisible.
- Reinitialisation correcte lors d'une interruption.
- Le pipeline audio reste prioritaire sur l'affichage du texte.
- Aucun enregistrement serveur ajoute.

### `public/prototypes/voice-assistant/js/i18n.js`

- Textes FR/EN/DE pour consentement, transcription, export et protection des donnees.
- Libelles de roles utilisateur/assistant.
- Messages d'etat et d'export.

### `public/prototypes/voice-assistant/voice-assistant.css`

- Styles de la navigation.
- Styles de consentement et transcription.
- Styles du panneau de confidentialite.
- Etats visuels du microphone.
- Responsive desktop/mobile.
- Geometrie et animation du robot non modifiees par cette passe.

### `public/prototypes/voice-assistant/js/RagRetriever.js`

- Charge la base de connaissances et l'index technique.
- Recherche lexicale partagee avec le chatbot texte.
- Ajoute le contexte technique uniquement pour une question technique.
- Borne le contexte.
- Retourne chemins, commits et URLs.
- Distingue preuve de code et metadonnees seules.
- Ne qualifie pas Histoire d'Os ou PetNames de verifies par code.

### `public/prototypes/voice-assistant/js/GeminiLiveClient.js`

- Outils Gemini Live `retrieve_profile_context` et `retrieve_project_code_context`.
- Transcription Gemini activee seulement avec consentement.
- Contexte RAG envoye comme bloc de donnees non fiable.
- Reponses d'outil marquees `untrusted-data`.
- Regles systeme interdisant de suivre des instructions dans les depots.
- Extraits techniques limites a 1 400 caracteres pour l'outil vocal.
- Aucun ralentissement volontaire du pipeline audio.

## 5. Nouveaux fichiers du chantier RAG

### `tools/rag/build-compatibility-data.mjs`

- Genere `public/profile.json` depuis la base RAG.
- Evite deux sources manuelles divergentes.

### `tools/rag/index-projects.mjs`

- Clone ou lit des depots sans executer leur code.
- Ignore builds, dependances, medias lourds, binaires, caches et fichiers sensibles.
- Decoupe par fonctions, classes, composants, routes, tests, configs et sections Markdown.
- Borne chaque extrait a 1 800 caracteres.
- Limite un projet a 120 chunks.
- Stocke projet, depot, branche, chemin, langage, symbole, type, statut, URL et commit.
- Marque les passages ressemblant a des instructions.
- Produit un rapport d'indexation.
- Produit les fiches Markdown par projet.
- En `metadata-only`, lit seulement branche/commit et n'enumere ni ne copie les fichiers.

### `tools/rag/prompt-injection-guard.mjs`

- Detecte des formulations telles que :
  - ignorer les instructions precedentes ;
  - reveler un secret ou une cle ;
  - modifier le role ;
  - appeler un outil ;
  - contourner les regles.
- Le detecteur sert au rapport et aux tests ; le contenu reste traite comme donnee non fiable.

### `tools/rag/validate.mjs`

- Valide schema, statuts, champs et traductions.
- Valide les chunks et leurs metadonnees.
- Refuse les chemins sensibles et motifs de secrets.
- Verifie la presence du drapeau d'instruction suspecte.
- Verifie la politique `metadata-only`.
- Verifie Histoire d'Os cache du portfolio.
- Interdit Telescope `stable` sans preuve.
- Verifie les clarifications educa.ch/doctorat/CAS.
- Verifie le retrait de l'ancien projet obsolescent sans conserver son nom actif.
- Verifie que le workflow est en lecture seule et ne contient pas de `git push`.

### `tools/rag/test-retrieval.mjs`

Teste :

- vote Frustra ;
- absence de collecteur social operationnel Frustra ;
- architecture Vocal Walls ;
- faits educa.ch et doctorat ;
- allemand C1 ;
- prudence Common Ground ;
- Telescope experimental ;
- Histoire d'Os en metadata-only et non verifie par code ;
- contexte absent du message systeme ;
- bloc de contexte non fiable ;
- commentaire malveillant synthetique ;
- protection du system prompt vocal ;
- messages 400/429 OpenAI et 429 Gemini.

### `public/rag/weighted-lexical-retriever.js`

- Normalisation multilingue.
- Tokenisation.
- Pondération projet, titre, fichier, symbole et type.
- Bonus pour code/tests/config.
- Detection de question technique.
- Formatage borne des resultats.
- Aucun embedding ni service payant ajoute.

### `public/rag/project-code-index.json`

Sortie generee le 2026-07-15 :

- 12 projets indexes ;
- 12 depots accessibles ;
- 241 fichiers de code/documentation analyses ;
- 732 chunks ;
- 507 symboles ;
- 20 routes ;
- 7 chunks de tests ;
- 0 depot manquant ;
- 0 erreur.

Taille :

- 1 224 373 octets brut ;
- 217 166 octets gzip ;
- 161 901 octets Brotli.

Le chargement differe de cet index n'a pas ete introduit dans cette passe pour eviter un risque de regression du vocal avant publication.

### `public/rag/project-index-report.json`

- Liste depots accessibles, branches et commits.
- Liste fichiers/chunks/symboles/routes/tests.
- Liste statuts ambigus.
- Liste fichiers sensibles ignores.
- Liste depots metadata-only.
- Liste passages ressemblant a des instructions.

Passage signale :

- projet `agora-multi` ;
- `scenarios/eoliennes/assets/app.js`, fonction `sendMsg`, ligne 660 ;
- raison : le code construit un system prompt ;
- ce signalement est attendu et ne signifie pas qu'une attaque a ete executee.

### `public/rag/projects/*.md`

17 fiches generees :

- 3d-printing ;
- agora-multi ;
- agora-solo ;
- bm800 ;
- common-ground ;
- documate ;
- frustra ;
- histoire-os ;
- ia-news-ethique ;
- karaoke-studio ;
- micro-mentor ;
- petnames ;
- robotarm ;
- slow-social ;
- telescope ;
- un-algorithm ;
- vocal-walls.

### `.github/workflows/rag-project-index.yml`

Declencheurs :

- manuel ;
- repository dispatch ;
- hebdomadaire ;
- changements RAG sur `main`.

Etapes :

- checkout ;
- Node 22 ;
- `npm ci` ;
- build de compatibilite ;
- indexation ;
- validation ;
- tests ;
- upload d'un artifact de revue ;
- verification que les sorties versionnees sont a jour.

Securite :

- `permissions: contents: read` ;
- aucun commit automatique ;
- aucun push automatique ;
- aucune ecriture sur `main`.

### `docs/rag-project-code.md`

- Architecture et cycle de mise a jour.
- Schema de la base et de l'index.
- Exclusions de securite.
- Comportement prudent du chatbot.
- Commandes de generation et validation.

## 6. Audit projet par projet

### Projets avec code indexe

- Karaoke Studio : stable dans le perimetre local annonce.
- IA News Ethique : demo avec webhooks n8n et fallbacks simules.
- Agora collectif : prototype, usage collectif mais pas serveur multijoueur complet.
- Agora Solo : demo jouable, efficacite pedagogique non prouvee par le code.
- Vocal Walls : prototype web/mobile/backend, production non confirmee.
- Common Ground : mockup, donnees et orchestration simulees.
- Micro-Mentor : prototype local, persistance locale et recommandation simple.
- Frustra : prototype, vote en memoire, aucun collecteur social operationnel trouve.
- Slow Social : prototype local, ingestion et filtrage partiellement simules.
- Un-Algorithm : mockup, classement et ingestion simules.

### PetNames

- Depot : `PetNameGenerator/petname`.
- Commit audite : `f4dcecf7cdc99c91c4269f19f8920c809600e20a`.
- Trois commits visibles utilisent l'identite Git Nix177.
- Depot d'organisation, aucune propriete exclusive deduite.
- Aucune licence explicite trouvee.
- Index public limite aux metadonnees.

### Histoire d'Os

- Depot lu uniquement : `Histoire-d-os/Histoire-d-os`.
- Commit audite : `e3197d3e25984c25ff4361d961c484fe9d3a7640`.
- 34 commits visibles utilisent l'identite Git tuorn.
- Site statique GitHub Pages sans build.
- Parcours FR/EN/DE/IT.
- Quatre activites, ressources classe/musee, HTML imprimables et jeu 3D.
- Validation, droits, traduction, accessibilite et impression suivis par documents.
- PDF WIP distincts des HTML imprimables.
- Aucune licence explicite trouvee.
- Aucun extrait de code publie dans l'index.
- Aucun contenu du depot Histoire d'Os n'a ete modifie.

### Documate

- La fiche existante est conservee.
- Description maintenue : application qui analyse et explique des documents.
- Aucun depot ajoute dans cette passe.
- Audit technique complementaire reporte a une future demande.

### Rover Nova et bras

- Statut experimental.
- Architecture 4S 18650, BMS 4S 40A, XL4015 5.2V, DS3225, Wago 221, 18/24 AWG.
- Adaptation de conceptions tierces.
- Assemblage complet, fonctionnement et tests non verifies.
- Aucun claim d'autonomie ou de stabilite.

### BM-800

- Statut experimental.
- Architecture Alice/Schoeps et composants tiers cites comme inspirations.
- Aucune mesure ou validation studio disponible.
- Aucun claim de qualite studio.

### Telescope OnStep

- Statut corrige de stable a experimental.
- OnStep et design Thingiverse identifies comme tiers.
- Adaptation personnelle annoncee.
- Assemblage, fonctions testees et fiabilite non confirmes par preuve liee.

### AdWall

- Aucune occurrence active trouvee.
- Aucun projet ajoute.

### Ancien projet retire

- Recherche finale avant creation de ce rapport : aucune occurrence active.
- Ce rapport contient son nom uniquement pour tracer son retrait, ce qui est explicitement autorise.

## 7. Securite et protection des donnees

### Secrets

- Aucun secret ajoute.
- Fichiers `.env`, credentials, tokens et cles prives ignores.
- Motifs OpenAI, Google et private keys verifies.
- Cles permanentes conservees uniquement cote serveur.

### Injection indirecte

- Les depots sont des sources non fiables.
- Le contexte n'est pas dans l'instruction systeme.
- Les blocs sont delimites.
- Les outils vocaux marquent le contexte comme `untrusted-data`.
- Les instructions presentes dans le code ne doivent jamais etre executees.
- Test synthetique present.

### Conversations

- Pas de collecte par Nicolas.
- Consentement local explicite.
- Transcription et journal uniquement si coche.
- Export local Markdown.
- Boutons desactives sans consentement/contenu.
- Le traitement par les fournisseurs IA est explique dans les trois langues.

## 8. Tests executes apres correction

### Syntaxe

Passes :

- `node --check api/chat.js`
- `node --check tools/rag/index-projects.mjs`
- `node --check tools/rag/validate.mjs`
- `node --check tools/rag/test-retrieval.mjs`
- `node --check tools/rag/prompt-injection-guard.mjs`
- `node --check public/prototypes/voice-assistant/js/GeminiLiveClient.js`
- `node --check public/prototypes/voice-assistant/js/RagRetriever.js`

### Generation RAG

Passes :

- `node tools/rag/build-compatibility-data.mjs`
- `node tools/rag/index-projects.mjs --source-root <clones-audites>`
- 12 projets, 12 depots, 241 fichiers, 732 chunks, 0 erreur.

### Validation et retrieval

Passes :

- `node tools/rag/validate.mjs`
- `node tools/rag/test-retrieval.mjs`

Resultat :

- 17 projets valides ;
- 732 chunks bornes ;
- tests profil, statuts, architecture, metadata-only, injection et erreurs API passes.

### API locale

Passes :

- `GET /api/chat` -> 200, `{"ok":true,"ping":"pong"}`.
- POST OpenAI sans cle -> message utilisateur propre.
- POST Google sans cle -> message utilisateur propre.
- OpenAI 429 simule -> quota + conseil Gemini.
- OpenAI 400/model_not_found simule -> modele indisponible.
- Gemini 429 simule -> conseil flash/flash-lite.

Non executes avec fournisseur reel :

- aucune variable `OPENAI_API_KEY` presente dans l'environnement de test ;
- aucune variable `GOOGLE_API_KEY` ou `GEMINI_API_KEY` presente ;
- aucune cle n'a ete demandee, copiee ou affichee.

### Routes locales

Toutes en 200 :

- `/`
- `/cv`
- `/portfolio`
- `/chatbot`
- `/fun-facts`
- `/passions`
- `/lab`
- `/ai-lab`
- `/ai-lab.html`
- `/ai-lab-en.html`
- `/ai-lab-de.html`
- `/prototypes/voice-assistant-preview.html`
- `/data/rag-knowledge-base.json`
- `/rag/project-code-index.json`

### Navigateur final

Fichier :

- `C:\tmp\cv-rag-review-20260715\final.json`

Captures :

- `C:\tmp\cv-rag-review-20260715\final\home.png`
- `C:\tmp\cv-rag-review-20260715\final\cv.png`
- `C:\tmp\cv-rag-review-20260715\final\portfolio-fr.png`
- `C:\tmp\cv-rag-review-20260715\final\portfolio-en-mobile.png`
- `C:\tmp\cv-rag-review-20260715\final\portfolio-de.png`
- `C:\tmp\cv-rag-review-20260715\final\chatbot.png`
- `C:\tmp\cv-rag-review-20260715\final\voice.png`

Comparaison baseline/final :

- aucune difference sur les statuts HTTP ;
- aucune difference sur les debordements ;
- aucune difference sur les 16 cartes ;
- aucune difference sur les details techniques ;
- aucune difference sur les liens GitHub ;
- 0 page error avant et apres ;
- 12 console errors avant et apres ;
- 17 request failures avant et apres ;
- 12 failed responses avant et apres.

Les erreurs identiques au baseline concernent :

- Vercel Insights indisponible en local ;
- OrbitControls/GLTFLoader depuis unpkg bloques par ORB sur portfolio EN/DE ;
- diff_match_patch depuis cdnjs bloque par ORB dans AI Lab.

Ces erreurs preexistent a la passe RAG et n'ont pas ete corrigees pour respecter le perimetre conservateur.

## 9. Tests indisponibles dans cet environnement

### `npm ci`

Non execute.

Cause exacte :

`Cannot find module C:\Users\nicol\AppData\Roaming\npm\node_modules\npm\bin\npm-cli.js`

Le lanceur global npm est casse. Les scripts RAG, sans dependance externe, ont ete executes directement avec Node.

### `vercel build`

Non execute.

Cause exacte :

`vercel` n'est pas installe/reconnu dans le PATH.

### Fournisseurs IA reels

Non executes faute de credentials locaux. Les chemins sans cle et les gestionnaires d'erreur ont ete testes.

## 10. Risques residuels

- `origin/main` doit etre integre proprement avant un futur push.
- Le fichier d'index navigateur reste volumineux, bien que compresse a environ 217 Ko gzip.
- Les dependances CDN preexistantes peuvent echouer selon les politiques ORB du navigateur.
- Les tests reels OpenAI/Gemini doivent etre executes dans un environnement Vercel configure.
- Les depots lies peuvent evoluer apres les commits indexes.
- Les identites Git prouvent des commits visibles, pas une propriete intellectuelle exclusive.
- Documate reste a auditer ulterieurement selon la demande de Nicolas.

## 11. Plan de staging propose, non execute

### Lot A - Donnees et indexation RAG

- `.gitignore`
- `package.json`
- `README.md`
- `public/cv-text.txt`
- `public/data/rag-knowledge-base.json`
- `public/profile.json`
- `public/rag/weighted-lexical-retriever.js`
- `public/rag/project-code-index.json`
- `public/rag/project-index-report.json`
- `public/rag/projects/*.md`
- `tools/rag/build-compatibility-data.mjs`
- `tools/rag/index-projects.mjs`
- `tools/rag/prompt-injection-guard.mjs`
- `tools/rag/validate.mjs`
- `tools/rag/test-retrieval.mjs`
- `.github/workflows/rag-project-index.yml`
- `docs/rag-project-code.md`
- ce rapport v2.

### Lot B - Integration portfolio et chatbots

- `api/chat.js`
- `public/portfolio-data.js`
- `public/portfolio.js`
- `public/portfolio.html`
- `public/portfolio-en.html`
- `public/portfolio-de.html`
- `public/chatbot.html`
- `public/chatbot-en.html`
- `public/chatbot-de.html`
- `public/chatbot.js`
- `public/style.css`
- `public/prototypes/voice-assistant-preview.html`
- `public/prototypes/voice-assistant/js/GeminiLiveClient.js`
- `public/prototypes/voice-assistant/js/RagRetriever.js`
- `public/prototypes/voice-assistant/js/VoiceAssistantApp.js`
- `public/prototypes/voice-assistant/js/i18n.js`
- `public/prototypes/voice-assistant/voice-assistant.css`.

Cette separation est seulement une proposition de revue. Aucun fichier n'est stage.

## 12. Fichiers explicitement exclus du futur commit RAG

- `.playwright-cli/**`
- `references/robot/**`
- `robot_3d.glb`
- `robot_3d_back.png`
- `robot_3d_report.json`
- `scripts/blender/**`
- `public/models/robot/robot-assistant*.json`
- `public/models/robot/robot-assistant*.png`
- `public/models/robot/robot-assistant.glb`
- `public/models/robot/robot-voice-assistant-v2.glb`
- `public/models/robot/robot-voice-assistant-v3.glb`
- `public/models/robot/robot-voice-assistant-v4.glb`
- `public/models/robot/robot-voice-assistant-v5.glb`
- caches Python `__pycache__`.

Le modele actuellement utilise par le site n'a pas ete modifie dans la passe v2.

## 13. Inventaire Git exhaustif au 2026-07-15

Cet inventaire reproduit tous les chemins modifies ou non suivis observes par
`git status --porcelain=v1 -uall`. Il permet de revoir le perimetre sans devoir
deduire les fichiers caches derriere un repertoire.

### Fichiers suivis modifies

- `.gitignore`
- `README.md`
- `api/chat.js`
- `package.json`
- `public/chatbot-de.html`
- `public/chatbot-en.html`
- `public/chatbot.html`
- `public/chatbot.js`
- `public/cv-text.txt`
- `public/portfolio-data.js`
- `public/portfolio-de.html`
- `public/portfolio-en.html`
- `public/portfolio.html`
- `public/portfolio.js`
- `public/profile.json`
- `public/prototypes/voice-assistant-preview.html`
- `public/prototypes/voice-assistant/js/GeminiLiveClient.js`
- `public/prototypes/voice-assistant/js/RagRetriever.js`
- `public/prototypes/voice-assistant/js/VoiceAssistantApp.js`
- `public/prototypes/voice-assistant/js/i18n.js`
- `public/prototypes/voice-assistant/voice-assistant.css`
- `public/style.css`

### Nouveaux fichiers lies au chantier RAG et a sa revue

- `.github/workflows/rag-project-index.yml`
- `docs/change-review-rag-project-code-2026-07-14-v2.md`
- `docs/change-review-rag-project-code-2026-07-14.md`
- `docs/rag-project-code.md`
- `public/data/rag-knowledge-base.json`
- `public/rag/project-code-index.json`
- `public/rag/project-index-report.json`
- `public/rag/projects/3d-printing.md`
- `public/rag/projects/agora-multi.md`
- `public/rag/projects/agora-solo.md`
- `public/rag/projects/bm800.md`
- `public/rag/projects/common-ground.md`
- `public/rag/projects/documate.md`
- `public/rag/projects/frustra.md`
- `public/rag/projects/histoire-os.md`
- `public/rag/projects/ia-news-ethique.md`
- `public/rag/projects/karaoke-studio.md`
- `public/rag/projects/micro-mentor.md`
- `public/rag/projects/petnames.md`
- `public/rag/projects/robotarm.md`
- `public/rag/projects/slow-social.md`
- `public/rag/projects/telescope.md`
- `public/rag/projects/un-algorithm.md`
- `public/rag/projects/vocal-walls.md`
- `public/rag/weighted-lexical-retriever.js`
- `tools/rag/build-compatibility-data.mjs`
- `tools/rag/index-projects.mjs`
- `tools/rag/prompt-injection-guard.mjs`
- `tools/rag/test-retrieval.mjs`
- `tools/rag/validate.mjs`

### Fichiers locaux presents mais explicitement exclus du futur commit RAG

- `.playwright-cli/console-2026-06-29T09-19-43-834Z.log`
- `.playwright-cli/page-2026-06-29T09-19-57-080Z.yml`
- `public/models/robot/robot-assistant-config.json`
- `public/models/robot/robot-assistant-preview-3q.png`
- `public/models/robot/robot-assistant-preview-front.png`
- `public/models/robot/robot-assistant-preview-head-3q.png`
- `public/models/robot/robot-assistant-preview-head-front.png`
- `public/models/robot/robot-assistant-preview-side.png`
- `public/models/robot/robot-assistant.glb`
- `public/models/robot/robot-voice-assistant-v2.glb`
- `public/models/robot/robot-voice-assistant-v3.glb`
- `public/models/robot/robot-voice-assistant-v4.glb`
- `public/models/robot/robot-voice-assistant-v5.glb`
- `references/robot/README.md`
- `references/robot/reference-animation-breakdown.png`
- `references/robot/reference-head-mechanics.png`
- `references/robot/reference-turnaround.png`
- `robot_3d.glb`
- `robot_3d_back.png`
- `robot_3d_report.json`
- `scripts/blender/__pycache__/generate_robot.cpython-313.pyc`
- `scripts/blender/__pycache__/install_mpfb_assets.cpython-313.pyc`
- `scripts/blender/__pycache__/probe_mpfb.cpython-313.pyc`
- `scripts/blender/__pycache__/validate_robot.cpython-313.pyc`
- `scripts/blender/generate_robot.py`
- `scripts/blender/install_mpfb_assets.py`
- `scripts/blender/probe_mpfb.py`
- `scripts/blender/validate_robot.py`

## 14. Etat de fin de revue

- Correctifs appliques localement.
- Index regenere.
- Validation et tests passes.
- Baseline et final compares.
- Rapport exhaustif cree.
- Aucun stage.
- Aucun commit.
- Aucun push.
- Arret obligatoire avant toute publication pour revue humaine.
