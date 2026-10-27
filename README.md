# XXDashboard

Application web collaborative temps réel pour la gestion unifiée des **notes**, **idées (Kanban)**, **projets** et **activités de groupe**.

Palette vert cassé / sauge · entièrement responsive · **aucune donnée fictive** au démarrage (hors compte administrateur préconfiguré).

## Stack

- **Frontend** : React (App monolithique `src/App.jsx`), Vite, Tailwind CSS, Lucide
- **Persistance** : Firebase Auth + Firestore lorsque `VITE_FIREBASE_*` est renseigné, sinon repli **localStorage**
- **Auth** : `createUserWithEmailAndPassword` / `signInWithEmailAndPassword` + profil `xx_users` (SHA-256 Web Crypto), sessions `xx_sessions` (24 h), RBAC
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

## Firebase (Auth + Firestore)

Sans clés, l’app tourne en **mode local** (bandeau sur l’écran de connexion + mention dans Paramètres). Aucune clé fictive n’est embarquée.

### Brancher un projet Firebase

1. Console Firebase → créer / ouvrir un projet → **Paramètres** → « Vos applications » → application Web → copier la config SDK.
2. Copier `.env.example` vers `.env` (jamais commité) et remplir :

```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

3. **Authentication** → Sign-in method → activer **E-mail/mot de passe**.
4. **Firestore Database** → créer la base. Règles d’exemple dans `firestore.rules` (lecture/écriture si `request.auth != null`).
5. Redémarrer Vite (`npm run dev`) pour recharger les variables `VITE_*`.

La barre latérale affiche alors **Firebase** (via `getBackendMode()`).

### Ce qui est écrit dans Firebase

| Action | Firebase Auth | Firestore |
|--------|---------------|-----------|
| Inscription | `createUserWithEmailAndPassword` | `xx_users` (fullName, email, passwordHash SHA-256, rôle Membre, emailVerified false, code 6 chiffres) + notification `xx_notifications` |
| Connexion | `signInWithEmailAndPassword` **et/ou** contrôle SHA-256 du profil Firestore | `xx_sessions` (jeton 24 h) |
| Premier démarrage | création du compte `admin@xxdashboard.fr` / `Admin123!` si possible | seed du même admin dans `xx_users` |
| Reset 2 étapes | `updatePassword` si l’utilisateur Auth courant correspond | `xx_reset_tokens` + notification |
| Déconnexion / révocation | `signOut` | `xx_sessions.active = false` |

Collections : `xx_users`, `xx_sessions`, `xx_notes`, `xx_ideas`, `xx_projects`, `xx_events`, `xx_notifications`, `xx_reset_tokens`.

**Paramètres → Diagnostic** permet de pousser / tirer les collections (admin) une fois Firebase configuré.

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
