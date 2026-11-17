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
export function isWorkspaceManager(role) {
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

/**
 * Firestore-shaped checks used by isolation and the modules tests.
 * The pure `can()` API above stays the contract. These names match the
 * workspace memory (org id, memberIds, sealed private groups).
 */

const ADMIN_ACTIONS = ['invite', 'changeRole', 'deleteWorkspace', 'manageAdmins', 'archiveWorkspace', 'suspend']

export function hasWorkspaceAdminPowers(access) {
  const role = access?.workspaceRole
  return role === 'owner' || role === 'admin'
}

export function canPerformAdminOperation(workspaceRoleName, action) {
  if (!WORKSPACE_ROLES.includes(workspaceRoleName)) return false
  if (!ADMIN_ACTIONS.includes(action)) return false
  if (action === 'suspend') return false
  if (action === 'deleteWorkspace' || action === 'manageAdmins') return workspaceRoleName === 'owner'
  if (action === 'archiveWorkspace') return workspaceRoleName === 'owner'
  return isWorkspaceManager(workspaceRoleName)
}

export function groupRoleOf(userId, group, groupMembers) {
  if (!userId || !group) return null
  const row = (groupMembers || []).find((member) => member.groupId === group.id && member.userId === userId)
  if (row?.role && GROUP_ROLES.includes(row.role)) return row.role
  if (group.leadUserId === userId || group.ownerId === userId) return 'lead'
  if (Array.isArray(group.memberIds) && group.memberIds.includes(userId)) return 'member'
  if (group.isGeneral) return null
  return null
}

export function canSeeGroup(user, group, access) {
  if (!user || !group) return false
  const role = access?.workspaceRole || ''
  const membership = access?.groupRole || null
  if (group.status === 'archived' && membership !== 'lead' && role !== 'owner') return false
  if (group.isGeneral) return Boolean(role) && role !== 'guest'
  if (!group.visibility) return Boolean(membership) || role === 'owner' || role === 'admin'
  if (group.visibility === 'private') {
    if (membership) return true
    return role === 'owner' || role === 'admin'
  }
  if (role === 'guest') return Boolean(membership)
  return Boolean(role)
}

export function canSeeGroupContent(user, group, access) {
  if (!user || !group) return false
  const role = access?.workspaceRole || ''
  const membership = access?.groupRole || null
  if (group.status === 'archived' && membership !== 'lead' && role !== 'owner') return false
  if (group.isGeneral) return Boolean(role) && role !== 'guest'
  if (membership) return true
  if (group.visibility === 'private') {
    if (group.sealed) return false
    return role === 'owner'
  }
  if (!group.visibility) return role === 'owner' || role === 'admin'
  return false
}

export function canPostInGroup(user, group, access) {
  if (!canSeeGroupContent(user, group, access)) return false
  if (access?.groupRole === 'observer') return false
  if (group.isGeneral) return access?.workspaceRole && access.workspaceRole !== 'guest'
  if (access?.groupRole) return true
  return access?.workspaceRole === 'owner' && group.visibility === 'private' && !group.sealed
}

export function canManageGroupMembers(user, group, access) {
  if (!user || !group) return false
  if (access?.groupRole === 'lead' || access?.groupRole === 'admin') return true
  if (group.sealed) return false
  return access?.workspaceRole === 'owner' || access?.workspaceRole === 'admin'
}

export function canReadConversation(userId, conversation) {
  if (!userId || !conversation) return false
  const members = conversation.memberIds || conversation.participantIds || []
  return members.includes(userId)
}

export function guestCanReadItem(user, item) {
  if (!user || !item) return false
  if (item.ownerId === user.id) return true
  if ((item.shares || []).some((share) => share.userId === user.id)) return true
  if ((item.shareUserIds || []).includes(user.id)) return true
  return false
}

/** Stable id of the single automatic general space for an organization. */
export function generalSpaceId(orgId) {
  return orgId ? `spc_${orgId}_general` : ''
}

/**
 * A team is private unless it is the general channel or an internal/project room.
 * Private team content is hidden from anyone who is not a member.
 */
export function teamIsPrivate(team) {
  if (!team || team.isGeneral) return false
  if (team.kind === 'project' || team.type === 'project' || team.type === 'internal') return false
  if (team.visibility === 'organization' || team.visibility === 'org' || team.visibility === 'internal') return false
  return true
}

export function isTeamMember(userId, team, groupMembers) {
  if (!userId || !team) return false
  if (team.leadUserId === userId || team.ownerId === userId) return true
  if (Array.isArray(team.memberIds) && team.memberIds.includes(userId)) return true
  return (groupMembers || []).some(
    (member) =>
      member?.groupId === team.id &&
      member?.userId === userId &&
      member.status !== 'revoked' &&
      member.status !== 'pending',
  )
}

/** True when this private team's content must stay hidden from the actor. */
export function privateTeamContentHidden(user, team, groupMembers) {
  if (!teamIsPrivate(team)) return false
  return !isTeamMember(user?.id, team, groupMembers)
}

/** Org A never includes a row that belongs to org B. Personal rows have no org. */
export function passesOrganizationIsolation(orgIds, row) {
  const orgId = row?.organizationId || row?.orgId || ''
  if (!orgId) return true
  return (orgIds || []).includes(orgId)
}

export function guestExplicitShare(user, row) {
  if (!user?.id || !row) return false
  if (row.ownerId === user.id || row.authorId === user.id || row.createdBy === user.id) return true
  if (Array.isArray(row.shareUserIds) && row.shareUserIds.includes(user.id)) return true
  if (Array.isArray(row.shares) && row.shares.some((share) => share?.userId === user.id || share === user.id)) return true
  return false
}

/**
 * Extra spaces follow their visibility. The general space is open to the organization.
 * Guests are rejected here; they only pass through an explicit share.
 */
export function canAccessSpace(user, space, groups, orgRole) {
  if (!user?.id || !space) return false
  if (!orgRole || orgRole === 'guest') return false
  if (space.kind === 'general') return true
  const visibility = space.visibility || 'organization'
  if (visibility === 'organization' || visibility === 'org') return true
  if (space.leadUserId === user.id) return true
  if (Array.isArray(space.memberIds) && space.memberIds.includes(user.id)) return true
  const teamIds = Array.isArray(space.teamIds) ? space.teamIds : []
  if (teamIds.some((id) => groups?.[id] && isTeamMember(user.id, groups[id]))) return true
  if ((orgRole === 'owner' || orgRole === 'admin') && visibility !== 'private') return true
  return false
}

/**
 * Store and UI read path. Organization isolation, space visibility, guests, and private teams.
 */
export function canReadScopedContent(user, row, groups, orgRole, spaces, groupMembers) {
  if (!user?.id || !row) return false
  const orgId = row.organizationId || row.orgId || ''
  if (!orgId) {
    return row.ownerId === user.id || row.userId === user.id || row.authorId === user.id || row.createdBy === user.id
  }
  if (!orgRole) return false
  if (orgRole === 'guest') return guestExplicitShare(user, row)
  if (row.spaceId && spaces?.[row.spaceId] && !canAccessSpace(user, spaces[row.spaceId], groups, orgRole)) return false
  const teamId = row.teamId || row.groupId
  if (teamId) {
    const team = groups?.[teamId]
    if (!team) return false
    const teamOrg = team.organizationId || team.orgId || ''
    if (teamOrg && teamOrg !== orgId) return false
    if (privateTeamContentHidden(user, team, groupMembers)) return false
  }
  return true
}

/** Legacy rows without spaceId stay on the general space only. */
export function rowInActiveSpace(row, activeSpaceId, orgId) {
  if (!activeSpaceId) return true
  if (!row?.spaceId) return activeSpaceId === generalSpaceId(orgId)
  return row.spaceId === activeSpaceId
}

export function removeGroupMembershipOnly(state, groupId, userId) {
  const groupMembers = (state.groupMembers || []).filter(
    (member) => !(member.groupId === groupId && member.userId === userId),
  )
  return {
    workspaceMembers: state.workspaceMembers || [],
    groupMembers,
  }
}
