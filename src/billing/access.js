/** Visibility for projects and notes: personal | workspace | group | shared. */

export const MODULE_VISIBILITY = ['personal', 'workspace', 'group', 'shared']

let groupsProvider = () => ({})

export function setGroupsProvider(fn) {
  groupsProvider = typeof fn === 'function' ? fn : () => ({})
}

export function isModuleVisibility(value) {
  return MODULE_VISIBILITY.includes(String(value || '').trim().toLowerCase())
}

export function isItemAuthor(user, entity) {
  if (!user?.id || !entity) return false
  return [entity.ownerId, entity.authorId, entity.createdBy, entity.userId].includes(user.id)
}

export function moduleVisibilityOf(entity) {
  const raw = String(entity?.visibility || '').trim().toLowerCase()
  return MODULE_VISIBILITY.includes(raw) ? raw : ''
}

function groupFrom(source, groupId) {
  if (!source || !groupId) return null
  if (Array.isArray(source)) return source.find((group) => group?.id === groupId) || null
  if (typeof source === 'object') return source[groupId] || null
  return null
}

export function groupOf(groupId, ctx = {}) {
  if (!groupId) return null
  if (ctx && Object.prototype.hasOwnProperty.call(ctx, 'groups')) {
    return groupFrom(ctx.groups, groupId)
  }
  return groupFrom(groupsProvider(), groupId)
}

/**
 * true / false when the modules visibility applies.
 * null keeps the legacy French visibility rules.
 */
export function moduleReadDecision(user, entity, ctx = {}) {
  if (!entity) return false
  const visibility = moduleVisibilityOf(entity)
  if (!visibility) return null
  if (!user?.id) return false
  if (visibility === 'personal') return isItemAuthor(user, entity)
  if (visibility === 'workspace') {
    if (Array.isArray(ctx.workspaceMemberIds)) {
      return ctx.workspaceMemberIds.includes(user.id) || isItemAuthor(user, entity)
    }
    return true
  }
  if (visibility === 'group') {
    if (!entity.groupId) return isItemAuthor(user, entity)
    const members = groupOf(entity.groupId, ctx)?.memberIds || []
    return members.includes(user.id)
  }
  if (visibility === 'shared') {
    if (isItemAuthor(user, entity)) return true
    const shares = entity.shares || entity.sharedWith || []
    return shares.some((share) => (typeof share === 'string' ? share : share?.userId) === user.id)
  }
  return null
}

export function canReadModuleItem(user, entity, ctx) {
  const decision = moduleReadDecision(user, entity, ctx)
  return decision === true
}

export function sharesForVisibility(visibility, shares) {
  const vis = String(visibility || '')
  if (vis === 'Privée' || vis === 'personal' || vis === 'group' || vis === 'workspace') return []
  return Array.isArray(shares) ? shares : []
}

export function stampModuleItem(data, extras = {}) {
  const next = { ...(data || {}) }
  if (next.groupId === '') next.groupId = null
  if (next.projectId === '') next.projectId = null
  const visibility = String(next.visibility || '').trim().toLowerCase()
  if (MODULE_VISIBILITY.includes(visibility)) {
    next.visibility = visibility
    next.shares = sharesForVisibility(visibility, next.shares)
  }
  if (extras.workspaceId) {
    if (!next.workspaceId) next.workspaceId = extras.workspaceId
    if (!next.orgId) next.orgId = extras.workspaceId
  }
  return next
}

/** Drops rows the user cannot read. Legacy rows use ctx.canRead when provided. */
export function filterReadableRows(rows, user, ctx = {}) {
  const legacy = ctx.canRead
  return (rows || []).filter((row) => {
    const decision = moduleReadDecision(user, row, ctx)
    if (decision === false) return false
    if (decision === true) return true
    if (typeof legacy === 'function') return Boolean(legacy(user, row))
    return false
  })
}

export function moduleCounts(snapshot, orgId = '') {
  const rows = (col) => Object.values(snapshot?.[col] || {})
  const inWorkspace = (row) => !orgId || row?.orgId === orgId
  const count = (col) => rows(col).filter(inWorkspace).length
  return {
    workspaces: rows('xx_orgs').length,
    members: rows('xx_org_members').filter(inWorkspace).length,
    projects: count('xx_projects'),
    notes: count('xx_notes'),
    events: count('xx_events'),
    messages: count('xx_messages'),
    groups: count('xx_groups'),
    users: rows('xx_users').length,
    pendingInvites: rows('xx_invitations').filter((row) => row?.status === 'pending').length,
  }
}
