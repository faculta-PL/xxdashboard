# Nazix — cahier des charges

## Produit

Nazix est un espace de travail collaboratif en temps réel : notes, idées (Kanban), projets, fichiers, calendrier, équipe et chat de groupe. L’interface est sobre (palette vert cassé / sauge), entièrement responsive, et démarre **sans données fictives** (hors compte administrateur préconfiguré).

## Stack

- **Frontend** : React (`src/App.jsx`), Vite, Tailwind CSS, Lucide
- **Persistance** : Firebase Auth + Firestore + Storage, sinon **localStorage** / **IndexedDB**
- **Exports** : CSV (UTF-8 BOM), XLSX, DOCX, JSON, PDF

## Comptes

- Administrateurs : `admin@xxdashboard.fr` et `facultamalika@gmail.com`
- Les autres comptes s’inscrivent via Connexion / Inscription.

## Modules

- Tableau de bord (widgets réels, disposition `xx_dashboard_prefs`)
- **Espace visuel** (canvas — ne remplace pas les modules)
- Notes (sous-notes `parentId`, liens)
- Kanban (boîte à idées)
- Projets
- **Budget**
- **Risques et solutions**
- **Fichiers**
- Calendrier
- Recherche (notes, sous-notes, fichiers, budgets, risques)
- Export
- Notifications
- Équipe
- Chat / groupes
- Paramètres
- **Import** (assistant réutilisable, visibilité privée)
- **Assistant IA** (OpenAI par défaut si `OPENAI_API_KEY` serveur ; repli local seulement si indisponible)
- **Jeux** (arcade distincte : KingX Cueillette, Zianotix Vol, Relais Duo)

## Guide in-app

Première connexion : visite optionnelle en 5 étapes (Passer pour ignorer), persistée dans `localStorage` (`nazix_guide_done`). Un item **Guide** dans Outils liste Tableau de bord, Projets, Notes, Kanban, Fichiers, Budget, Risques, Chat, Jeux, Assistant, avec une carte d’intro repliable par module (`?` dans l’en-tête). Démos CSS ~10 s (notes, kanban, projets, chat) sur le Guide et la landing « Voir la démo ».

## E-mails Auth (modèles Firebase)

Le SPA ne peut pas styler les e-mails Firebase. Coller les modèles FR dans **Console → Authentication → Templates** (objets et corps dans `src/lib/emailCopy.js`). Inscription : `sendEmailVerification` + code à 6 chiffres (toast, notification, écran de succès). Reset : `sendPasswordResetEmail`, lien 1 h, étapes spam / coller le code. Si l’envoi Firebase échoue : toast + « e-mail Firebase indisponible, utilisez le code ci-dessous ».

## Auth Firebase + repli local

Si les variables `VITE_FIREBASE_*` sont renseignées, Nazix utilise **Firebase Auth** (e-mail / mot de passe), **Firestore** et **Storage**. Sinon, tout fonctionne en **localStorage** (métadonnées) et **IndexedDB** (blobs fichiers), avec mention « Mode local » dans la barre latérale et Paramètres.

## Rôles

Administrateur · Responsable de projet · Membre · Lecteur

Un Lecteur ne crée pas de notes, idées, projets, groupes ou fichiers. Les contenus d’autrui ne sont lisibles ou éditables que s’ils sont partagés, publics / équipe, ou pour un administrateur.

## Module Fichiers

Collections Firestore `xx_files` et `xx_folders` (écoute `onSnapshot`, comme les autres modules).

### Décisions verrouillées

- **Taille max** : **20 Mo**, constante unique `MAX_FILE_BYTES` (`src/lib/files.js`), affichée dans Paramètres. Facile à changer.
- **Types autorisés** : pdf, docx, xlsx, csv, txt, jpg, jpeg, png, gif, webp.
- **Types bloqués** : exécutables et formats XSS (`exe`, `bat`, `cmd`, `sh`, `js`, `msi`, `apk`, `html`, `svg`, etc.). Validation **avant** téléversement (extension + MIME + taille).
- **Partage** : membres choisis (même `ShareEditor` que les notes, droits **Lecture / Modification / Gestion**) **et** case **« Toute l’équipe »** (visibilité **Équipe** = lisible par tout compte connecté, analogue à Publique).
- **Projet associé** : optionnel, liste des projets existants.
- **Région Storage** : **impossible à définir depuis le client**. L’utilisateur doit choisir la région dans **Firebase Console avant de créer le bucket**. Bucket existant : `partagio.firebasestorage.app` (`VITE_FIREBASE_STORAGE_BUCKET`).

### Données

**Dossier** : `id`, `name`, `parentId` (ou null), `ownerId`, `ownerEmail`, `projectId`, `shares[{userId, permission: Lecture|Modification|Gestion}]`, `shareUserIds`, `visibility` (Privée | Partagée | Équipe), `createdAt`, `updatedAt`, `history[]`.

**Fichier** : `id`, `name`, `mime`, `ext`, `size`, `folderId`, `ownerId`, `ownerEmail`, `projectId`, `description`, `storagePath` (Firebase) **ou** `localId` (IndexedDB), `shares`, `shareUserIds`, `visibility`, `createdAt`, `updatedAt`, `history[]`, `uploadedBy`.

### Permissions (héritage)

Les droits d’un dossier s’appliquent aux enfants. Permission effective = max(partage propre, partage des dossiers ancêtres, propriétaire, admin). Ordre : **Gestion > Modification > Lecture**.

- **Admin** : tout
- **Responsable de projet** : gère les fichiers / dossiers dont le `projectId` correspond à un projet qu’il peut éditer (`canEditEntity`) **ou** dont il est `leadId`
- **Membre** : ajoute / modifie si `canWriteRole` **et** (propriétaire ou Modification / Gestion)
- **Lecteur** : lecture + téléchargement des éléments partagés (ou Équipe) uniquement — pas d’ajout, d’édition ni de suppression

Contrôle **dans `store.js` à l’écriture**, pas seulement dans l’UI. Règles Firestore : propriétaire, `shareUserIds`, visibilité Équipe = tout utilisateur connecté, admin.

### Stockage

- **Firebase** : `getStorage`, `uploadBytesResumable` (barre de progression + annulation). Chemins `files/{uid}/{fileId}/…`. Pas d’URL publique sans auth : le client utilise `getBlob` **après** contrôle Firestore. Coller `storage.rules` dans la console.
- **Local** : blobs IndexedDB `nazix_files`. Bannière : « Mode local — fichiers non synchronisés entre appareils ».

### UI

Entrée de navigation **Fichiers** (icône FolderOpen). Barre d’outils : importer, nouveau dossier, recherche, filtres dossier / type / auteur, bascule liste / grille. États vide, chargement, erreur, progression, terminé, accès refusé, aucun résultat. Aperçu : images (`img`), PDF (`iframe` blob URL), autres : téléchargement. Confirmation de suppression de dossier (contenu inclus). Renommer / déplacer / description dès **Modification**. Notifications `notifyUsers` au partage et à l’ajout. Historique.

Responsive : pile mobile, cartes en liste, filtres qui passent à la ligne.

## Module Budget

Collection Firestore `xx_budgets` (fiche budget rattachée à un projet) et `xx_budget_lines` (lignes Prévision / Réel / Salaires). Écoute `onSnapshot`, comme les notes.

### Décisions verrouillées

- **Devise** : EUR ou USD.
- **Catégories de ligne** : Salaires et rémunérations, Matériel et équipements, Fournitures et produits, Transport et déplacements, Marketing et communication, Frais administratifs, Prestataires et services, Autres.
- **Salaires** : intitulé de poste (`roleTitle`) et période due — **jamais** d’identifiant personnel.
- **Totaux automatiques** : total prévu (saisi), somme des lignes prévisionnelles, somme réelle (hors annulé), payé (réel `paid`), restant (`plannedTotal − payé`), écart prévision / réel, % consommé (`payé / plannedTotal`).
- **Partage** : Lecture / Édition, visibilité Privée · Partagée · Équipe · Publique (même schéma `shares` / `shareUserIds` que les notes).

### Permissions

- **Admin** : tout
- **Responsable de projet** : gère les budgets des projets dont il est `leadId` ou qu’il peut éditer (`canEditEntity`)
- **Membre** : crée ; modifie s’il est propriétaire ou a le partage **Édition**
- **Lecteur** : lecture des budgets partagés (ou Équipe / Publique) uniquement — pas de création, édition ni suppression

Contrôle **dans `store.js` à l’écriture**. Règles Firestore : connecté, propriétaire, `shareUserIds`, visibilité Équipe / Publique, admins `admin@xxdashboard.fr` et `facultamalika@gmail.com`.

## Module Risques et solutions

Collections `xx_risks` et `xx_risk_actions`. Priorité **calculée** : élevée si probabilité et impact sont élevés ; moyenne si l’un des deux l’est ; sinon faible.

### Données

**Risque** : projet, titre, description, catégorie (budget, délai, fournisseur, produit, équipe, qualité, réglementation, autre), probabilité (faible / moyenne / élevée), impact (faible / moyen / élevé), priorité, assigné, dates, statut (nouveau, à l’étude, en cours, résolu, écarté), partage, commentaires, historique.

**Action** : titre, assigné, échéance, statut (à faire / en cours / terminée), commentaires. Une action en retard à la création ou mise à jour notifie l’assigné et le propriétaire via `notifyUsers`.

Échéance dépassée ou dans les 7 jours : mise en évidence. Tableau de bord : compteur de risques ouverts, % du premier budget, bloc « Risques en retard » et reste budgétaire.

## Sous-notes et liens

Les notes portent un `parentId` (null = racine) en plus de `projectId`. Collection `xx_links` : `{id, fromType, fromId, toType, toId, createdBy, createdAt}`. Types : `note`, `file`, `idea`, `project`, `budget_line`, `risk`, `event`, `task` (alias d’idée). La fiche projet affiche l’arbre des notes liées, plus fichiers, idées, événements, budgets, risques. L’éditeur de note choisit une note parente et des liens fichier / risque / dépense / idée.

## Assistant d’import

`ImportModal` : txt, md, docx, pdf, xlsx, csv. Taille max `MAX_FILE_BYTES` (20 Mo). Extraction txt/md/csv/xlsx ; pdf/docx : fichier original + collage. Jamais de partage automatique (Privée). Destinations : Notes (+ original dans Fichiers lié), Projets, Fichiers, Budget (lignes prévisionnelles éditables), Risques. Bouton **Importer** sur Notes, Projets, Fichiers, Budget, Risques et l’espace visuel.

## Espace visuel

Navigation **Espace visuel** (`BoxSelect`). Cartes filtrables (projet / type / recherche), glisser-déposer souris et tactile, traits SVG pour `xx_links`. Positions : `xx_canvas_layout` `{userId, positions:{entityKey:{x,y}}, updatedAt}`. Lecture si l’entité est lisible ; déplacement si `canWriteRole`. N’enlève aucun module.

## Assistant IA

Navigation **Assistant IA** (`Sparkles`) : liste des conversations + chat. Bouton flottant sur Tableau de bord, Notes, Idées, Projets, Calendrier, Fichiers, Budget, Risques, Espace visuel — panneau 360 px à droite (feuille plein écran sur mobile).

### Sécurité

- Le client **n’a jamais** de clé API. Pas de `VITE_OPENAI_*` ni secret dans le bundle.
- Middleware Vite `POST /api/ai`, `POST /api/ai/stream` (SSE) et `POST /api/ai-search` (`configureServer` **et** `configurePreviewServer`) : lit `OPENAI_API_KEY` (prioritaire) ou `ANTHROPIC_API_KEY` / `GROK_API_KEY` **côté serveur**. Avec clé : `{ ok:true }` — conversation OpenAI (`gpt-4o-mini`, ~30 s, multi-tour). Sans clé : `{ ok:false, error:'OPENAI_API_KEY manquante' }` et repli extractif local, avec le message **« OpenAI indisponible: {raison} »**.
- Par défaut, si le serveur a une clé, OpenAI est utilisé automatiquement. Bannière : « Réponses via OpenAI. N’envoyez que le contexte de vos contenus autorisés. »
- Recherche web : fetch **serveur** DuckDuckGo Instant Answer (pas de CORS). Sources + date, libellé **Web** distinct de **Nazix**. L’assistant peut l’utiliser si l’utilisateur le demande.
- Contexte : uniquement `canReadEntity` (ids, titres, extraits). Affiché : « Contexte : Notes (3) · Projet X ».
- Pas de mémoire croisée. L’IA ne supprime pas, ne partage pas, ne change pas les ACL. Toute action (note, sous-note, idée, risque, ligne budgétaire, message) est un **aperçu + confirmation**. Lecteur : actions d’écriture désactivées. Message à un membre : destinataire + brouillon + confirmer, puis notification et/ou chat Général.

### Données

`xx_ai_threads` : `{id, userId, title, section, contextLabel, messages:[{role, content, sources?, at}], createdAt, updatedAt}` — **propriétaire uniquement** (lecture / écriture / suppression). `xx_settings` : préférences utilisateur (`aiExternalEnabled`).

Sans clé LLM, le repli local (`src/lib/assistant.js`) résume les notes, liste les risques en retard, calcule le restant budgétaire, les prochains événements, et répond « je n’ai pas trouvé » si le contexte ne suffit pas — ce n’est pas le mode produit.

## Navigation groupée

- **Espace de travail** : Tableau de bord, Projets, Notes, Kanban, Calendrier, Fichiers, Budget, Risques, Espace visuel
- **Collaboration** : Équipe, Chat, Notifications
- **Outils** : Recherche, Exports, Assistant IA
- **Détente** : Jeux
- Rail repliable (icônes) sur bureau ; tiroir mobile inchangé.

## Tableau de bord

Widgets (données `canReadEntity` uniquement) : projets + progression, kanban à faire, événements, notes, fichiers, reste budgétaire, risques élevés + actions en retard, extrait de chat, raccourcis de création. Disposition `xx_dashboard_prefs` `{userId, hidden, order, favoriteProjectId}` — Firestore + local.

## Jeux (hors travail)

Vue `games` : coque arcade crème / sauge, bouton « Retour au travail », sans widgets métier. Personnages officiels **KingX** et **Zianotix**. Pseudo `xx_game_profiles` unique (pas KingX / Zianotix). Scores `xx_game_scores` **append-only** (création de son score, pas de mise à jour). Classement global / par jeu / records / récents — libellé « Classement local » si `getBackendMode()==='local'`.

## Règles Firestore à recoller

Collections `xx_links`, `xx_canvas_layout`, `xx_ai_threads` (propriétaire), `xx_settings`, `xx_dashboard_prefs` (propriétaire), `xx_game_profiles` (lecture connectée, écriture du sien), `xx_game_scores` (lecture connectée, create si `userId == auth.uid` et `score` number, **pas d’update**). **Recoller `firestore.rules` dans Firebase Console → Firestore → Règles** après déploiement.
