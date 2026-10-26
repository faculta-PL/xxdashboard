# XXDashboard

Application web collaborative temps réel pour la gestion unifiée des **notes**, **idées (Kanban)**, **projets** et **activités de groupe**.

Palette vert cassé / sauge · entièrement responsive · **aucune donnée fictive** au démarrage (hors compte administrateur préconfiguré).

## Stack

- **Frontend** : React (App monolithique `src/App.jsx`), Vite, Tailwind CSS, Lucide
- **Persistance** : Firebase Firestore (optionnel) avec repli **localStorage** temps réel simulé
- **Auth** : hachage SHA-256 (Web Crypto API), sessions `xx_sessions` (24 h), RBAC
- **Exports** : CSV (UTF-8 BOM), XLSX, DOCX, JSON, PDF

## Démarrage rapide

```bash
npm install
npm run dev
```

L’app écoute sur [http://127.0.0.1:3847](http://127.0.0.1:3847).

### Compte administrateur

| E-mail | Mot de passe |
|--------|--------------|
| `admin@xxdashboard.fr` | `Admin123!` |

## Firebase (optionnel)

Copiez `.env.example` vers `.env` et renseignez :

```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

Sans ces variables, XXDashboard fonctionne entièrement en **mode local** (données dans le navigateur). Le panneau **Paramètres → Diagnostic** permet de pousser / tirer les collections vers Firestore une fois configuré.

Collections : `xx_users`, `xx_sessions`, `xx_notes`, `xx_ideas`, `xx_projects`, `xx_events`, `xx_notifications`, `xx_reset_tokens`.

## Modules

1. Authentification (inscription, vérif. e-mail 6 chiffres, reset 2 étapes, sessions)
2. Tableau de bord (indicateurs live + raccourcis)
3. Notes (CRUD, catégories, étiquettes, visibilité, droits Lecture/Édition)
4. Boîte à idées Kanban (5 statuts, votes, historique, transformation Note/Projet)
5. Projets (responsable, membres, progression 0–100 %, notes/idées liées)
6. Calendrier (événements + notifications participants)
7. Recherche interne multi-filtres + recherche externe (API DuckDuckGo)
8. Export CSV / XLSX / DOCX / JSON / PDF
9. Centre de notifications
10. Paramètres, sessions, diagnostic Firebase, kit d’exportation

## Rôles (RBAC)

Administrateur · Responsable de projet · Membre · Lecteur

Les permissions sont appliquées dans l’UI et à l’écriture des entités (partage explicite requis pour lire / modifier les contenus d’autrui, hors public / admin).

## Build

```bash
npm run build
npm run preview
```
