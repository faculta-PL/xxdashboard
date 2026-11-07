# Nazix

Application web collaborative (notes, idées, projets, fichiers, équipe, chat).

## Local

```bash
cp .env.example .env
npm install
npm run dev
```

L’app écoute sur [http://127.0.0.1:3847](http://127.0.0.1:3847).

Copiez `.env.example` vers `.env` (fichier **non commité**) et renseignez vos variables. Sans `VITE_FIREBASE_*`, l’app tourne en local. `OPENAI_API_KEY` reste **côté serveur** — n’utilisez jamais `VITE_OPENAI_*`.

Exemple d’administrateur : `admin@example.com`. Définissez le mot de passe via l’inscription, ou via `VITE_ADMIN_EMAIL` / `VITE_ADMIN_PASSWORD` dans `.env`.

## Build

```bash
npm run build
npm run preview
```
