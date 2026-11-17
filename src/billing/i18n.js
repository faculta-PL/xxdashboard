/** Small FR/EN copy for billing and the modules layer. */

const dict = {
  fr: {
    'billing.banner': 'Lancement gratuit. La facturation est préparée et inactive : aucun paiement, aucune carte.',
    'billing.title': 'Formules',
    'billing.inactive': 'Inactif',
    'billing.freeMode': 'Mode gratuit',
    'billing.unlimited': 'Illimité',
    'billing.storage': '{n} Mo',
    'plan.free': 'Gratuit',
    'plan.pro': 'Pro',
    'plan.business': 'Business',
    'plan.enterprise': 'Enterprise',
    'limit.members': 'Membres',
    'limit.projects': 'Projets',
    'limit.notes': 'Notes',
    'limit.storageMb': 'Stockage',
    'limit.groups': 'Groupes',
    'limit.workspaces': 'Espaces',
    'vis.personal': 'Personnel',
    'vis.workspace': 'Espace',
    'vis.group': 'Groupe',
    'vis.shared': 'Partagé',
    'vis.personalHint': 'Visible seulement par l’auteur.',
    'vis.workspaceHint': 'Visible par l’espace de travail.',
    'vis.groupHint': 'Visible seulement par les membres du groupe.',
    'vis.sharedHint': 'Visible par les personnes choisies.',
    'modules.visibility': 'Visibilité',
    'modules.group': 'Groupe',
    'modules.groupNone': 'Aucun groupe',
    'modules.workspace': 'Espace de travail',
    'modules.project': 'Projet',
    'modules.projectNone': 'Aucun projet',
    'modules.projectChat': 'Conversation du projet',
    'stats.title': 'Compteurs',
    'stats.hint': 'Nombres seulement. Aucun contenu privé.',
    'stats.workspaces': 'Espaces',
    'stats.members': 'Membres',
    'stats.projects': 'Projets',
    'stats.notes': 'Notes',
    'stats.events': 'Événements',
    'stats.messages': 'Messages',
    'stats.groups': 'Groupes',
    'stats.users': 'Comptes',
    'stats.pending': 'Invitations en attente',
    'notif.inviteTitle': 'Invitation',
    'notif.inviteBody': '{name} vous a ajouté à « {place} ».',
    'notif.mentionTitle': 'Mention',
    'notif.mentionBody': '{name} vous a mentionné dans « {place} ».',
    'notif.messageTitle': 'Nouveau message',
    'notif.messageBody': '{name} a écrit dans « {place} ».',
  },
  en: {
    'billing.banner': 'Launch mode is free. Billing is prepared and inactive: no payment and no card.',
    'billing.title': 'Plans',
    'billing.inactive': 'Inactive',
    'billing.freeMode': 'Free mode',
    'billing.unlimited': 'Unlimited',
    'billing.storage': '{n} MB',
    'plan.free': 'Free',
    'plan.pro': 'Pro',
    'plan.business': 'Business',
    'plan.enterprise': 'Enterprise',
    'limit.members': 'Members',
    'limit.projects': 'Projects',
    'limit.notes': 'Notes',
    'limit.storageMb': 'Storage',
    'limit.groups': 'Groups',
    'limit.workspaces': 'Workspaces',
    'vis.personal': 'Personal',
    'vis.workspace': 'Workspace',
    'vis.group': 'Group',
    'vis.shared': 'Shared',
    'vis.personalHint': 'Visible only to the author.',
    'vis.workspaceHint': 'Visible to the workspace.',
    'vis.groupHint': 'Visible only to group members.',
    'vis.sharedHint': 'Visible to the people you choose.',
    'modules.visibility': 'Visibility',
    'modules.group': 'Group',
    'modules.groupNone': 'No group',
    'modules.workspace': 'Workspace',
    'modules.project': 'Project',
    'modules.projectNone': 'No project',
    'modules.projectChat': 'Project conversation',
    'stats.title': 'Counts',
    'stats.hint': 'Counts only. No private content.',
    'stats.workspaces': 'Workspaces',
    'stats.members': 'Members',
    'stats.projects': 'Projects',
    'stats.notes': 'Notes',
    'stats.events': 'Events',
    'stats.messages': 'Messages',
    'stats.groups': 'Groups',
    'stats.users': 'Accounts',
    'stats.pending': 'Pending invites',
    'notif.inviteTitle': 'Invitation',
    'notif.inviteBody': '{name} added you to “{place}”.',
    'notif.mentionTitle': 'Mention',
    'notif.mentionBody': '{name} mentioned you in “{place}”.',
    'notif.messageTitle': 'New message',
    'notif.messageBody': '{name} wrote in “{place}”.',
  },
}

export function billingLang(storage) {
  try {
    const store = storage || (typeof localStorage !== 'undefined' ? localStorage : null)
    const raw = store ? store.getItem('nazix_lang') || 'fr' : 'fr'
    return String(raw).toLowerCase().startsWith('en') ? 'en' : 'fr'
  } catch {
    return 'fr'
  }
}

export function billingT(lang, key, vars) {
  const locale = String(lang || 'fr').toLowerCase().startsWith('en') ? 'en' : 'fr'
  const raw = dict[locale][key] ?? dict.fr[key] ?? key
  if (!vars) return raw
  return String(raw).replace(/\{(\w+)\}/g, (_, name) => (vars[name] != null ? String(vars[name]) : `{${name}}`))
}

export function billingKeys(lang) {
  const locale = String(lang || 'fr').toLowerCase().startsWith('en') ? 'en' : 'fr'
  return Object.keys(dict[locale])
}
