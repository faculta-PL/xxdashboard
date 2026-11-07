# Nazix — cahier des charges

Nazix est un espace de travail collaboratif en temps réel : notes, idées (Kanban), projets, fichiers, calendrier, équipe et chat. Interface sobre, responsive, sans données fictives.

## Stack

React + Vite + Tailwind. Persistance Firebase (Auth, Firestore, Storage) ou, à défaut, localStorage / IndexedDB.

## Modules

Tableau de bord, Espace visuel, Notes, Kanban, Projets, Budget, Risques, Fichiers, Calendrier, Recherche, Export, Notifications, Équipe, Chat, Paramètres, Import, Assistant IA, Jeux, Feedback, Création.

## Rôles

Administrateur · Responsable de projet · Membre · Lecteur.

Un Lecteur ne crée pas de contenus métier. Les contenus d’autrui ne sont lisibles ou éditables que s’ils sont partagés, publics / équipe, ou pour un administrateur.

## Sécurité

Aucun secret dans le dépôt ni dans le bundle client. Recoller `firestore.rules` et `storage.rules` dans la console Firebase après déploiement.
