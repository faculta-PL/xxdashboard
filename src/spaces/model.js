/** Workspace shape helpers. The workspace id is the org id. No second tenant. */

export const WORKSPACE_STATUSES = ['active', 'archived', 'suspended']
export const WORKSPACE_ROLES = ['owner', 'admin', 'member', 'guest']
export const GROUP_TYPES = ['private', 'internal', 'project']
export const GROUP_ROLES = ['lead', 'admin', 'member', 'observer']

const MESSAGES = {
  auth: 'Session requise.',
  name: 'Nom trop court.',
  permission: 'Permission refusée.',
  last_owner: 'Transférez la propriété avant de retirer le dernier propriétaire.',
  not_found: 'Introuvable.',
  confirm_name: 'Saisissez le nom exact pour supprimer.',
  archived: 'Cet espace est archivé.',
  observer: 'Un observateur ne peut pas publier.',
  exists: 'Déjà membre de cet espace.',
  emoji: 'Utilisez un emoji, ou laissez vide pour les initiales.',
  empty: 'Message vide.',
  member: 'Cette personne n’est pas membre de l’espace.',
}

export function spacesError(code, message) {
  const err = new Error(message || MESSAGES[code] || 'Permission refusée.')
  err.code = code
  return err
}

export function slugify(value) {
  const base = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
  return base || 'espace'
}

export function uniqueSlug(workspaces, base, selfId = '') {
  const used = new Set(
    (Array.isArray(workspaces) ? workspaces : Object.values(workspaces || {}))
      .filter((row) => row && row.id !== selfId)
      .map((row) => String(row.slug || '').toLowerCase())
      .filter(Boolean),
  )
  const root = slugify(base)
  if (!used.has(root)) return root
  let n = 2
  while (used.has(`${root}-${n}`)) n += 1
  return `${root}-${n}`
}

export function workspaceInitials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return 'NX'
  const raw = parts.length === 1 ? parts[0].slice(0, 2) : `${parts[0][0] || ''}${parts[1][0] || ''}`
  return raw.toLocaleUpperCase('fr') || 'NX'
}

export function normalizeEmoji(value) {
  const raw = String(value ?? '').trim()
  if (!raw) return ''
  if (/^https?:|^s3:|^data:|\/\//i.test(raw) || raw.includes('/') || raw.includes('\\')) {
    throw spacesError('emoji')
  }
  if (Array.from(raw).length > 4) throw spacesError('emoji')
  return raw
}

export function workspaceStatus(org) {
  if (org?.status === 'archived' || org?.status === 'suspended') return org.status
  return 'active'
}

export function asWorkspace(org, members = []) {
  if (!org?.id) return null
  const owner = (members || []).find(
    (member) => member?.role === 'owner' && member.status !== 'pending' && member.status !== 'revoked',
  )
  return {
    id: org.id,
    name: String(org.name || 'Espace'),
    slug: org.slug || slugify(org.name || org.id),
    description: String(org.description || ''),
    ownerId: org.ownerId || owner?.userId || org.createdBy || '',
    status: workspaceStatus(org),
    createdAt: org.createdAt || '',
    emoji: String(org.emoji || ''),
    createdBy: org.createdBy || org.ownerId || '',
  }
}

export function orgMemberId(orgId, userId) {
  return `${orgId}_${userId}`
}

export function groupMemberId(groupId, userId) {
  return `${groupId}_${userId}`
}

export function pendingMemberId(orgId, email) {
  const slug = String(email || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
  return `${orgId}_invite_${slug || 'email'}`
}

export function normalizeWorkspaceRole(role) {
  return WORKSPACE_ROLES.includes(role) ? role : 'member'
}

export function normalizeGroupRole(role) {
  return GROUP_ROLES.includes(role) ? role : 'member'
}

export function normalizeGroupType(type) {
  return GROUP_TYPES.includes(type) ? type : 'private'
}
