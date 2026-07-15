# Vocal Walls

## Statut vérifié
prototype - vérifié le 2026-07-14.

## Résumé prudent
Prototype web et mobile de notes audio géolocalisées avec backend Express.

## Ce qui fonctionne réellement
- Backend Express
- Routes de santé, lecture et création de notes
- Téléversement audio
- Calcul de distance
- Votes et signalements
- Limitation d'écritures
- Frontend web
- Application Expo/React Native
- Tests API

## Ce qui est partiellement implémenté
- Déploiement public complet et persistance selon l'environnement
- Expérience mobile de terrain

## Ce qui est simulé
- Des données de démonstration peuvent être utilisées côté interface

## Ce qui n'est pas encore implémenté
- Preuve d'une grille H3 opérationnelle
- Preuve d'un moteur audio spatial 3D complet
- Preuve d'un système d'entropie numérique

## Architecture
- Backend REST
- Stockage et uploads
- Frontend web
- Client mobile Expo

## Fichiers importants
- backend/src/app.js
- backend/src/index.js
- backend/tests/api.test.js
- App.js
- js/app.js
- mobile/App.js

## Technologies observées
- Express
- Node.js
- Multer
- React Native
- Expo
- JavaScript

## Contribution de Nicolas
- Conception du besoin
- Direction des itérations
- Tests, débogage et documentation avec assistance IA

## Assistance IA
Développement assisté par IA/Codex.

## Composants tiers
- Express
- Multer
- Expo
- React Native Maps

## Limites
- Le dépôt contient plusieurs clients et un backend, mais l'état du déploiement de production n'est pas confirmé par l'index.

## Affirmations sûres
- Prototype multi-interface avec logique backend et tests présents.

## Affirmations interdites
- Plateforme de réalité augmentée sonore complète avec H3, audio 3D et entropie opérationnels.

## Divergences README / code
- Le positionnement conceptuel va au-delà des fonctions vérifiables dans le code actuel.

## Dépôt et démonstration
- https://github.com/Nix177/audio-geo-notes (main)
- Démonstration: https://nix177.github.io/audio-geo-notes/
