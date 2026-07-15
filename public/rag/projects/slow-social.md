# Slow Social

## Statut vérifié
prototype - vérifié le 2026-07-14.

## Résumé prudent
Prototype local d'un réseau social à rythme hebdomadaire.

## Ce qui fonctionne réellement
- Interface statique
- Brouillons localStorage
- Compte à rebours
- Publication locale
- Service Python d'ingestion RSS
- Tests unitaires de l'ingestion mock

## Ce qui est partiellement implémenté
- Ingestion RSS et filtrage sémantique séparés de la démonstration principale

## Ce qui est simulé
- Flux initial
- Données d'ingestion de secours
- Filtrage sémantique par heuristique

## Ce qui n'est pas encore implémenté
- Réseau social multi-utilisateur en production
- Algorithme sémantique avancé vérifié

## Architecture
- Démo locale côté client
- Services d'ingestion et filtrage expérimentaux séparés

## Fichiers importants
- index.html
- client/DraftManager.js
- ingestion/DataIngestionService.py
- filtering/SemanticFilter.ts
- tests/test_ingestion.py

## Technologies observées
- HTML
- CSS
- JavaScript
- Python
- TypeScript
- localStorage

## Contribution de Nicolas
- Concept et règles d'usage
- Direction des itérations et tests avec assistance IA

## Assistance IA
Prototypage assisté par IA/Codex.

## Composants tiers
- feedparser si installé

## Limites
- La démonstration principale fonctionne localement; l'ingestion utilise des mocks si les flux sont insuffisants.

## Affirmations sûres
- Prototype local testant un rythme social hebdomadaire.

## Affirmations interdites
- Réseau social opérationnel sans algorithme et avec utilisateurs réels.

## Divergences README / code
- La vision produit dépasse la démonstration locale et les services expérimentaux.

## Dépôt et démonstration
- https://github.com/Nix177/social_wellness_digest (master)
- Démonstration: https://nix177.github.io/social_wellness_digest/
