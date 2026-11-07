/** Textes du guide in-app — français, modules réellement présents. */

export const GUIDE_STORAGE_KEY = 'nazix_guide_done'
export const INTRO_STORAGE_KEY = 'nazix_intro_collapsed'

export const FIRST_LOGIN_STEPS = [
  {
    id: 'welcome',
    title: 'Bienvenue dans Nazix',
    body: 'Un seul espace pour vos notes, projets, fichiers et échanges. Cette visite dure moins d’une minute. Vous pourrez la rejouer depuis Guide.',
    target: 'dashboard',
  },
  {
    id: 'work',
    title: 'L’espace de travail',
    body: 'Le menu de gauche groupe les modules : Tableau de bord, Projets, Notes, Kanban, Calendrier, Fichiers, Budget et Risques. Chaque onglet s’ouvre en haut de page.',
    target: 'projects',
  },
  {
    id: 'collab',
    title: 'Équipe et chat',
    body: 'Invitez des collègues, partagez une note ou un projet, puis discutez dans Chat (groupe Général ou privé). Rien n’est public hors de votre espace.',
    target: 'chat',
  },
  {
    id: 'tools',
    title: 'Assistant et exports',
    body: 'L’Assistant IA parle via OpenAI (clé serveur). Recherche et Exports (CSV, PDF, DOCX) sont dans Outils. Un point d’interrogation sur chaque module rappelle à quoi il sert.',
    target: 'assistant',
  },
  {
    id: 'fun',
    title: 'Guide et pause',
    body: 'Le Guide (Outils) liste tous les modules avec une courte démo. KingX et Zianotix vous attendent dans Jeux — hors du travail, sans widgets métier.',
    target: 'guide',
  },
]

/** Une icône Lucide est déjà dans la nav. Ici : sous-titre 1 ligne + un emoji discret pour l’intro. */
export const MODULE_CHROME = {
  dashboard: { emoji: '🌿', subtitle: 'Ce que vous pouvez déjà lire, en un coup d’œil.' },
  projects: { emoji: '🗂️', subtitle: 'Un livrable, un responsable, une visibilité claire.' },
  notes: { emoji: '📝', subtitle: 'Une capture rapide, privée par défaut.' },
  ideas: { emoji: '💡', subtitle: 'La boîte à idées, sans pression.' },
  files: { emoji: '📎', subtitle: 'Vos documents, avec un cadenas visible.' },
  budget: { emoji: '💶', subtitle: 'Prévision et réel — jamais de nom de personne.' },
  risks: { emoji: '⚠️', subtitle: 'Nommer un risque, puis le traiter.' },
  chat: { emoji: '💬', subtitle: 'Général pour tout le monde, groupes pour un cercle.' },
  games: { emoji: '🎮', subtitle: 'Une pause, hors du travail.' },
  assistant: { emoji: '✨', subtitle: 'Des réponses, jamais d’action sans confirmer.' },
  calendar: { emoji: '📅', subtitle: 'Les rendez-vous sur leur jour.' },
  team: { emoji: '👥', subtitle: 'Qui est là, et avec quel rôle.' },
  notifications: { emoji: '🔔', subtitle: 'Partages et invitations, sans bruit inutile.' },
  search: { emoji: '🔎', subtitle: 'Cherchez dans ce que vous avez le droit de lire.' },
  export: { emoji: '📤', subtitle: 'Un extrait de ce que vous voyez déjà.' },
  canvas: { emoji: '🗺️', subtitle: 'Une carte, sans remplacer les modules.' },
  settings: { emoji: '⚙️', subtitle: 'Profil et sessions — aucun secret à l’écran.' },
  guide: { emoji: '📘', subtitle: 'Le mode d’emploi, en quelques phrases.' },
  feedback: { emoji: '🌱', subtitle: 'Une idée d’amélioration, envoyée à l’admin.' },
  create: { emoji: '🎨', subtitle: 'Image ou flyer, clé restée côté serveur.' },
}

export const MODULE_GUIDES = {
  dashboard: {
    title: 'Tableau de bord',
    lead: 'Vue d’ensemble de ce que vous pouvez déjà lire : projets, idées à faire, échéances, notes et reste budgétaire.',
    bullets: [
      'Les widgets n’affichent que des données réelles, jamais d’exemples fictifs.',
      'Masquez, réordonnez ou épinglez un projet favori — la disposition est mémorisée.',
      'Les raccourcis « Créer » ouvrent le bon module, déjà prêt à saisir.',
    ],
  },
  projects: {
    title: 'Projets',
    lead: 'Pilotez un livrable : titre, responsable, membres, dates, progression et visibilité.',
    bullets: [
      'Le titre est le premier champ du formulaire — enregistrez depuis le pied toujours visible.',
      'Reliez notes, fichiers, budget et risques pour tout voir sur la fiche projet.',
      'Partagez en Lecture ou Édition : hors partage, le contenu reste au propriétaire.',
    ],
  },
  notes: {
    title: 'Notes',
    lead: 'Captures rapides, catégories, étiquettes, sous-notes et liens vers le reste de Nazix.',
    bullets: [
      'Une note racine peut porter des sous-notes (note parente).',
      'Voir ouvre la note en lecture (les vôtres et celles partagées). Modifier et Supprimer restent selon vos droits.',
      'Visibilité Privée, Partagée ou Publique, avec droits Lecture / Édition.',
      'Importez un fichier : titre + contenu extraits, ou « Note (texte brut) » pour tout coller.',
    ],
  },
  ideas: {
    title: 'Kanban',
    lead: 'La boîte à idées : cinq statuts, votes, historique, puis transformation en note ou projet.',
    bullets: [
      'Glissez une carte d’une colonne à l’autre pour changer le statut.',
      'Votez pour faire remonter une idée en réunion.',
      '« En note » ou « En projet » reprend le titre et la description sans tout resaisir.',
    ],
  },
  files: {
    title: 'Fichiers',
    lead: 'Dossiers, import (20 Mo), aperçu PDF et images, partage membre ou toute l’équipe.',
    bullets: [
      'Types acceptés : pdf, docx, xlsx, csv, txt, images — pas d’exécutables ni de HTML.',
      'Les droits d’un dossier s’appliquent à son contenu.',
      'En mode local, les fichiers restent sur cet appareil (IndexedDB).',
    ],
  },
  budget: {
    title: 'Budget',
    lead: 'Un budget par projet, avec prévision, réel et salaires — totaux calculés tout seuls.',
    bullets: [
      'Les salaires portent un intitulé de poste, jamais un nom de personne.',
      'Le restant = total prévu moins le payé ; l’écart compare prévision et réel.',
      'Commentez une ligne pour garder la trace d’une décision.',
    ],
  },
  risks: {
    title: 'Risques',
    lead: 'Identifiez un risque, calculez sa priorité, puis suivez les actions jusqu’à la résolution.',
    bullets: [
      'Priorité élevée seulement si probabilité et impact sont élevés.',
      'Une action en retard notifie l’assigné et le propriétaire.',
      'Filtrez par projet, personne, priorité ou statut.',
    ],
  },
  chat: {
    title: 'Chat',
    lead: 'Le groupe Général accueille tout le monde ; créez des groupes privés pour un cercle restreint.',
    bullets: [
      'Les messages d’un groupe ne sont lisibles que par ses membres.',
      'Un compteur sur le menu signale les messages non lus.',
      'Invitez depuis la fiche du groupe, pas par e-mail externe.',
    ],
  },
  games: {
    title: 'Jeux',
    lead: 'Une pause arcade : KingX Cueillette, Zianotix Vol et Relais Duo, sans widgets métier.',
    bullets: [
      'Choisissez un pseudo unique (pas KingX ni Zianotix).',
      'Les scores s’ajoutent, ils ne se réécrivent pas.',
      '« Retour au travail » ramène au tableau de bord.',
    ],
  },
  assistant: {
    title: 'Assistant IA',
    lead: 'Conversation OpenAI sur vos données visibles. Aucune clé API dans le navigateur.',
    bullets: [
      'Réponses via OpenAI. N’envoyez que le contexte de vos contenus autorisés.',
      'Chaque action (créer une note, un risque…) demande confirmation.',
      'Le bouton flottant n’empêche pas d’ouvrir un formulaire : le modal passe devant.',
    ],
  },
  calendar: {
    title: 'Calendrier',
    lead: 'Grille mensuelle (ou semaine) : les rendez-vous s’affichent sur leur date.',
    bullets: [
      'Cliquez un jour pour lister les événements et en créer un.',
      'Les événements partagés apparaissent chez les invités.',
      'Reliez un rendez-vous à un projet depuis la fiche projet.',
    ],
  },
  team: {
    title: 'Équipe',
    lead: 'Annuaire des comptes : nom, e-mail, rôle et présence sur 24 h.',
    bullets: [
      'Les rôles (Admin, Responsable, Membre, Lecteur) limitent la création.',
      'Un Lecteur consulte ce qui lui est partagé, sans créer.',
      'La présence se base sur les sessions actives.',
    ],
  },
  notifications: {
    title: 'Notifications',
    lead: 'Partages, invitations, codes de vérification et actions en retard.',
    bullets: [
      'Un son discret signale une nouvelle non-lue ; coupez-le dans Paramètres.',
      'Le code e-mail à 6 chiffres arrive aussi ici si Firebase est muet.',
      'Marquez comme lu, ou tout lire d’un coup.',
    ],
  },
  search: {
    title: 'Recherche',
    lead: 'Filtrez notes, idées, projets, fichiers, budgets et risques dans votre périmètre.',
    bullets: [
      'La recherche respecte les droits de lecture.',
      'Les sous-notes et fichiers liés apparaissent dans les résultats.',
      'Une recherche web optionnelle passe par le serveur, jamais en CORS navigateur.',
    ],
  },
  export: {
    title: 'Exports',
    lead: 'Sortez un extrait CSV, XLSX, DOCX, JSON ou PDF de ce que vous voyez.',
    bullets: [
      'Les CSV portent un BOM UTF-8 pour Excel.',
      'Seul le contenu autorisé est exporté.',
      'Utile pour une réunion hors ligne ou une archive.',
    ],
  },
  canvas: {
    title: 'Espace visuel',
    lead: 'Une carte pour poser notes, projets et liens, sans remplacer les modules.',
    bullets: [
      'Glissez les cartes ; les traits reprennent les liens existants.',
      'La disposition est personnelle (par compte).',
      'Ouvrez un module depuis une carte pour éditer vraiment l’élément.',
    ],
  },
  feedback: {
    title: 'Feedback',
    lead: 'Proposez une amélioration ou une nouvelle fonction. L’admin est notifié ; un Lecteur peut envoyer.',
    bullets: [
      'Titre, message, module optionnel.',
      '« Aider-moi à formuler » clarifie le texte via l’IA, puis vous confirmez.',
      'Seul un administrateur peut supprimer un retour.',
    ],
  },
  create: {
    title: 'Création',
    lead: 'Générez une image (serveur) ou un flyer PDF (sans API). Aucune clé dans le navigateur.',
    bullets: [
      'La génération d’image est asynchrone, avec une barre de progression.',
      'Le rôle Lecteur ne génère pas.',
      'Vous pouvez enregistrer l’image dans Fichiers.',
    ],
  },
  settings: {
    title: 'Paramètres',
    lead: 'Profil, vérification d’e-mail, sessions, diagnostic Firebase et kit d’export.',
    bullets: [
      'Collez le code à 6 chiffres si le lien Firebase n’arrive pas.',
      'Révoquez une session perdue ou un autre appareil.',
      'Le mode local est indiqué tant que les clés VITE_FIREBASE_* manquent.',
    ],
  },
  guide: {
    title: 'Guide',
    lead: 'Mode d’emploi interne : chaque module en quelques phrases, plus des démos de 10 secondes.',
    bullets: [
      'Rejouez la visite de première connexion quand vous voulez.',
      'Les clips sont des animations Nazix, pas des films promotionnels.',
      'Rien ici n’écrit dans vos projets.',
    ],
  },
}

export const GUIDE_INDEX = [
  'dashboard',
  'projects',
  'notes',
  'ideas',
  'files',
  'budget',
  'risks',
  'chat',
  'games',
  'assistant',
  'create',
  'feedback',
]

export function readGuideDone() {
  try {
    return localStorage.getItem(GUIDE_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function writeGuideDone() {
  try {
    localStorage.setItem(GUIDE_STORAGE_KEY, '1')
  } catch {
    /* ignore */
  }
}

export function readIntroCollapsed() {
  try {
    const raw = JSON.parse(localStorage.getItem(INTRO_STORAGE_KEY) || '{}')
    return raw && typeof raw === 'object' ? raw : {}
  } catch {
    return {}
  }
}

export function writeIntroCollapsed(map) {
  try {
    localStorage.setItem(INTRO_STORAGE_KEY, JSON.stringify(map))
  } catch {
    /* ignore */
  }
}
