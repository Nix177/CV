# Agora Numérique, mode collectif

## Statut vérifié
prototype - vérifié le 2026-07-14.

## Résumé prudent
Prototype web de scénarios collectifs pour débattre de dilemmes éthiques en classe.

## Ce qui fonctionne réellement
- Deux scénarios statiques
- Moteur de scènes
- Gestion de choix et d'états
- Minuteur et sauvegarde
- Interface enseignant

## Ce qui est partiellement implémenté
- Dialogues IA et synthèse vocale dépendant d'une API configurée

## Ce qui est simulé
- Certaines interactions peuvent fonctionner avec des contenus préécrits

## Ce qui n'est pas encore implémenté
- Plateforme multi-utilisateur avec comptes et synchronisation temps réel vérifiée

## Architecture
- Site statique
- Scénarios JSON
- Moteur JavaScript
- Worker API optionnel

## Fichiers importants
- index.html
- scenarios/shogun/js/engine.js
- scenarios/eoliennes/assets/app.js
- scenarios/eoliennes/api/chat.js

## Technologies observées
- HTML
- CSS
- JavaScript
- Cloudflare Worker
- OpenAI API

## Contribution de Nicolas
- Conception pédagogique et scénarisation
- Direction des itérations, tests et documentation avec assistance IA

## Assistance IA
Prototypage assisté par IA/Codex.

## Composants tiers
- OpenAI API si configurée

## Limites
- Le terme multi-joueurs décrit un usage collectif en classe, pas un serveur de jeu multijoueur complet.

## Affirmations sûres
- Prototype collectif utilisable dans un cadre animé par un enseignant.

## Affirmations interdites
- Infrastructure multijoueur temps réel complète et stabilisée.

## Divergences README / code
- Aucun élément vérifié.

## Dépôt et démonstration
- https://github.com/Nix177/agora-numerique (main)
- Démonstration: https://nix177.github.io/agora-numerique/
