# IA News Éthique

## Statut vérifié
demo - vérifié le 2026-07-14.

## Résumé prudent
Démonstrateur React qui transforme des sujets d'actualité en supports de discussion philosophique adaptés à l'âge.

## Ce qui fonctionne réellement
- Interface React multilingue
- Choix d'âge
- Appels à des webhooks n8n
- Mode de secours local

## Ce qui est partiellement implémenté
- Récupération et génération dynamiques, dépendantes de services n8n externes

## Ce qui est simulé
- Les données de secours comportent des sujets et liens d'exemple
- Une séance mock est générée si le webhook échoue

## Ce qui n'est pas encore implémenté
- Garantie autonome de vérification journalistique des sources

## Architecture
- Frontend React
- Services JavaScript appelant deux webhooks n8n
- Fallbacks statiques

## Fichiers importants
- src/App.jsx
- src/services/aiGenerator.js
- src/services/newsService.js

## Technologies observées
- React
- JavaScript
- n8n

## Contribution de Nicolas
- Cadrage pédagogique
- Conception des parcours
- Direction des itérations et tests avec assistance IA

## Assistance IA
Prototypage assisté par IA/Codex.

## Composants tiers
- n8n
- Sources journalistiques référencées par le service externe

## Limites
- La démonstration dépend de webhooks externes
- Les fallbacks ne doivent pas être présentés comme des actualités vérifiées

## Affirmations sûres
- Démonstrateur utilisable avec un mode de secours clairement limité.

## Affirmations interdites
- Analyse automatiquement et vérifie toute l'actualité mondiale de manière autonome.

## Divergences README / code
- Les descriptions générales peuvent suggérer une analyse complète; le code dépend de n8n et utilise des mocks en cas d'échec.

## Dépôt et démonstration
- https://github.com/Nix177/ia-news-ethique-ecole (main)
- Démonstration: https://nix177.github.io/ia-news-ethique-ecole/
