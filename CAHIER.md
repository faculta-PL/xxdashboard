# Nazix — cahier des charges

## Produit

Nazix est un espace de travail collaboratif en temps réel : notes, idées (Kanban), projets, calendrier, équipe et chat de groupe. L’interface est sobre (palette vert cassé / sauge), entièrement responsive, et démarre **sans données fictives** (hors compte administrateur préconfiguré).

## Stack

- **Frontend** : React (`src/App.jsx`), Vite, Tailwind CSS, Lucide
- **Persistance** : Firebase Auth + Firestore, sinon **localStorage**
- **Exports** : CSV (UTF-8 BOM), XLSX, DOCX, JSON, PDF

## Comptes

- Administrateur : `facultamalika@gmail.com`
- Les autres comptes s’inscrivent via Connexion / Inscription.

## Modules

- Tableau de bord
- Notes
- Kanban (boîte à idées)
- Projets
- Calendrier
- Recherche
- Export
- Notifications
- Équipe
- Chat / groupes
- Paramètres

## Auth Firebase + repli local

Si les variables `VITE_FIREBASE_*` sont renseignées, Nazix utilise **Firebase Auth** (e-mail / mot de passe) et **Firestore**. Sinon, tout fonctionne en **localStorage** (mention « Mode local » dans la barre latérale et Paramètres).

## Rôles

Administrateur · Responsable de projet · Membre · Lecteur

Un Lecteur ne crée pas de notes, idées, projets ou groupes. Les contenus d’autrui ne sont lisibles ou éditables que s’ils sont partagés, publics, ou pour un administrateur.
