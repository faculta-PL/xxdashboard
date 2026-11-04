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

/** Fichiers / dossiers : Lecture < Modification < Gestion */
export const FILE_PERMS = {
  READ: 'Lecture',
  WRITE: 'Modification',
  MANAGE: 'Gestion',
}

export const FILE_PERM_RANK = {
  Lecture: 1,
  Modification: 2,
  Gestion: 3,
}

export function filePermRank(permission) {
  return FILE_PERM_RANK[permission] || 0
}

export function maxFilePerm(...perms) {
  return perms.reduce((best, perm) => (filePermRank(perm) > filePermRank(best) ? perm : best), null)
}

function ownSharePerm(entity, userId) {
  return entity?.shares?.find((s) => s.userId === userId)?.permission || null
}

function folderChain(folder, foldersById) {
  const chain = []
  let cur = folder
  const seen = new Set()
  while (cur && !seen.has(cur.id)) {
    chain.push(cur)
    seen.add(cur.id)
    cur = cur.parentId ? foldersById?.[cur.parentId] : null
  }
  return chain
}

export function isProjectLeadFor(user, projectId, projectsById) {
  if (!user || user.role !== ROLES.PROJECT_LEAD || !projectId) return false
  const project = projectsById?.[projectId]
  if (!project) return false
  return project.leadId === user.id || canEditEntity(user, project)
}

function leadOrAdminPerm(user, entity, ctx) {
  if (!user || !entity) return null
  if (isAdmin(user)) return FILE_PERMS.MANAGE
  if (entity.ownerId === user.id) return FILE_PERMS.MANAGE
  if (isProjectLeadFor(user, entity.projectId, ctx?.projects)) return FILE_PERMS.MANAGE
  return null
}

export function effectiveFolderPerm(user, folder, ctx = {}) {
  if (!user || !folder) return null
  const lead = leadOrAdminPerm(user, folder, ctx)
  if (lead) return lead
  let best = ownSharePerm(folder, user.id)
  for (const ancestor of folderChain(folder, ctx.folders).slice(1)) {
    if (ancestor.ownerId === user.id) return FILE_PERMS.MANAGE
    best = maxFilePerm(best, ownSharePerm(ancestor, user.id))
    if (isProjectLeadFor(user, ancestor.projectId, ctx.projects)) return FILE_PERMS.MANAGE
  }
  return best
}

export function effectiveFilePerm(user, file, ctx = {}) {
  if (!user || !file) return null
  const lead = leadOrAdminPerm(user, file, ctx)
  if (lead) return lead
  const own = ownSharePerm(file, user.id)
  const folder = file.folderId ? ctx.folders?.[file.folderId] : null
  const inherited = folder ? effectiveFolderPerm(user, folder, ctx) : null
  return maxFilePerm(own, inherited)
}

function isFileDoc(entity) {
  return Boolean(
    entity &&
      (entity.mime != null ||
        entity.ext != null ||
        entity.uploadedBy != null ||
        entity.storagePath != null ||
        entity.localId != null ||
        typeof entity.size === 'number'),
  )
}

function isTeamVisible(entity, ctx) {
  if (!entity) return false
  if (entity.visibility === 'Équipe' || entity.visibility === 'Publique') return true
  const startId = isFileDoc(entity) ? entity.folderId : entity.parentId
  let cur = startId ? ctx.folders?.[startId] : null
  const seen = new Set()
  while (cur && !seen.has(cur.id)) {
    if (cur.visibility === 'Équipe' || cur.visibility === 'Publique') return true
    seen.add(cur.id)
    cur = cur.parentId ? ctx.folders?.[cur.parentId] : null
  }
  return false
}

function effectivePerm(user, entity, ctx = {}) {
  return isFileDoc(entity) ? effectiveFilePerm(user, entity, ctx) : effectiveFolderPerm(user, entity, ctx)
}

export function canReadFileOrFolder(user, entity, ctx = {}) {
  if (!user || !entity) return false
  if (effectivePerm(user, entity, ctx)) return true
  return isTeamVisible(entity, ctx)
}

export function canModifyFileOrFolder(user, entity, ctx = {}) {
  if (!canWriteRole(user) || !entity) return false
  return filePermRank(effectivePerm(user, entity, ctx)) >= filePermRank(FILE_PERMS.WRITE)
}

export function canManageFileOrFolder(user, entity, ctx = {}) {
  if (!user || !entity) return false
  return filePermRank(effectivePerm(user, entity, ctx)) >= filePermRank(FILE_PERMS.MANAGE)
}

export function canDeleteFileOrFolder(user, entity, ctx = {}) {
  if (!user || !entity) return false
  if (isAdmin(user) || entity.ownerId === user.id) return true
  return canManageFileOrFolder(user, entity, ctx)
}

/** folder null = racine : tout rôle écrivant peut y ajouter ses fichiers. */
export function canAddInFolder(user, folder, ctx = {}) {
  if (!canWriteRole(user)) return false
  if (!folder) return true
  const perm = effectiveFolderPerm(user, folder, ctx)
  return filePermRank(perm) >= filePermRank(FILE_PERMS.WRITE)
}

export function fileAccessContext(folders = {}, projects = {}) {
  return { folders, projects }
}
