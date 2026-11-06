# Nazix

Application web collaborative temps réel pour la gestion unifiée des **notes**, **idées (Kanban)**, **projets**, **fichiers**, **équipe** et **chat de groupe**.

Palette vert cassé / sauge · entièrement responsive · **aucune donnée fictive** au démarrage (hors compte administrateur préconfiguré).

## Stack

- **Frontend** : React (App monolithique `src/App.jsx`), Vite, Tailwind CSS, Lucide — site **statique** (`dist`) sur **Vercel** ou **Netlify**
- **Backend** : Firebase projet **partagio** — Auth, Firestore, Storage, Cloud Function `ai` (OpenAI, région `us-central1`). **Vercel n’est pas le backend** : pas de serverless Vercel comme serveur produit
- **Persistance** : Firebase Auth + Firestore lorsque `VITE_FIREBASE_*` est renseigné, sinon repli **localStorage**
- **Auth** : `createUserWithEmailAndPassword` / `signInWithEmailAndPassword` + profil `xx_users` (SHA-256 Web Crypto), sessions `xx_sessions` (24 h), RBAC
- **Exports** : CSV (UTF-8 BOM), XLSX, DOCX, JSON, PDF

## Lancer en local

Pour utiliser Nazix sur votre machine (dossier copié ou archive zip) :

1. Copiez le dossier `Nazix`, ou dézippez l’archive du projet.
2. Dans le dossier du projet : `npm install`
3. Lancez : `npm run dev`

L’app écoute sur [http://127.0.0.1:3847](http://127.0.0.1:3847).

**Firebase** : si un fichier `.env` est présent (projet partagio), la persistance cloud fonctionne tout de suite. Sinon, copiez `.env.example` vers `.env` et renseignez les variables `VITE_FIREBASE_*` (API key, auth domain, project id, storage bucket, messaging sender id, app id). Sans ces variables, l’app tourne en mode **localStorage**. Redémarrer Vite après toute modification du `.env`.

**OpenAI** : en local, ajoutez `OPENAI_API_KEY=` dans `.env` (serveur Vite uniquement, **jamais** `VITE_OPENAI_*`). En production, la clé est le secret de la Cloud Function `ai` ; le front utilise `VITE_AI_URL`. Sans clé, l’assistant affiche « OpenAI indisponible ».

## Démarrage rapide

```bash
npm install
npm run dev
```

L’app écoute sur [http://127.0.0.1:3847](http://127.0.0.1:3847).

### Comptes administrateur

| E-mail | Mot de passe |
|--------|--------------|
| `admin@xxdashboard.fr` | `Admin123!` |
| `facultamalika@gmail.com` | `Malika2026!` |

## Firebase (Auth + Firestore)

Sans clés, l’app tourne en **mode local** (mention dans Paramètres). Aucune clé fictive n’est embarquée.

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
VITE_AI_URL=https://us-central1-partagio.cloudfunctions.net/ai
```

3. **Authentication** → Sign-in method → activer **E-mail/mot de passe**.
4. **Personnaliser les e-mails Auth (FR)** : Console Firebase → Authentication → **Templates**.
   - **Adresse e-mail** (vérification) : objet `Confirmez votre adresse e-mail — Nazix`. Corps : demander de cliquer le lien **et** préciser qu’un code à 6 chiffres est aussi affiché dans Nazix (Paramètres / Notifications).
   - **Réinitialisation du mot de passe** : objet `Réinitialisation de votre mot de passe — Nazix`. Indiquer de vérifier les indésirables, que le lien expire **après 1 heure**, puis de coller le code dans Nazix si le lien ne s’ouvre pas.
   - Les textes exacts que l’app montre à l’écran (ce que l’utilisateur doit chercher dans sa boîte) sont dans `src/lib/emailCopy.js`. Firebase n’autorise pas de designer ces modèles depuis le SPA : il faut les coller dans la console.
   - Expéditeur : domaine Auth vérifié. Sans envoi Firebase, Nazix affiche le code local et le message « e-mail Firebase indisponible, utilisez le code ci-dessous ».
5. **Firestore Database** → créer la base. Coller le contenu de `firestore.rules` dans **Règles** (isolation par utilisateur : propriétaire, partages, public, admin, membres des groupes). Les règles test ouvertes jusqu’au 2026-12-04 sont dans `firestore.rules.test.md` — à n’utiliser qu’en démo.
6. Connectez-vous une fois avec l’app **avant** de remplacer d’anciennes règles trop ouvertes, pour tamponner `ownerEmail` / `shareUserIds` sur vos documents.
7. Redémarrer Vite (`npm run dev`) pour recharger les variables `VITE_*`.
8. Déploiement CLI (si vous êtes connecté) : `firebase deploy --only firestore:rules` via `firebase.json`. Sans token CLI, le collage console suffit.

La barre latérale affiche alors **Firebase** (via `getBackendMode()`).

### Ce qui est écrit dans Firebase

| Action | Firebase Auth | Firestore |
|--------|---------------|-----------|
| Inscription | `createUserWithEmailAndPassword` + `sendEmailVerification` | `xx_users` (id = Auth uid, rôle Membre, code 6 chiffres de secours) + notification |
| Connexion | `signInWithEmailAndPassword` **et/ou** SHA-256 Firestore | `xx_sessions` (jeton 24 h, `userId` = Auth uid) |
| Premier démarrage | création Auth des admins `admin@xxdashboard.fr` et `facultamalika@gmail.com` si absents (sans auto-connexion) | seed des deux admins dans `xx_users` |
| Reset 2 étapes | `sendPasswordResetEmail` puis `confirmPasswordReset` (oobCode) ou `updatePassword` si session | `xx_reset_tokens` + notification de secours |
| Déconnexion / révocation | `signOut` | `xx_sessions.active = false` |
| Chat / groupes | — | `xx_groups`, `xx_messages` (membres uniquement) |

Collections : `xx_users`, `xx_sessions`, `xx_notes`, `xx_ideas`, `xx_projects`, `xx_events`, `xx_notifications`, `xx_reset_tokens`, `xx_groups`, `xx_messages`, `xx_files`, `xx_folders`, `xx_ai_threads`, `xx_settings`, `xx_dashboard_prefs`, `xx_game_profiles`, `xx_game_scores`.

**Fichiers** : activer **Storage** dans Firebase Console (choisir la région **avant** de créer le bucket — le client ne peut pas la définir). Coller `storage.rules` et `firestore.rules`. Bucket : `partagio.firebasestorage.app`. Taille max 20 Mo (`MAX_FILE_BYTES`). En mode local, blobs IndexedDB `nazix_files` (non synchronisés entre appareils).

**Paramètres → Diagnostic** permet de pousser / tirer les collections (admin) une fois Firebase configuré.

## Modules

1. Authentification (inscription, e-mail Firebase + code 6 chiffres de secours, reset oobCode / jeton, sessions)
2. Tableau de bord (indicateurs live + raccourcis)
3. Notes (CRUD, catégories, étiquettes, visibilité, droits Lecture/Édition)
4. Boîte à idées Kanban (5 statuts, votes, historique, transformation Note/Projet)
5. Projets (responsable, membres, progression 0–100 %, notes/idées liées)
6. Fichiers (dossiers, import 20 Mo, types pdf/docx/xlsx/csv/txt/images, partage membres + équipe, projet optionnel)
7. Calendrier (événements + notifications participants)
8. Équipe (annuaire : nom, e-mail, rôle, présence 24 h)
9. Chat et groupes (Général + groupes privés, messages temps réel)
10. Recherche interne multi-filtres + recherche externe (DuckDuckGo via `POST /api/ai-search`, sans CORS)
11. Export CSV / XLSX / DOCX / JSON / PDF
12. Centre de notifications
13. Paramètres, sessions, diagnostic Firebase, kit d’exportation
14. Assistant IA (OpenAI `gpt-4o-mini` via Cloud Function Firebase `ai` / `VITE_AI_URL`, ou `POST /api/ai` en local Vite ; clé `OPENAI_API_KEY` **serveur Firebase uniquement**, jamais dans le bundle. Repli extractif local seulement si la clé manque ou si l’API échoue.)

## Rôles (RBAC)

Administrateur · Responsable de projet · Membre · Lecteur

Les permissions sont appliquées dans l’UI et à l’écriture des entités (partage explicite requis pour lire / modifier les contenus d’autrui, hors public / admin / visibilité Équipe). Un Lecteur ne peut pas créer de notes, idées, projets, groupes, fichiers. Les messages d’un groupe ne sont lisibles et écrivables que par ses membres.

## Build

```bash
npm run build
npm run preview
```

`npm run preview` (port 3847) exécute encore le middleware Vite `POST /api/ai` en local. **Vercel / Netlify ne servent que le `dist` statique** : ils n’exécutent pas `vite.config.js`. En production, le client appelle la Cloud Function Firebase `ai` (`VITE_AI_URL`).

## Déployer ailleurs

**Vercel / Netlify = le site. Firebase partagio = le backend** (Auth, Firestore, Storage, function OpenAI). Ne pas s’appuyer sur les serverless Vercel comme backend produit.

1. **Frontend** (Vercel ou Netlify) : `npm run build`, publier `dist`, variables `VITE_FIREBASE_*` + `VITE_AI_URL=https://us-central1-partagio.cloudfunctions.net/ai`.
2. **Backend** (Firebase **partagio**) : données (Auth, Firestore, Storage) + secret OpenAI sur la function `ai` : `firebase functions:secrets:set OPENAI_API_KEY` puis `firebase deploy --only functions`.
3. Ajouter le domaine `*.vercel.app` (ou Netlify) dans Firebase Console → Authentication → **Settings** → **Authorized domains**.

Sans `VITE_AI_URL`, le client garde `/api/ai` (Vite en local). Le fichier `api/ai.js` + rewrites `vercel.json` sont un **repli optionnel**, pas le backend : la clé OpenAI et les données restent sur Firebase.

### Firebase Hosting (optionnel, même projet **partagio**)

La région Storage est déjà choisie dans la console : ne pas la recréer. `firebase login` se lance **sur votre machine**.

1. `npm run build`
2. `firebase login`
3. `firebase use partagio`
4. `firebase functions:secrets:set OPENAI_API_KEY` (coller la clé ; elle reste côté Functions)
5. `firebase deploy`

Hosting sert `dist/` (SPA → `index.html`). Les URLs `/api/**` sont réécrites vers la function HTTPS `ai` (`us-central1`). CORS autorise `partagio.web.app`, `*.vercel.app` et `*.netlify.app`.
