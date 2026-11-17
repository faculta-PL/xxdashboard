/**
 * Pure workspace and group permissions for Nazix.
 *
 * Workspace roles: owner | admin | member | guest.
 * Group roles: lead | admin | member | observer.
 * A group admin is not a workspace admin.
 * A guest reads only items explicitly shared with them.
 * A member cannot invite and cannot change roles.
 * An observer cannot post.
 * Private groups are visible only to their members, including a workspace admin who was not added.
 */

export const ACTIONS = Object.freeze(['read', 'create', 'update', 'delete', 'share', 'invite', 'admin'])

export const WORKSPACE_ROLES = Object.freeze(['owner', 'admin', 'member', 'guest'])

export const GROUP_ROLES = Object.freeze(['lead', 'admin', 'member', 'observer'])

const CONTENT_TYPES = new Set(['note', 'idea', 'project', 'event', 'file'])

const WORKSPACE_SURFACE = new Set(['workspace', 'workspace_member', 'invitation', 'project_member'])

/**
 * @param {string | null | undefined} role
 */
function isWorkspaceManager(role) {
  return role === 'owner' || role === 'admin'
}

/**
 * @param {{ memberships?: { workspaceId: string, role: string }[] } | null | undefined} actor
 * @param {string} workspaceId
 * @returns {string | null}
 */
export function workspaceRole(actor, workspaceId) {
  if (!actor || !workspaceId) return null
  const row = (actor.memberships || []).find((membership) => membership.workspaceId === workspaceId)
  return row?.role || null
}

/**
 * @param {{ groupMemberships?: { groupId: string, workspaceId?: string, role: string }[] } | null | undefined} actor
 * @param {string} groupId
 * @param {string} [workspaceId]
 * @returns {string | null}
 */
export function groupRole(actor, groupId, workspaceId) {
  if (!actor || !groupId) return null
  const row = (actor.groupMemberships || []).find((membership) => {
    if (membership.groupId !== groupId) return false
    if (workspaceId && membership.workspaceId && membership.workspaceId !== workspaceId) return false
    return true
  })
  return row?.role || null
}

/**
 * @param {{ id?: string } | null | undefined} actor
 * @param {{ shares?: { userId?: string, permission?: string }[] } | null | undefined} resource
 */
function shareFor(actor, resource) {
  if (!actor?.id) return null
  return (resource?.shares || []).find((share) => share.userId === actor.id) || null
}

/**
 * @param {string | undefined} permission
 */
function canEditShare(permission) {
  return permission === 'edit' || permission === 'Édition'
}

/**
 * @param {{ id?: string } | null | undefined} actor
 * @param {{ ownerId?: string, authorId?: string, createdById?: string } | null | undefined} resource
 */
function owns(actor, resource) {
  if (!actor?.id || !resource) return false
  return resource.ownerId === actor.id || resource.authorId === actor.id || resource.createdById === actor.id
}

/**
 * @param {string | undefined} visibility
 */
function visibleToMembers(visibility) {
  return (
    visibility === 'workspace' ||
    visibility === 'public' ||
    visibility === 'team' ||
    visibility === 'Équipe' ||
    visibility === 'Publique'
  )
}

/**
 * @param {{ memberships?: { workspaceId: string }[] } | null | undefined} actor
 * @returns {string[]}
 */
export function actorWorkspaceIds(actor) {
  return [...new Set((actor?.memberships || []).map((membership) => membership.workspaceId).filter(Boolean))]
}

/**
 * Workspace isolation: the row's workspace must be one the actor belongs to.
 * @param {{ memberships?: { workspaceId: string }[] } | null | undefined} actor
 * @param {{ workspaceId?: string } | null | undefined} row
 */
export function passesWorkspaceIsolation(actor, row) {
  if (!row?.workspaceId) return false
  return actorWorkspaceIds(actor).includes(row.workspaceId)
}

/**
 * @template T
 * @param {{ memberships?: { workspaceId: string }[] } | null | undefined} actor
 * @param {T[] | null | undefined} rows
 * @returns {T[]}
 */
export function filterByWorkspace(actor, rows) {
  return (rows || []).filter((row) => passesWorkspaceIsolation(actor, row))
}

/**
 * Private groups are visible only to group members in the same workspace.
 * A workspace-visible group is visible to owner, admin, and member.
 * A guest sees it only when it is explicitly shared or they were added to it.
 * @param {{ id?: string, memberships?: { workspaceId: string, role: string }[], groupMemberships?: { groupId: string, workspaceId?: string, role: string }[] } | null | undefined} actor
 * @param {{ id?: string, workspaceId?: string, visibility?: string, shares?: { userId?: string }[] } | null | undefined} group
 */
export function isGroupVisible(actor, group) {
  if (!group?.id || !passesWorkspaceIsolation(actor, group)) return false
  const role = workspaceRole(actor, group.workspaceId)
  const membership = groupRole(actor, group.id, group.workspaceId)
  if ((group.visibility || 'private') === 'private') return Boolean(membership)
  if (membership) return true
  if (role === 'guest') return Boolean(shareFor(actor, group))
  return role === 'owner' || role === 'admin' || role === 'member'
}

/**
 * @template T
 * @param {Parameters<typeof isGroupVisible>[0]} actor
 * @param {T[] | null | undefined} groups
 * @returns {T[]}
 */
export function filterVisibleGroups(actor, groups) {
  return (groups || []).filter((group) => isGroupVisible(actor, group))
}

/**
 * @param {string | null} role
 * @param {string} action
 * @param {{ type?: string, targetRole?: string }} resource
 */
function canWorkspaceSurface(role, action, resource) {
  if (role === 'guest' || role === 'member') {
    if (action === 'invite' || action === 'admin') return false
    if (action !== 'read') return false
    return role === 'member'
  }
  if (!isWorkspaceManager(role)) return false
  if (resource.type === 'workspace' && action === 'delete') return role === 'owner'
  if (
    resource.type === 'workspace_member' &&
    resource.targetRole === 'owner' &&
    (action === 'admin' || action === 'update' || action === 'create')
  ) {
    return role === 'owner'
  }
  return true
}

/**
 * @param {string | null} role
 * @param {string} action
 * @param {{ type?: string, ownerId?: string, authorId?: string, createdById?: string, visibility?: string, shares?: { userId?: string, permission?: string }[] }} resource
 * @param {{ id?: string }} actor
 */
function canContent(actor, role, action, resource) {
  if (role === 'guest') {
    if (action !== 'read') return false
    return Boolean(shareFor(actor, resource))
  }
  if (action === 'invite' || action === 'admin') return isWorkspaceManager(role)
  if (isWorkspaceManager(role)) return true
  if (role !== 'member') return false
  if (action === 'create') return true
  if (action === 'read') {
    if (owns(actor, resource)) return true
    if (shareFor(actor, resource)) return true
    return visibleToMembers(resource.visibility)
  }
  if (action === 'share') return owns(actor, resource)
  if (action === 'update') {
    if (owns(actor, resource)) return true
    return canEditShare(shareFor(actor, resource)?.permission)
  }
  if (action === 'delete') return owns(actor, resource)
  return false
}

/**
 * @param {{ id?: string, groupMemberships?: { groupId: string, workspaceId?: string, role: string }[] }} actor
 * @param {string | null} role
 * @param {string} action
 * @param {{ type?: string, id?: string, groupId?: string, workspaceId?: string, visibility?: string, shares?: { userId?: string }[] }} resource
 */
function canGroup(actor, role, action, resource) {
  if (action === 'create' && resource.type === 'group') {
    return role === 'owner' || role === 'admin' || role === 'member'
  }

  const groupId = resource.type === 'group' ? resource.id || resource.groupId : resource.groupId
  const gRole = groupRole(actor, groupId || '', resource.workspaceId)
  const isPrivate = (resource.visibility || 'private') === 'private'
  const manages = gRole === 'lead' || gRole === 'admin'

  if (isPrivate && !gRole) return false
  if (!isPrivate && !gRole && role === 'guest') {
    return action === 'read' && Boolean(shareFor(actor, resource))
  }

  if (action === 'read') {
    if (gRole) return true
    return !isPrivate && (role === 'owner' || role === 'admin' || role === 'member')
  }
  if (action === 'invite' || action === 'admin' || action === 'update' || action === 'share' || action === 'create') {
    return manages
  }
  if (action === 'delete' && resource.type === 'group') return gRole === 'lead' || role === 'owner'
  if (action === 'delete') return manages
  return false
}

/**
 * @param {{ id?: string, conversationMemberships?: { conversationId: string }[], groupMemberships?: { groupId: string, workspaceId?: string, role: string }[] }} actor
 * @param {string | null} role
 * @param {string} action
 * @param {{ type?: string, id?: string, groupId?: string, workspaceId?: string, conversationId?: string, visibility?: string, groupVisibility?: string, authorId?: string, shares?: { userId?: string }[] }} resource
 */
function canConversation(actor, role, action, resource) {
  if (resource.groupId) {
    const gRole = groupRole(actor, resource.groupId, resource.workspaceId)
    const visibility = resource.groupVisibility || resource.visibility || 'private'
    const isPrivate = visibility === 'private'
    if (isPrivate && !gRole) return false
    if (!gRole && role === 'guest') return action === 'read' && Boolean(shareFor(actor, resource)) && !isPrivate
    if (action === 'read') {
      if (gRole) return true
      return !isPrivate && (role === 'owner' || role === 'admin' || role === 'member')
    }
    if (action === 'create') return Boolean(gRole) && gRole !== 'observer'
    if (action === 'update' || action === 'delete') {
      if (gRole === 'lead' || gRole === 'admin') return true
      return resource.authorId === actor.id && Boolean(gRole) && gRole !== 'observer'
    }
    if (action === 'invite' || action === 'admin' || action === 'share') {
      return gRole === 'lead' || gRole === 'admin'
    }
    return false
  }

  const conversationId = resource.conversationId || (resource.type === 'conversation' ? resource.id : '')
  const inConversation = (actor.conversationMemberships || []).some(
    (membership) => membership.conversationId === conversationId,
  )
  if (!inConversation) return false
  if (action === 'read') return true
  if (action === 'create') return resource.type === 'message'
  if (action === 'update' || action === 'delete') return resource.authorId === actor.id
  return false
}

/**
 * @param {{ id?: string, memberships?: { workspaceId: string, role: string }[], groupMemberships?: { groupId: string, workspaceId?: string, role: string }[], conversationMemberships?: { conversationId: string }[] } | null | undefined} actor
 * @param {string} action
 * @param {{ type?: string, workspaceId?: string, id?: string, groupId?: string, visibility?: string, ownerId?: string, authorId?: string, createdById?: string, shares?: { userId?: string, permission?: string }[], targetRole?: string, conversationId?: string, groupVisibility?: string } | null | undefined} resource
 * @returns {boolean}
 */
export function can(actor, action, resource) {
  if (!actor?.id || !resource?.workspaceId) return false
  if (!ACTIONS.includes(action)) return false
  const role = workspaceRole(actor, resource.workspaceId)
  if (!role || !WORKSPACE_ROLES.includes(role)) return false

  if (resource.type === 'group' || resource.type === 'group_member') {
    return canGroup(actor, role, action, resource)
  }
  if (resource.type === 'message' || resource.type === 'conversation') {
    return canConversation(actor, role, action, resource)
  }
  if (WORKSPACE_SURFACE.has(resource.type || '')) {
    return canWorkspaceSurface(role, action, resource)
  }
  if (CONTENT_TYPES.has(resource.type || '')) {
    return canContent(actor, role, action, resource)
  }
  return false
}
