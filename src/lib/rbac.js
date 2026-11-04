export const ROLES = {
  ADMIN: 'Administrateur',
  PROJECT_LEAD: 'Responsable de projet',
  MEMBER: 'Membre',
  READER: 'Lecteur',
}

export const ROLE_RANK = {
  [ROLES.ADMIN]: 4,
  [ROLES.PROJECT_LEAD]: 3,
  [ROLES.MEMBER]: 2,
  [ROLES.READER]: 1,
}

export function isAdmin(user) {
  return user?.role === ROLES.ADMIN
}

export function canWriteRole(user) {
  return isAdmin(user) || user?.role === ROLES.PROJECT_LEAD || user?.role === ROLES.MEMBER
}

/** Entity visibility / share checks */
export function canReadEntity(user, entity) {
  if (!user || !entity) return false
  if (isAdmin(user)) return true
  if (entity.ownerId === user.id) return true
  if (entity.visibility === 'Publique') return true
  if (entity.visibility === 'Privée') {
    return Boolean(entity.shares?.some((s) => s.userId === user.id))
  }
  // Partagée
  return Boolean(entity.shares?.some((s) => s.userId === user.id))
}

export function canEditEntity(user, entity) {
  if (!user || !entity) return false
  if (isAdmin(user)) return true
  if (entity.ownerId === user.id) return true
  if (!canWriteRole(user)) return false
  const share = entity.shares?.find((s) => s.userId === user.id)
  return share?.permission === 'Édition'
}

export function canDeleteEntity(user, entity) {
  if (!user || !entity) return false
  if (isAdmin(user)) return true
  return entity.ownerId === user.id
}

/** Chat / groups: only members (admins included) read a group's messages. */
export function canReadGroup(user, group) {
  if (!user || !group) return false
  if (isAdmin(user)) return true
  if (group.isGeneral) return true
  return Array.isArray(group.memberIds) && group.memberIds.includes(user.id)
}

/** Chat / groups: only members write messages in that group. */
export function canWriteGroup(user, group) {
  if (!user || !group) return false
  if (isAdmin(user)) return true
  return Array.isArray(group.memberIds) && group.memberIds.includes(user.id)
}
