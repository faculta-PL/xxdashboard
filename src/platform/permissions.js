/** Workspace, group, guest and conversation checks. Group admin is not a workspace admin. */

export const WORKSPACE_ROLES = ['owner', 'admin', 'member', 'guest']
export const GROUP_ROLES = ['lead', 'admin', 'member', 'observer']

const ADMIN_ACTIONS = ['invite', 'changeRole', 'deleteWorkspace', 'manageAdmins', 'archiveWorkspace', 'suspend']

export function isWorkspaceManager(role) {
  return role === 'owner' || role === 'admin'
}

export function hasWorkspaceAdminPowers(access) {
  const role = access?.workspaceRole
  return role === 'owner' || role === 'admin'
}

export function canPerformAdminOperation(workspaceRole, action) {
  if (!WORKSPACE_ROLES.includes(workspaceRole)) return false
  if (!ADMIN_ACTIONS.includes(action)) return false
  if (action === 'suspend') return false
  if (action === 'deleteWorkspace' || action === 'manageAdmins') return workspaceRole === 'owner'
  if (action === 'archiveWorkspace') return workspaceRole === 'owner'
  return isWorkspaceManager(workspaceRole)
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
  const groupRole = access?.groupRole || null
  if (group.status === 'archived' && groupRole !== 'lead' && role !== 'owner') return false
  if (group.isGeneral) return Boolean(role) && role !== 'guest'
  if (!group.visibility) return Boolean(groupRole) || role === 'owner' || role === 'admin'
  if (group.visibility === 'private') {
    if (groupRole) return true
    return role === 'owner' || role === 'admin'
  }
  if (role === 'guest') return Boolean(groupRole)
  return Boolean(role)
}

export function canSeeGroupContent(user, group, access) {
  if (!user || !group) return false
  const role = access?.workspaceRole || ''
  const groupRole = access?.groupRole || null
  if (group.status === 'archived' && groupRole !== 'lead' && role !== 'owner') return false
  if (group.isGeneral) return Boolean(role) && role !== 'guest'
  if (groupRole) return true
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

export function removeGroupMembershipOnly(state, groupId, userId) {
  const groupMembers = (state.groupMembers || []).filter(
    (member) => !(member.groupId === groupId && member.userId === userId),
  )
  return {
    workspaceMembers: state.workspaceMembers || [],
    groupMembers,
  }
}
