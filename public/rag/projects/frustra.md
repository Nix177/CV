# Frustra

## Statut vérifié
prototype - vérifié le 2026-07-14.

## Résumé prudent
Prototype React Native/Express d'un catalogue de problèmes avec vote local.

## Ce qui fonctionne réellement
- API Express de lecture et création de problèmes
- Vote avec déduplication par identifiant utilisateur
- Frontend Expo/React Native
- Générateur Go de rapport isolé

## Ce qui est partiellement implémenté
- Soumission et consultation depuis le frontend
- Rapport déclenchable comme programme séparé

## Ce qui est simulé
- Jeu initial de problèmes
- Comptes de votes
- Identités utilisateurs
- Commentaires et données de marché

## Ce qui n'est pas encore implémenté
- Collecteur opérationnel de réseaux sociaux
- Vérification d'identité réelle
- Pipeline intégré de rapports investisseurs
- Validation réelle de marché

## Architecture
- API Express avec données en mémoire
- ValidationEngine en mémoire
- Frontend Expo
- Expériences séparées Go/Python

## Fichiers importants
- backend/server.js
- backend/ValidationEngine.js
- backend/MarketReportGen.go
- frontend/app/(tabs)/index.tsx
- scraper/

## Technologies observées
- Node.js
- Express
- React Native
- Expo
- Go
- Python

## Contribution de Nicolas
- Concept, besoins et direction des itérations
- Tests et adaptation avec assistance IA

## Assistance IA
Prototypage assisté par IA/Codex.

## Composants tiers
- Express
- Expo
- React Native

## Limites
- Les problèmes et votes sont conservés en mémoire et perdus au redémarrage.
- Le dossier scraper ne prouve pas un collecteur social opérationnel intégré.

## Affirmations sûres
- Le vote fonctionne localement sur des données en mémoire et simulées.

## Affirmations interdites
- Frustra collecte réellement les réseaux sociaux.
- Frustra valide actuellement des marchés ou produit automatiquement des rapports investisseurs intégrés.

## Divergences README / code
- Le README présente un système de vérification d'identité et un scraper; le code vérifie seulement la présence d'un userId et aucun collecteur social intégré n'a été trouvé.

## Dépôt et démonstration
- https://github.com/Nix177/problem-first-db (master)
- Démonstration: https://nix177.github.io/problem-first-db/
