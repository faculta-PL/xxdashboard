/**
 * Exactly one platform super admin.
 * Organization owner and admin stay organization roles.
 * The legacy app role Administrateur is not a platform super admin.
 */
export const SUPER_ADMIN_EMAIL = 'facultamalika@gmail.com'

export function isPlatformAdminEmail(email) {
  return String(email || '').trim().toLowerCase() === SUPER_ADMIN_EMAIL
}

export function isPlatformAdmin(user) {
  if (!user || typeof user === 'string') return isPlatformAdminEmail(user)
  return isPlatformAdminEmail(user.email)
}

function personOf(byId, userId) {
  const person = byId.get(userId)
  if (!person) return { id: userId, fullName: '', handle: '', email: '' }
  return { id: person.id, fullName: person.fullName, handle: person.handle, email: person.email }
}

/**
 * Read-only site directory for the platform super admin.
 * Account secrets and private message bodies are omitted.
 */
export function buildPlatformDirectory(state, actor) {
  if (!isPlatformAdmin(actor)) return null
  const source = state && typeof state === 'object' ? state : {}
  const users = Object.values(source.xx_users || {})
    .filter((user) => user?.id)
    .map((user) => ({
      id: user.id,
      handle: user.handle || '',
      fullName: user.fullName || user.displayName || '',
      email: user.email || '',
      status: user.status || 'active',
    }))
    .sort((a, b) => String(a.email).localeCompare(String(b.email), 'fr'))
  const byId = new Map(users.map((user) => [user.id, user]))
  const orgs = Object.values(source.xx_orgs || {})
    .filter((org) => org?.id)
    .map((org) => ({
      id: org.id,
      name: org.name || '',
      status: org.status || 'active',
    }))
    .sort((a, b) => String(a.name).localeCompare(String(b.name), 'fr'))
  const orgMembers = Object.values(source.xx_org_members || {})
    .filter((member) => member?.orgId)
    .map((member) => {
      const person = byId.get(member.userId) || {}
      return {
        id: member.id || '',
        orgId: member.orgId,
        userId: member.userId || '',
        email: member.email || person.email || '',
        fullName: person.fullName || '',
        handle: person.handle || '',
        role: member.role || '',
        status: member.status || 'active',
      }
    })
  const roster = Object.values(source.xx_group_members || {})
  const groups = Object.values(source.xx_groups || {})
    .filter((group) => group?.id)
    .map((group) => {
      const ids = new Set(Array.isArray(group.memberIds) ? group.memberIds.filter(Boolean) : [])
      for (const row of roster) {
        if (row?.groupId !== group.id || !row.userId) continue
        if (row.status === 'revoked' || row.status === 'pending') continue
        ids.add(row.userId)
      }
      return {
        id: group.id,
        name: group.name || '',
        orgId: group.organizationId || group.orgId || '',
        members: [...ids].map((id) => personOf(byId, id)),
      }
    })
    .sort((a, b) => String(a.name).localeCompare(String(b.name), 'fr'))
  const invitations = Object.values(source.xx_invitations || {})
    .filter((row) => row?.id)
    .map((row) => ({
      id: row.id,
      email: row.email || '',
      handle: row.handle || '',
      status: row.status || '',
      role: row.role || '',
      workspaceId: row.workspaceId || row.organizationId || '',
    }))
  return { users, orgs, orgMembers, groups, invitations }
}
