/** Active organization. The id lives in localStorage under nazix_active_org. */
import { isAdmin } from '../lib/rbac'

export const ACTIVE_ORG_KEY = 'nazix_active_org'

const ADMIN_ROLES = new Set(['admin', 'owner', 'administrateur', 'org_admin'])

function storageGet(key) {
  try {
    if (typeof localStorage === 'undefined') return null
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export function readActiveOrgId() {
  const raw = storageGet(ACTIVE_ORG_KEY)
  if (!raw) return ''
  const trimmed = String(raw).trim()
  if (!trimmed) return ''
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed)
      const id = parsed?.id || parsed?.orgId || parsed?.activeOrgId || ''
      return String(id || '').trim()
    } catch {
      return ''
    }
  }
  return trimmed.slice(0, 120)
}

function roleIsAdmin(role) {
  return ADMIN_ROLES.has(String(role || '').trim().toLowerCase())
}

function readLocalOrgRole(orgId) {
  const direct = storageGet('nazix_org_role')
  if (roleIsAdmin(direct) && (!orgId || readActiveOrgId() === orgId)) return 'admin'
  try {
    const map = JSON.parse(storageGet('nazix_org_roles') || 'null')
    if (map && roleIsAdmin(map[orgId])) return 'admin'
  } catch {
    /* ignore malformed local role map */
  }
  return ''
}

function idMatch(entry, userId) {
  if (entry == null || !userId) return false
  if (typeof entry === 'string') return entry === userId
  return entry.id === userId || entry.userId === userId || entry.uid === userId
}

function orgRecord(db, orgId) {
  if (!db || !orgId) return null
  return db.xx_orgs?.[orgId] || db.orgs?.[orgId] || db.xx_organizations?.[orgId] || null
}

export function isOrgAdmin(user, orgId, db) {
  if (!user) return false
  if (isAdmin(user)) return true
  const oid = String(orgId || '').trim()
  if (!oid) return false
  if (Array.isArray(user.adminOrgIds) && user.adminOrgIds.includes(oid)) return true
  const directRole = user.orgId === oid ? user.orgRole : user.orgRoles?.[oid]
  if (roleIsAdmin(directRole)) return true
  if (readLocalOrgRole(oid) === 'admin') return true

  const org = orgRecord(db, oid)
  if (org) {
    if (org.ownerId === user.id || org.createdBy === user.id) return true
    for (const list of [org.adminIds, org.admins, org.owners]) {
      if (Array.isArray(list) && list.some((entry) => idMatch(entry, user.id))) return true
    }
  }

  const bags = [db?.xx_org_members, db?.xx_memberships, db?.org_members]
  for (const bag of bags) {
    for (const member of Object.values(bag || {})) {
      const mid = member.orgId || member.organizationId
      if (mid !== oid) continue
      const uid = member.userId || member.uid || member.memberId
      if (uid !== user.id) continue
      if (roleIsAdmin(member.role || member.orgRole)) return true
    }
  }
  return false
}

/** No roster yet → every signed-in user counts as a member. */
export function isOrgMember(user, orgId, db) {
  if (!user) return false
  if (isOrgAdmin(user, orgId, db)) return true
  const oid = String(orgId || '').trim()
  if (!oid) return true

  const org = orgRecord(db, oid)
  const roster = org && (org.memberIds || org.members)
  const bags = [db?.xx_org_members, db?.xx_memberships, db?.org_members]
  const listed = bags.flatMap((bag) => Object.values(bag || {})).filter((member) => {
    return (member.orgId || member.organizationId) === oid
  })
  const hasRoster = (Array.isArray(roster) && roster.length > 0) || listed.length > 0
  if (!hasRoster) return true
  if (Array.isArray(roster) && roster.some((entry) => idMatch(entry, user.id))) return true
  return listed.some((member) => (member.userId || member.uid || member.memberId) === user.id)
}
