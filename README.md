# CV Nicolas Tuor

Site statique personnel déployé sur Vercel, avec quelques fonctions serverless pour les usages IA.

## Démarrage local

```bash
node tools/serve.js
# http://localhost:3000/
```

Pour servir uniquement les fichiers statiques sans les routes API :

```bash
python -m http.server 5173 -d public
# http://localhost:5173/
```

### Assistant vocal 3D (prévisualisation)

La branche de prévisualisation contient un assistant vocal Gemini Live avec robot 3D procédural, saisie texte, microphone, RAG local et réponse uniquement audio.

Créer un fichier `.env` local à partir de `.env.example`, puis renseigner `GOOGLE_API_KEY`. `.env` est ignoré par Git.

```bash
npm run preview:voice
# http://localhost:3001/prototypes/voice-assistant-preview.html
```

Le navigateur ne reçoit jamais la clé API permanente. `/api/live-token` l'utilise côté serveur pour créer un jeton Gemini Live éphémère, à usage unique et à durée limitée.

## Déploiement Vercel

Le site reste statique côté public. Les routes API vivent dans `api/` et sont exécutées comme fonctions serverless Node.js.

Variables d'environnement à configurer dans Vercel :

```txt
OPENAI_API_KEY=...
OPENAI_CHAT_MODEL=gpt-5.5
GOOGLE_API_KEY=...
GEMINI_CHAT_MODEL=gemini-2.5-flash
GEMINI_LIVE_MODEL=gemini-3.1-flash-live-preview
GEMINI_LIVE_VOICE=Sadaltager
```

Fallbacks OpenAI possibles si le modèle recommandé n'est pas disponible pour la clé ou l'endpoint :

```txt
OPENAI_CHAT_MODEL=gpt-5.4
OPENAI_CHAT_MODEL=gpt-5.4-mini
OPENAI_CHAT_MODEL=gpt-4o
```

Fallbacks Gemini possibles si besoin de réduire les limites/coûts :

```txt
GEMINI_CHAT_MODEL=gemini-2.5-flash
GEMINI_CHAT_MODEL=gemini-2.5-flash-lite
```

`ALLOWED_ORIGINS` est utilisé par certains endpoints pour le CORS, notamment `/api/llm`, si l'accès doit être limité à des origines précises.

Ne jamais commiter de clé API. Les clés doivent rester dans les variables d'environnement Vercel ou dans un environnement local non versionné.

`GEMINI_LIVE_MODEL` et `GEMINI_LIVE_VOICE` pilotent uniquement l'assistant vocal temps réel. Le chatbot texte continue d'utiliser `GEMINI_CHAT_MODEL`.

## Chatbot et RAG

La route principale du chatbot est `POST /api/chat`.

La source de vérité maintenue pour le profil, les statuts et les projets est :

```txt
public/data/rag-knowledge-base.json
```

Le portfolio charge cette base via `public/portfolio-data.js`. `public/profile.json` est une copie de compatibilité générée, et non une seconde source à modifier manuellement. `public/cv-text.txt` reste le récit professionnel lisible; `npm run rag:validate` vérifie les clarifications factuelles critiques entre ces sources.

L'index technique préconstruit se trouve dans :

```txt
public/rag/project-code-index.json
public/rag/project-index-report.json
public/rag/projects/*.md
```

`retrieve_project_code_context({ projectId, question, language })` sélectionne au maximum quelques passages pertinents. Les métadonnées conservent le dépôt, la branche, le chemin, le symbole, le type de passage, le statut d'implémentation, l'URL GitHub et le commit indexé. Le code, les tests et la configuration sont favorisés par rapport au README; aucun dépôt complet n'est injecté dans une requête.

Les dépôts sans licence explicite ou dont la réutilisation du code n'est pas clairement autorisée utilisent `indexPolicy: "metadata-only"`. L'index conserve alors uniquement une fiche prudente, le commit et des liens de vérification, sans copier d'extrait de code. C'est notamment le cas de PetNames et d'Histoire d'Os dans l'état vérifié le 15 juillet 2026.

Régénération et contrôle :

```bash
npm run rag:build
npm run rag:index-projects
npm run rag:validate
npm run rag:test
```

Pour auditer des clones locaux existants sans accès réseau :

```bash
node tools/rag/index-projects.mjs --source-root /chemin/vers/les-depots
```

L'indexeur ignore les fichiers `.env`, secrets, builds, dépendances copiées, binaires et médias lourds. Il clone ou lit les dépôts sans exécuter leur code. Il marque aussi les passages qui ressemblent à des instructions de prompt; ces passages restent des données non fiables et ne sont jamais placés dans l'instruction système.

Le chatbot texte place le contexte récupéré dans un bloc utilisateur délimité `BEGIN_UNTRUSTED_RETRIEVED_CONTEXT` / `END_UNTRUSTED_RETRIEVED_CONTEXT`. L'assistant vocal applique la même règle aux blocs RAG et aux réponses d'outil: le contenu des dépôts ne peut pas modifier le rôle, demander un secret ou déclencher un outil.

Le workflow `.github/workflows/rag-project-index.yml` fonctionne avec `contents: read`. Il reconstruit et teste l'index, publie le résultat comme artifact de revue, puis échoue si les fichiers versionnés ne sont pas à jour. Il ne committe et ne pousse jamais automatiquement sur `main`.

Les modèles ne sont pas codés en dur dans les appels :

```txt
OPENAI_CHAT_MODEL remplace le modèle OpenAI par défaut.
GEMINI_CHAT_MODEL remplace le modèle Gemini par défaut.
```

Le fournisseur OpenAI de `/api/chat` utilise `POST /v1/responses` avec un payload minimal (`model`, `instructions`, `input`) pour rester compatible avec les modèles récents/de raisonnement. Le frontend affiche le modèle OpenAI recommandé (`gpt-5.5`) dans le libellé du chatbot ; la valeur réellement utilisée reste remplaçable côté Vercel avec `OPENAI_CHAT_MODEL`.

Si OpenAI renvoie une erreur 400, le message utilisateur distingue une requête invalide d'un modèle indisponible pour la clé ou l'endpoint. Si OpenAI renvoie 429, le serveur logge le statut et le body upstream sans exposer de clé API. Si `GOOGLE_API_KEY` est disponible, `/api/chat` tente une bascule automatique vers Gemini ; sinon le message utilisateur indique clairement une limite de quota/rate limit et conseille de réessayer plus tard ou de changer de fournisseur.

Si Gemini renvoie 429, tester une variante moins sollicitée :

```txt
GEMINI_CHAT_MODEL=gemini-2.5-flash
GEMINI_CHAT_MODEL=gemini-2.5-flash-lite
```


## CV visibles

Les pages CV affichent les PDF publics suivants :

```txt
public/assets/cv/cv-fr.pdf
public/assets/cv/cv-en.pdf
public/assets/cv/cv-de.pdf
```

Remplacer un PDF visible ne met pas automatiquement à jour le chatbot : vérifier aussi `public/cv-text.txt` et `public/data/rag-knowledge-base.json`, puis lancer `npm run rag:build`, `npm run rag:validate` et `npm run rag:test`.
## Routes principales

`vercel.json` active `cleanUrls` et garde des rewrites de compatibilité.

À vérifier après modification :

```txt
/cv
/portfolio
/chatbot
/fun-facts
/passions
/lab
/ai-lab
/ai-lab.html
/ai-lab-en.html
/ai-lab-de.html
```

Les anciennes routes AI Lab pointent toutes vers `public/lab.html`.

## Mini procédure de test

Ping API :

```bash
curl http://localhost:3000/api/chat
# attendu: {"ok":true,"ping":"pong"}
```

POST OpenAI avec le modèle recommandé :

```bash
OPENAI_CHAT_MODEL=gpt-5.5 curl -N -X POST http://localhost:3000/api/chat \
  -H "content-type: application/json" \
  -d '{"provider":"openai","message":"Résume le profil en 3 points","lang":"fr"}'
```

POST Gemini avec un fallback moins limité :

```bash
GEMINI_CHAT_MODEL=gemini-2.5-flash-lite curl -N -X POST http://localhost:3000/api/chat \
  -H "content-type: application/json" \
  -d '{"provider":"google","message":"Quels projets EdTech sont mentionnés ?","lang":"fr"}'
```

Tests d'erreur à couvrir avant livraison : clé OpenAI absente, clé Google absente, et erreur upstream 429. Les messages utilisateur doivent rester compréhensibles et ne jamais exposer de clé API.

Tests RAG à couvrir avant livraison : questions générales sur le profil, statut réel des projets, vote Frustra, absence de collecteur social Frustra, architecture Vocal Walls et prudence lorsque le code ne suffit pas à confirmer une fonction.
