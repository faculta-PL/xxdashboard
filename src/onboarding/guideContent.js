/** Textes du guide in-app — FR | EN. Modules réellement présents. */
import { normalizeLang, translate } from '../lib/i18nCore.js'

export const GUIDE_STORAGE_KEY = 'nazix_guide_done'
export const INTRO_STORAGE_KEY = 'nazix_intro_collapsed'

export const FIRST_LOGIN_STEPS = {
  fr: [
    {
      id: 'welcome',
      title: 'Bienvenue dans Nazix',
      body: 'Un seul espace pour vos notes, projets, fichiers et échanges. Cette visite dure moins d’une minute. Vous pourrez la rejouer depuis Guide.',
      target: 'dashboard',
    },
    {
      id: 'work',
      title: 'L’espace de travail',
      body: 'Le menu de gauche groupe les modules : Tableau de bord, Projets, Notes, Kanban, Calendrier, Tâches, Fichiers, Budget et Risques. Chaque onglet s’ouvre en haut de page.',
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
  ],
  en: [
    {
      id: 'welcome',
      title: 'Welcome to Nazix',
      body: 'One place for notes, projects, files and chat. This tour takes less than a minute. You can replay it from Guide.',
      target: 'dashboard',
    },
    {
      id: 'work',
      title: 'The workspace',
      body: 'The left menu groups modules: Dashboard, Projects, Notes, Kanban, Calendar, Tasks, Files, Budget and Risks. Each tab opens at the top of the page.',
      target: 'projects',
    },
    {
      id: 'collab',
      title: 'Team and chat',
      body: 'Invite colleagues, share a note or a project, then talk in Chat (General or private). Nothing is public outside your workspace.',
      target: 'chat',
    },
    {
      id: 'tools',
      title: 'Assistant and exports',
      body: 'The AI assistant talks via OpenAI (server key). Search and Exports (CSV, PDF, DOCX) sit under Tools. A question mark on each module recalls what it is for.',
      target: 'assistant',
    },
    {
      id: 'fun',
      title: 'Guide and a break',
      body: 'Guide (Tools) lists every module with a short demo. KingX and Zianotix wait in Games — off the clock, no work widgets.',
      target: 'guide',
    },
  ],
}

/** Une icône Lucide est déjà dans la nav. Ici : un emoji discret pour l’intro. */
export const MODULE_CHROME = {
  dashboard: { emoji: '🌿' },
  projects: { emoji: '🗂️' },
  notes: { emoji: '📝' },
  ideas: { emoji: '💡' },
  files: { emoji: '📎' },
  budget: { emoji: '💶' },
  risks: { emoji: '⚠️' },
  chat: { emoji: '💬' },
  games: { emoji: '🎮' },
  assistant: { emoji: '✨' },
  calendar: { emoji: '📅' },
  todos: { emoji: '✅' },
  team: { emoji: '👥' },
  notifications: { emoji: '🔔' },
  search: { emoji: '🔎' },
  export: { emoji: '📤' },
  canvas: { emoji: '🗺️' },
  settings: { emoji: '⚙️' },
  guide: { emoji: '📘' },
  feedback: { emoji: '🌱' },
  create: { emoji: '🎨' },
}

export const MODULE_GUIDES = {
  fr: {
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
    todos: {
      title: 'Tâches',
      lead: 'Listes, priorités, échéances et sous-tâches. L’onglet s’appelle Tâches dans le menu.',
      bullets: [
        'Ajout rapide : !haute, #étiquette, demain.',
        'Cochez pour terminer, puis Annuler dans le message.',
        'Le tableau de bord affiche les tâches dues aujourd’hui.',
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
  },
  en: {
    dashboard: {
      title: 'Dashboard',
      lead: 'Overview of what you can already read: projects, ideas to do, dates, notes and remaining budget.',
      bullets: [
        'Widgets show real data only, never fake samples.',
        'Hide, reorder or pin a favourite project — the layout is remembered.',
        'Create shortcuts open the right module, ready to type.',
      ],
    },
    projects: {
      title: 'Projects',
      lead: 'Run a deliverable: title, owner, members, dates, progress and visibility.',
      bullets: [
        'Title is the first field — save from the footer that stays on screen.',
        'Link notes, files, budget and risks to see everything on the project card.',
        'Share as Read or Edit: without a share, content stays with the owner.',
      ],
    },
    notes: {
      title: 'Notes',
      lead: 'Quick captures, categories, tags, sub-notes and links to the rest of Nazix.',
      bullets: [
        'A root note can hold sub-notes (parent note).',
        'View opens the note in read mode (yours and shared ones). Edit and Delete follow your rights.',
        'Visibility Private, Shared or Public, with Read / Edit rights.',
        'Import a file: title + extracted content, or “Note (plain text)” to paste everything.',
      ],
    },
    ideas: {
      title: 'Kanban',
      lead: 'The idea box: five statuses, votes, history, then turn into a note or a project.',
      bullets: [
        'Drag a card from one column to another to change status.',
        'Vote to surface an idea in a meeting.',
        '“To note” or “To project” reuses the title and description.',
      ],
    },
    files: {
      title: 'Files',
      lead: 'Folders, import (20 MB), PDF and image preview, share with a member or the whole team.',
      bullets: [
        'Allowed types: pdf, docx, xlsx, csv, txt, images — no executables or HTML.',
        'Folder rights apply to its contents.',
        'In local mode, files stay on this device (IndexedDB).',
      ],
    },
    budget: {
      title: 'Budget',
      lead: 'One budget per project, with planned, actual and salaries — totals compute themselves.',
      bullets: [
        'Salaries use a job title, never a person’s name.',
        'Remaining = planned total minus paid; variance compares planned and actual.',
        'Comment a line to keep a decision trail.',
      ],
    },
    risks: {
      title: 'Risks',
      lead: 'Name a risk, compute its priority, then follow actions until it is resolved.',
      bullets: [
        'High priority only if probability and impact are both high.',
        'An overdue action notifies the assignee and the owner.',
        'Filter by project, person, priority or status.',
      ],
    },
    chat: {
      title: 'Chat',
      lead: 'The General group welcomes everyone; create private groups for a smaller circle.',
      bullets: [
        'Group messages are readable only by its members.',
        'A counter on the menu flags unread messages.',
        'Invite from the group card, not by external email.',
      ],
    },
    games: {
      title: 'Games',
      lead: 'An arcade break: KingX Cueillette, Zianotix Vol and Relais Duo, no work widgets.',
      bullets: [
        'Pick a unique nickname (not KingX or Zianotix).',
        'Scores add up; they are not overwritten.',
        '“Back to work” returns to the dashboard.',
      ],
    },
    assistant: {
      title: 'AI assistant',
      lead: 'OpenAI conversation on data you can see. No API key in the browser.',
      bullets: [
        'Replies via OpenAI. Only send context from content you may read.',
        'Each action (create a note, a risk…) needs confirmation.',
        'The floating button does not block a form: the modal comes in front.',
      ],
    },
    todos: {
      title: 'Tasks',
      lead: 'Lists, priorities, due dates and subtasks. The tab is called Tasks in the menu.',
      bullets: [
        'Quick add: !high, #tag, tomorrow.',
        'Check to complete, then Undo in the message.',
        'The dashboard shows tasks due today.',
      ],
    },
    calendar: {
      title: 'Calendar',
      lead: 'Month (or week) grid: appointments show on their date.',
      bullets: [
        'Click a day to list events and create one.',
        'Shared events appear for guests.',
        'Link an appointment to a project from the project card.',
      ],
    },
    team: {
      title: 'Team',
      lead: 'Directory of accounts: name, email, role and presence over 24 h.',
      bullets: [
        'Roles (Admin, Lead, Member, Reader) limit creation.',
        'A Reader sees what is shared with them, without creating.',
        'Presence is based on active sessions.',
      ],
    },
    notifications: {
      title: 'Notifications',
      lead: 'Shares, invites, verification codes and overdue actions.',
      bullets: [
        'A quiet sound flags a new unread item; mute it in Settings.',
        'The 6-digit email code also lands here if Firebase is silent.',
        'Mark as read, or mark all at once.',
      ],
    },
    search: {
      title: 'Search',
      lead: 'Filter notes, ideas, projects, files, budgets and risks in your scope.',
      bullets: [
        'Search respects read rights.',
        'Sub-notes and linked files appear in results.',
        'Optional web search goes through the server, never browser CORS.',
      ],
    },
    export: {
      title: 'Exports',
      lead: 'Take a CSV, XLSX, DOCX, JSON or PDF extract of what you see.',
      bullets: [
        'CSV files carry a UTF-8 BOM for Excel.',
        'Only authorised content is exported.',
        'Useful for an offline meeting or an archive.',
      ],
    },
    canvas: {
      title: 'Visual space',
      lead: 'A map to place notes, projects and links, without replacing the modules.',
      bullets: [
        'Drag cards; lines reuse existing links.',
        'Layout is personal (per account).',
        'Open a module from a card to really edit the item.',
      ],
    },
    feedback: {
      title: 'Feedback',
      lead: 'Suggest an improvement or a new feature. Admin is notified; a Reader can send.',
      bullets: [
        'Title, message, optional module.',
        '“Help me phrase this” clarifies the text via AI, then you confirm.',
        'Only an administrator can delete a report.',
      ],
    },
    create: {
      title: 'Create',
      lead: 'Generate an image (server) or a PDF flyer (no API). No key in the browser.',
      bullets: [
        'Image generation is async, with a progress bar.',
        'The Reader role cannot generate.',
        'You can save the image to Files.',
      ],
    },
    settings: {
      title: 'Settings',
      lead: 'Profile, email verification, sessions, Firebase diagnostics and export kit.',
      bullets: [
        'Paste the 6-digit code if the Firebase link does not arrive.',
        'Revoke a lost session or another device.',
        'Local mode is shown while VITE_FIREBASE_* keys are missing.',
      ],
    },
    guide: {
      title: 'Guide',
      lead: 'In-app how-to: each module in a few sentences, plus 10-second demos.',
      bullets: [
        'Replay the first-login tour whenever you want.',
        'Clips are Nazix animations, not promotional films.',
        'Nothing here writes into your projects.',
      ],
    },
  },
}

export const GUIDE_INDEX = [
  'dashboard',
  'projects',
  'notes',
  'ideas',
  'todos',
  'files',
  'budget',
  'risks',
  'canvas',
  'chat',
  'games',
  'assistant',
  'create',
  'feedback',
]

export function getFirstLoginSteps(lang) {
  const locale = normalizeLang(lang)
  return FIRST_LOGIN_STEPS[locale] || FIRST_LOGIN_STEPS.fr
}

export function getModuleChrome(lang, view) {
  const row = MODULE_CHROME[view]
  if (!row) return null
  const subtitle = translate(lang, `chrome.${view}`)
  return { emoji: row.emoji, subtitle: subtitle === `chrome.${view}` ? '' : subtitle }
}

export function getModuleGuide(lang, view) {
  const locale = normalizeLang(lang)
  const data = MODULE_GUIDES[locale]?.[view] || MODULE_GUIDES.fr[view]
  if (!data) return null
  const navTitle = translate(lang, `nav.${view}`)
  return {
    title: navTitle && navTitle !== `nav.${view}` ? navTitle : data.title,
    lead: data.lead,
    bullets: data.bullets,
  }
}

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
