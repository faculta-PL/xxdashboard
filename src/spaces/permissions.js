/**
 * Workspace, guest, and group rules.
 * src/platform/permissions.js is not on this branch, so Nazix enforces them here.
 * Workspace id is the org id. See the HANDOFF in src/spaces/index.js.
 */

import { asWorkspace, GROUP_ROLES, GROUP_TYPES, WORKSPACE_ROLES } from './model.js'

export { GROUP_ROLES, GROUP_TYPES, WORKSPACE_ROLES }

export function groupKind(group) {
  if (!group) return 'private'
  if (GROUP_TYPES.includes(group.type)) return group.type
  if (GROUP_TYPES.includes(group.visibility)) return group.visibility
  if (group.isGeneral) return 'internal'
  return 'private'
}

export function workspaceStatusOf(org) {
  if (org?.status === 'archived' || org?.status === 'suspended') return org.status
  return 'active'
}

export function membershipRecord(db, userId, orgId) {
  if (!db || !userId || !orgId) return null
  const direct = db.xx_org_members?.[`${orgId}_${userId}`]
  if (direct && direct.orgId === orgId && direct.userId === userId) return direct
  return (
    Object.values(db.xx_org_members || {}).find((member) => member?.orgId === orgId && member?.userId === userId) ||
    null
  )
}

export function isJoinedMember(member) {
  return Boolean(member?.userId) && member.status !== 'pending' && member.status !== 'revoked'
}

export function joinedMember(db, userId, orgId) {
  const member = membershipRecord(db, userId, orgId)
  return isJoinedMember(member) ? member : null
}

export function workspaceRole(db, userId, orgId) {
  return joinedMember(db, userId, orgId)?.role || ''
}

export function groupRole(db, groupOrId, userId) {
  const groupId = typeof groupOrId === 'string' ? groupOrId : groupOrId?.id
  if (!db || !groupId || !userId) return ''
  const direct = db.xx_group_members?.[`${groupId}_${userId}`]
  if (direct?.userId === userId && GROUP_ROLES.includes(direct.role)) return direct.role
  const listed = Object.values(db.xx_group_members || {}).filter((member) => member?.groupId === groupId)
  const row = listed.find((member) => member?.userId === userId)
  if (row && GROUP_ROLES.includes(row.role)) return row.role
  if (listed.length) return ''
  const group = typeof groupOrId === 'object' && groupOrId ? groupOrId : db.xx_groups?.[groupId]
  if (Array.isArray(group?.memberIds) && group.memberIds.includes(userId)) return 'member'
  return ''
}

export function explicitlyShared(item, userId) {
  if (!item || !userId) return false
  if (Array.isArray(item.shares) && item.shares.some((share) => (typeof share === 'string' ? share : share?.userId) === userId)) {
    return true
  }
  if (Array.isArray(item.shareUserIds) && item.shareUserIds.includes(userId)) return true
  if (Array.isArray(item.sharedWith) && item.sharedWith.some((share) => (typeof share === 'string' ? share : share?.userId) === userId)) {
    return true
  }
  return false
}

export function guestCanReadItem(user, item) {
  if (!user?.id || !item) return false
  if (item.ownerId === user.id) return true
  return explicitlyShared(item, user.id)
}

export function canSeeGroupContent(db, user, group) {
  if (!user?.id || !group?.id) return false
  const wRole = workspaceRole(db, user.id, group.orgId)
  if (!wRole) return false
  if (group.isGeneral && wRole === 'guest') return false
  const gRole = groupRole(db, group, user.id)
  if (group.status === 'archived') return gRole === 'lead'
  const kind = groupKind(group)
  if (kind === 'private') return Boolean(gRole)
  if (gRole) return true
  if (wRole === 'guest') return false
  return kind === 'internal' || kind === 'project'
}

export function canSeeGroupShell(db, user, group) {
  if (!user?.id || !group?.id) return false
  const wRole = workspaceRole(db, user.id, group.orgId)
  if (!wRole) return false
  const gRole = groupRole(db, group, user.id)
  if (group.status === 'archived') return wRole === 'owner' || gRole === 'lead'
  if (groupKind(group) === 'private') return Boolean(gRole) || wRole === 'owner'
  if (wRole === 'guest') return Boolean(gRole)
  return true
}

export function canPostInGroup(db, user, group) {
  if (!canSeeGroupContent(db, user, group)) return false
  if (group.status === 'archived') return false
  const org = db?.xx_orgs?.[group.orgId]
  if (org && workspaceStatusOf(org) !== 'active') return false
  const gRole = groupRole(db, group, user.id)
  if (gRole === 'observer') return false
  if (group.isGeneral) {
    const wRole = workspaceRole(db, user.id, group.orgId)
    return wRole === 'owner' || wRole === 'admin' || wRole === 'member'
  }
  return gRole === 'lead' || gRole === 'admin' || gRole === 'member'
}

export function canEditGroup(db, user, group) {
  if (!user?.id || !group?.id) return false
  const gRole = groupRole(db, group, user.id)
  return workspaceRole(db, user.id, group.orgId) === 'owner' || gRole === 'lead' || gRole === 'admin'
}

export function canArchiveGroup(db, user, group) {
  if (!user?.id || !group?.id) return false
  const gRole = groupRole(db, group, user.id)
  return workspaceRole(db, user.id, group.orgId) === 'owner' || gRole === 'lead'
}

export function canManageGroupRoster(db, user, group) {
  if (!user?.id || !group?.id) return false
  const wRole = workspaceRole(db, user.id, group.orgId)
  if (!wRole) return false
  if (wRole === 'owner') return true
  const gRole = groupRole(db, group, user.id)
  if (gRole === 'lead' || gRole === 'admin') return true
  if (groupKind(group) === 'private') return false
  return wRole === 'admin'
}

export function canCreateGroup(db, user, orgId) {
  const role = workspaceRole(db, user?.id, orgId)
  return role === 'owner' || role === 'admin' || role === 'member'
}

export function canEditWorkspaceProfile(db, user, orgId) {
  const role = workspaceRole(db, user?.id, orgId)
  return role === 'owner' || role === 'admin'
}

export function canManageWorkspaceMembers(db, user, orgId) {
  const role = workspaceRole(db, user?.id, orgId)
  return role === 'owner' || role === 'admin'
}

export function canArchiveWorkspace(db, user, orgId) {
  return workspaceRole(db, user?.id, orgId) === 'owner'
}

export function canRestoreWorkspace(db, user, orgId) {
  return workspaceRole(db, user?.id, orgId) === 'owner'
}

export function canDeleteWorkspace(db, user, orgId) {
  return workspaceRole(db, user?.id, orgId) === 'owner'
}

export function canAssignWorkspaceRole(actorRole, nextRole, targetRole) {
  if (actorRole !== 'owner' && actorRole !== 'admin') return false
  if (targetRole === 'owner' && actorRole !== 'owner') return false
  if (nextRole === 'owner' && actorRole !== 'owner') return false
  return WORKSPACE_ROLES.includes(nextRole)
}

export function activeOwners(db, orgId) {
  return Object.values(db?.xx_org_members || {}).filter(
    (member) => member?.orgId === orgId && member.role === 'owner' && isJoinedMember(member),
  )
}

export function lastOwnerBlocked(db, orgId, userId, nextRole = '') {
  const target = joinedMember(db, userId, orgId)
  if (!target || target.role !== 'owner') return false
  if (nextRole === 'owner') return false
  return activeOwners(db, orgId).length <= 1
}

export function showInSwitcher(org, member) {
  if (!org || !member || member.status === 'pending' || member.status === 'revoked') return false
  if (!member.userId) return false
  const status = workspaceStatusOf(org)
  if (status === 'active') return true
  return member.role === 'owner'
}

export function enterBlock(db, user, orgId) {
  if (!user?.id) return 'auth'
  if (!orgId) return ''
  const org = db?.xx_orgs?.[orgId]
  if (!org) return 'not_found'
  const member = joinedMember(db, user.id, orgId)
  if (!member) return 'permission'
  const status = workspaceStatusOf(org)
  if ((status === 'archived' || status === 'suspended') && member.role !== 'owner') return 'archived'
  return ''
}

export function canSeeItem(db, user, item) {
  if (!user?.id || !item?.orgId) return false
  const member = joinedMember(db, user.id, item.orgId)
  if (!member) return false
  if (item.groupId) {
    const group = db.xx_groups?.[item.groupId]
    if (!group || group.orgId !== item.orgId) return false
    return canSeeGroupContent(db, user, group)
  }
  if (member.role === 'guest') return guestCanReadItem(user, item)
  return true
}

export function directoryOf(db, orgId) {
  return Object.values(db?.xx_org_members || {})
    .filter((member) => member?.orgId === orgId)
    .sort((a, b) => String(a.email || a.userId || '').localeCompare(String(b.email || b.userId || ''), 'fr'))
}

export function pendingInvites(db, user) {
  if (!user?.id && !user?.email) return []
  const email = String(user?.email || '').trim().toLowerCase()
  return Object.values(db?.xx_org_members || {}).filter((member) => {
    if (member?.status !== 'pending') return false
    if (member.userId && member.userId === user.id) return true
    if (!member.userId && email && String(member.email || '').toLowerCase() === email) return true
    return false
  })
}

export function switcherWorkspaces(db, user) {
  if (!user?.id) return []
  return Object.values(db?.xx_org_members || {})
    .filter((member) => member?.userId === user.id && showInSwitcher(db.xx_orgs?.[member.orgId], member))
    .map((member) => ({
      ...asWorkspace(db.xx_orgs[member.orgId], directoryOf(db, member.orgId)),
      role: member.role,
    }))
    .filter((workspace) => workspace?.id)
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'fr'))
}

export function homeSummary(db, user) {
  return {
    spaces: switcherWorkspaces(db, user),
    invites: pendingInvites(db, user).map((member) => ({
      ...member,
      workspace: asWorkspace(db?.xx_orgs?.[member.orgId]),
    })),
  }
}

export function visibleGroups(db, user, orgId) {
  return Object.values(db?.xx_groups || {})
    .filter((group) => group?.orgId === orgId && canSeeGroupContent(db, user, group))
    .sort(sortGroups)
}

export function manageableGroups(db, user, orgId) {
  return Object.values(db?.xx_groups || {})
    .filter((group) => group?.orgId === orgId && canManageGroupRoster(db, user, group))
    .sort(sortGroups)
}

export function groupMembersOf(db, groupId) {
  return Object.values(db?.xx_group_members || {})
    .filter((member) => member?.groupId === groupId)
    .sort((a, b) => String(a.role || '').localeCompare(String(b.role || '')))
}

export function visibleNotes(db, user, orgId) {
  return Object.values(db?.xx_notes || {})
    .filter((note) => note?.orgId === orgId && !note.groupId && canSeeItem(db, user, note))
    .sort((a, b) => String(a.title || '').localeCompare(String(b.title || ''), 'fr'))
}

export function visibleGroupNotes(db, user, groupId) {
  const group = db?.xx_groups?.[groupId]
  if (!canSeeGroupContent(db, user, group)) return []
  return Object.values(db?.xx_notes || {})
    .filter((note) => note?.groupId === groupId && note?.orgId === group.orgId)
    .sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')))
}

export function visibleGroupMessages(db, user, groupId) {
  const group = db?.xx_groups?.[groupId]
  if (!canSeeGroupContent(db, user, group)) return []
  return Object.values(db?.xx_messages || {})
    .filter((message) => message?.groupId === groupId)
    .sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')))
}

export function removeGroupMembershipOnly(state, groupId, userId) {
  return {
    workspaceMembers: state?.workspaceMembers || [],
    groupMembers: (state?.groupMembers || []).filter(
      (member) => !(member.groupId === groupId && member.userId === userId),
    ),
  }
}

function sortGroups(a, b) {
  if (a.isGeneral && !b.isGeneral) return -1
  if (!a.isGeneral && b.isGeneral) return 1
  return String(a.name || '').localeCompare(String(b.name || ''), 'fr')
}
