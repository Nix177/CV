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

## Déploiement Vercel

Le site reste statique côté public. Les routes API vivent dans `api/` et sont exécutées comme fonctions serverless Node.js.

Variables d'environnement à configurer dans Vercel :

```txt
OPENAI_API_KEY=...
OPENAI_CHAT_MODEL=gpt-5.5
GOOGLE_API_KEY=...
GEMINI_CHAT_MODEL=gemini-2.5-pro
```

Fallbacks OpenAI possibles si le modèle recommandé n'est pas disponible pour la clé ou l'endpoint :

```txt
OPENAI_CHAT_MODEL=gpt-5.4
OPENAI_CHAT_MODEL=gpt-5.4-mini
OPENAI_CHAT_MODEL=gpt-4o
```

Fallbacks Gemini possibles en cas de quota ou limite sur le modèle pro :

```txt
GEMINI_CHAT_MODEL=gemini-2.5-flash
GEMINI_CHAT_MODEL=gemini-2.5-flash-lite
```

`ALLOWED_ORIGINS` est utilisé par certains endpoints pour le CORS, notamment `/api/llm`, si l'accès doit être limité à des origines précises.

Ne jamais commiter de clé API. Les clés doivent rester dans les variables d'environnement Vercel ou dans un environnement local non versionné.

## Chatbot et RAG

La route principale du chatbot est `POST /api/chat`.

Le RAG réel indexe :

```txt
public/cv-text.txt
public/portfolio-data.js
```

`public/cv-text.txt` contient le contexte narratif et professionnel. `public/portfolio-data.js` contient les projets réellement affichés dans le portfolio. Le chatbot ne dépend pas de `profile.json` pour `/api/chat`.

Les modèles ne sont pas codés en dur dans les appels :

```txt
OPENAI_CHAT_MODEL remplace le modèle OpenAI par défaut.
GEMINI_CHAT_MODEL remplace le modèle Gemini par défaut.
```

Le fournisseur OpenAI de `/api/chat` utilise `POST /v1/responses` avec un payload minimal (`model`, `instructions`, `input`) pour rester compatible avec les modèles récents/de raisonnement. Le frontend affiche le modèle OpenAI recommandé (`gpt-5.5`) dans le libellé du chatbot ; la valeur réellement utilisée reste remplaçable côté Vercel avec `OPENAI_CHAT_MODEL`.

Si OpenAI renvoie une erreur 400, le message utilisateur distingue une requête invalide d'un modèle indisponible pour la clé ou l'endpoint. Si OpenAI renvoie 429, le serveur logge le statut et le body upstream sans exposer de clé API. Si `GOOGLE_API_KEY` est disponible, `/api/chat` tente une bascule automatique vers Gemini ; sinon le message utilisateur indique clairement une limite de quota/rate limit et conseille de réessayer plus tard ou de changer de fournisseur.

Si Gemini renvoie 429, tester un modèle moins limité :

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

Remplacer un PDF visible ne met pas automatiquement à jour le chatbot : vérifier aussi `public/cv-text.txt` pour le contexte narratif RAG et `public/portfolio-data.js` pour les projets affichés dans le portfolio.
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
