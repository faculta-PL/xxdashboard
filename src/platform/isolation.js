/** Active workspace only. Personal notes use a per-user scope, never another workspace. */

import { canSeeGroupContent, groupRoleOf, guestCanReadItem } from './permissions.js'

export function personalScopeId(userId) {
  return userId ? `personal_${userId}` : ''
}

export function filterByWorkspace(rows, workspaceId) {
  if (!workspaceId) return []
  return (rows || []).filter((row) => row && row.orgId === workspaceId)
}

export function docsBelongingToWorkspace(rows, workspaceId) {
  if (!workspaceId) return []
  return (rows || []).filter((row) => row && (row.orgId === workspaceId || row.workspaceId === workspaceId))
}

export function workspaceSlug(name, id) {
  const base = String(name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
  const suffix = String(id || '')
    .replace(/[^a-z0-9]/gi, '')
    .slice(-4)
    .toLowerCase()
  return base ? `${base}-${suffix || 'ws'}` : suffix || 'workspace'
}

export function visibleItems(items, user, ctx) {
  const workspaceId = ctx?.workspaceId || ''
  const groups = ctx?.groups || []
  const groupMembers = ctx?.groupMembers || []
  const workspaceRole = ctx?.workspaceRole || ''
  return (items || []).filter((item) => {
    if (!item) return false
    if (item.orgId && workspaceId && item.orgId !== workspaceId) return false
    if (item.groupId) {
      const group = groups.find((entry) => entry.id === item.groupId)
      if (!group) return false
      const groupRole = groupRoleOf(user?.id, group, groupMembers)
      return canSeeGroupContent(user, group, { workspaceRole, groupRole })
    }
    if (workspaceRole === 'guest') return guestCanReadItem(user, item)
    return true
  })
}

export function visibleMessages(messages, user, group, access) {
  if (!canSeeGroupContent(user, group, access)) return []
  return (messages || []).filter((message) => message.groupId === group.id)
}
