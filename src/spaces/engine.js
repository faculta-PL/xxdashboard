/** Mutations for workspaces and groups. Persistence is injected so tests stay local. */

import {
  asWorkspace,
  groupMemberId,
  normalizeEmoji,
  normalizeGroupRole,
  normalizeGroupType,
  normalizeWorkspaceRole,
  orgMemberId,
  pendingMemberId,
  slugify,
  spacesError,
  uniqueSlug,
  workspaceStatus,
} from './model.js'
import {
  activeOwners,
  canArchiveWorkspace,
  canAssignWorkspaceRole,
  canCreateGroup,
  canDeleteWorkspace,
  canEditWorkspaceProfile,
  canManageGroupRoster,
  canManageWorkspaceMembers,
  canPostInGroup,
  canRestoreWorkspace,
  directoryOf,
  enterBlock,
  groupMembersOf,
  groupRole,
  homeSummary,
  joinedMember,
  lastOwnerBlocked,
  manageableGroups,
  membershipRecord,
  switcherWorkspaces,
  visibleGroupMessages,
  visibleGroupNotes,
  visibleGroups,
  visibleNotes,
  workspaceRole,
} from './permissions.js'

const SCOPED = [
  'xx_org_members',
  'xx_groups',
  'xx_group_members',
  'xx_notes',
  'xx_messages',
  'xx_ideas',
  'xx_projects',
  'xx_events',
  'xx_todos',
  'xx_todo_lists',
  'xx_files',
  'xx_folders',
  'xx_notifications',
  'xx_budgets',
  'xx_budget_lines',
  'xx_risks',
  'xx_risk_actions',
  'xx_links',
]

function rows(db, col) {
  return Object.values(db?.[col] || {})
}

function findUser(db, { userId, email }) {
  if (userId && db.xx_users?.[userId]) return db.xx_users[userId]
  const wanted = String(email || '').trim().toLowerCase()
  if (!wanted) return null
  return rows(db, 'xx_users').find((user) => String(user.email || '').trim().toLowerCase() === wanted) || null
}

function emailOf(user, fallback = '') {
  return String(user?.email || fallback || '').trim().toLowerCase()
}

export function createSpacesEngine(io) {
  const db = () => io.getDb()

  async function put(col, id, value) {
    await io.persist(col, id, value)
    return db()[col]?.[id] || value
  }

  async function del(col, id) {
    await io.remove(col, id)
  }

  async function selectWorkspace(user, orgId) {
    if (!orgId) {
      await io.setActive('')
      return ''
    }
    const code = enterBlock(db(), user, orgId)
    if (code) throw spacesError(code)
    await io.setActive(orgId)
    return orgId
  }

  async function createWorkspace(user, input = {}) {
    if (!user?.id) throw spacesError('auth')
    const source = typeof input === 'string' ? { name: input } : input || {}
    const name = String(source.name || '').trim()
    if (name.length < 2) throw spacesError('name')
    const id = io.newId('org')
    const now = io.now()
    const emoji = normalizeEmoji(source.emoji || '')
    const workspace = {
      id,
      name,
      slug: uniqueSlug(rows(db(), 'xx_orgs'), slugify(source.slug || name), id),
      description: String(source.description || '').trim().slice(0, 500),
      ownerId: user.id,
      status: 'active',
      createdAt: now,
      createdBy: user.id,
      emoji,
    }
    await put('xx_orgs', id, workspace)
    const memberId = orgMemberId(id, user.id)
    await put('xx_org_members', memberId, {
      id: memberId,
      orgId: id,
      userId: user.id,
      email: emailOf(user),
      role: 'owner',
      status: 'active',
      joinedAt: now,
    })
    await io.setActive(id)
    return db().xx_orgs[id]
  }

  async function updateWorkspace(actor, orgId, patch = {}) {
    const org = db().xx_orgs?.[orgId]
    if (!org) throw spacesError('not_found')
    const role = workspaceRole(db(), actor?.id, orgId)
    if (!canEditWorkspaceProfile(db(), actor, orgId)) throw spacesError('permission')
    const next = { ...org, id: orgId }
    if (patch.name != null) {
      const name = String(patch.name || '').trim()
      if (name.length < 2) throw spacesError('name')
      next.name = name
    }
    if (patch.description != null) next.description = String(patch.description || '').trim().slice(0, 500)
    if (patch.emoji != null) next.emoji = normalizeEmoji(patch.emoji)
    if (patch.slug != null) next.slug = uniqueSlug(rows(db(), 'xx_orgs'), slugify(patch.slug), orgId)
    if (patch.status != null) {
      if (role !== 'owner') throw spacesError('permission')
      if (!['active', 'archived', 'suspended'].includes(patch.status)) throw spacesError('permission')
      next.status = patch.status
    }
    await put('xx_orgs', orgId, next)
    return db().xx_orgs[orgId]
  }

  async function archiveWorkspace(actor, orgId) {
    if (!canArchiveWorkspace(db(), actor, orgId)) throw spacesError('permission')
    return updateWorkspace(actor, orgId, { status: 'archived' })
  }

  async function restoreWorkspace(actor, orgId) {
    if (!canRestoreWorkspace(db(), actor, orgId)) throw spacesError('permission')
    return updateWorkspace(actor, orgId, { status: 'active' })
  }

  async function suspendWorkspace(actor, orgId) {
    if (workspaceRole(db(), actor?.id, orgId) !== 'owner') throw spacesError('permission')
    return updateWorkspace(actor, orgId, { status: 'suspended' })
  }

  async function deleteWorkspace(actor, orgId, typedName) {
    const org = db().xx_orgs?.[orgId]
    if (!org) throw spacesError('not_found')
    if (!canDeleteWorkspace(db(), actor, orgId)) throw spacesError('permission')
    if (String(typedName || '').trim() !== String(org.name || '')) throw spacesError('confirm_name')
    const groupIds = new Set(rows(db(), 'xx_groups').filter((group) => group.orgId === orgId).map((group) => group.id))
    for (const col of SCOPED) {
      for (const row of rows(db(), col)) {
        const inWorkspace = row?.orgId === orgId || (col === 'xx_group_members' && groupIds.has(row?.groupId))
        if (inWorkspace && row?.id) await del(col, row.id)
      }
    }
    await del('xx_orgs', orgId)
    if (typeof io.getActive === 'function' && io.getActive() === orgId) await io.setActive('')
    return true
  }

  function inviteTarget(orgId, userId, email) {
    return (
      rows(db(), 'xx_org_members').find((member) => member.orgId === orgId && userId && member.userId === userId) ||
      rows(db(), 'xx_org_members').find(
        (member) => member.orgId === orgId && email && String(member.email || '').toLowerCase() === email,
      ) ||
      null
    )
  }

  async function inviteMember(actor, input = {}) {
    const orgId = input.orgId || io.getActive()
    if (!db().xx_orgs?.[orgId]) throw spacesError('not_found')
    if (!canManageWorkspaceMembers(db(), actor, orgId)) throw spacesError('permission')
    const nextRole = normalizeWorkspaceRole(input.role || 'member')
    const actorRole = workspaceRole(db(), actor.id, orgId)
    if (!canAssignWorkspaceRole(actorRole, nextRole, '')) throw spacesError('permission')
    const target = findUser(db(), input)
    const email = emailOf(target, input.email)
    if (!email && !target?.id) throw spacesError('not_found')
    const existing = inviteTarget(orgId, target?.id, email)
    if (existing && existing.status !== 'pending') throw spacesError('exists')
    const now = io.now()
    const id = existing?.id || (target?.id ? orgMemberId(orgId, target.id) : pendingMemberId(orgId, email))
    const member = {
      id,
      orgId,
      userId: target?.id || existing?.userId || '',
      email: email || existing?.email || '',
      role: nextRole,
      status: 'pending',
      invitedBy: actor.id,
      joinedAt: existing?.joinedAt || '',
      createdAt: existing?.createdAt || now,
    }
    await put('xx_org_members', id, member)
    return db().xx_org_members[id]
  }

  async function claimInvites(user) {
    if (!user?.id || !user?.email) return []
    const email = emailOf(user)
    const claimed = []
    for (const member of rows(db(), 'xx_org_members')) {
      if (member.userId) continue
      if (String(member.email || '').toLowerCase() !== email) continue
      const next = { ...member, userId: user.id, email }
      await put('xx_org_members', member.id, next)
      claimed.push(next)
    }
    return claimed
  }

  function pendingFor(user, orgId) {
    const email = emailOf(user)
    return (
      rows(db(), 'xx_org_members').find((member) => {
        if (member.orgId !== orgId || member.status !== 'pending') return false
        if (member.userId && member.userId === user.id) return true
        return !member.userId && email && String(member.email || '').toLowerCase() === email
      }) || null
    )
  }

  async function acceptInvite(user, orgId) {
    if (!user?.id) throw spacesError('auth')
    const member = pendingFor(user, orgId)
    if (!member) {
      const joined = joinedMember(db(), user.id, orgId)
      if (joined) return joined
      throw spacesError('not_found')
    }
    const next = {
      ...member,
      userId: user.id,
      email: emailOf(user, member.email),
      status: 'active',
      joinedAt: member.joinedAt || io.now(),
    }
    await put('xx_org_members', member.id, next)
    return db().xx_org_members[member.id]
  }

  async function declineInvite(user, orgId) {
    if (!user?.id) throw spacesError('auth')
    const member = pendingFor(user, orgId)
    if (!member) throw spacesError('not_found')
    await del('xx_org_members', member.id)
    return true
  }

  async function updateMemberRole(actor, orgId, userId, role) {
    if (!canManageWorkspaceMembers(db(), actor, orgId)) throw spacesError('permission')
    const target = membershipRecord(db(), userId, orgId)
    if (!target) throw spacesError('not_found')
    const nextRole = normalizeWorkspaceRole(role)
    const actorRole = workspaceRole(db(), actor.id, orgId)
    if (!canAssignWorkspaceRole(actorRole, nextRole, target.role)) throw spacesError('permission')
    if (lastOwnerBlocked(db(), orgId, userId, nextRole)) throw spacesError('last_owner')
    const next = { ...target, role: nextRole }
    await put('xx_org_members', target.id, next)
    if (nextRole === 'owner' && target.status !== 'pending') {
      const org = db().xx_orgs?.[orgId]
      if (org && activeOwners(db(), orgId).length === 1) await put('xx_orgs', orgId, { ...org, ownerId: userId })
    }
    return db().xx_org_members[target.id]
  }

  async function removeMember(actor, orgId, userId) {
    if (!canManageWorkspaceMembers(db(), actor, orgId)) throw spacesError('permission')
    const target = membershipRecord(db(), userId, orgId)
    if (!target) return false
    const actorRole = workspaceRole(db(), actor.id, orgId)
    if (target.role === 'owner' && actorRole !== 'owner') throw spacesError('permission')
    if (lastOwnerBlocked(db(), orgId, userId, '')) throw spacesError('last_owner')
    await del('xx_org_members', target.id)
    return true
  }

  async function transferOwnership(actor, orgId, userId) {
    if (workspaceRole(db(), actor?.id, orgId) !== 'owner') throw spacesError('permission')
    const target = joinedMember(db(), userId, orgId)
    if (!target || target.role === 'guest') throw spacesError('permission')
    if (target.userId === actor.id) return db().xx_orgs[orgId]
    await put('xx_org_members', target.id, { ...target, role: 'owner' })
    const org = db().xx_orgs[orgId]
    await put('xx_orgs', orgId, { ...org, ownerId: userId })
    const actorMember = membershipRecord(db(), actor.id, orgId)
    if (actorMember && actorMember.userId !== userId) {
      await put('xx_org_members', actorMember.id, { ...actorMember, role: 'admin' })
    }
    return db().xx_orgs[orgId]
  }

  async function syncGroupMemberIds(groupId) {
    const group = db().xx_groups?.[groupId]
    if (!group) return null
    const memberIds = groupMembersOf(db(), groupId).map((member) => member.userId).filter(Boolean)
    const next = { ...group, memberIds: [...new Set(memberIds)], updatedAt: io.now() }
    await put('xx_groups', groupId, next)
    return next
  }

  async function createGroup(actor, input = {}) {
    const orgId = input.orgId || io.getActive()
    if (!db().xx_orgs?.[orgId]) throw spacesError('not_found')
    if (workspaceStatus(db().xx_orgs[orgId]) !== 'active') throw spacesError('archived')
    if (!canCreateGroup(db(), actor, orgId)) throw spacesError('permission')
    const name = String(input.name || '').trim()
    if (!name) throw spacesError('name')
    const id = io.newId('grp')
    const now = io.now()
    const type = normalizeGroupType(input.type || 'private')
    const group = {
      id,
      orgId,
      name,
      description: String(input.description || '').trim().slice(0, 500),
      type,
      status: 'active',
      projectId: type === 'project' ? String(input.projectId || '') : '',
      ownerId: actor.id,
      leadUserId: actor.id,
      memberIds: [actor.id],
      sealed: type === 'private' && input.sealed === true,
      createdAt: now,
      updatedAt: now,
    }
    await put('xx_groups', id, group)
    const memberId = groupMemberId(id, actor.id)
    await put('xx_group_members', memberId, {
      id: memberId,
      groupId: id,
      orgId,
      userId: actor.id,
      role: 'lead',
      joinedAt: now,
    })
    return db().xx_groups[id]
  }

  async function updateGroup(actor, groupId, patch = {}) {
    const group = db().xx_groups?.[groupId]
    if (!group) throw spacesError('not_found')
    const gRole = groupRole(db(), group, actor?.id)
    const isOwner = workspaceRole(db(), actor?.id, group.orgId) === 'owner'
    if (!isOwner && gRole !== 'lead' && gRole !== 'admin') throw spacesError('permission')
    const next = { ...group }
    if (patch.name != null) {
      const name = String(patch.name || '').trim()
      if (!name) throw spacesError('name')
      next.name = name
    }
    if (patch.description != null) next.description = String(patch.description || '').trim().slice(0, 500)
    if (patch.type != null && (isOwner || gRole === 'lead')) next.type = normalizeGroupType(patch.type)
    if (patch.projectId != null) next.projectId = String(patch.projectId || '')
    if (patch.status != null) {
      if (!isOwner && gRole !== 'lead') throw spacesError('permission')
      if (patch.status !== 'active' && patch.status !== 'archived') throw spacesError('permission')
      next.status = patch.status
    }
    next.updatedAt = io.now()
    await put('xx_groups', groupId, next)
    return db().xx_groups[groupId]
  }

  async function archiveGroup(actor, groupId) {
    return updateGroup(actor, groupId, { status: 'archived' })
  }

  async function restoreGroup(actor, groupId) {
    return updateGroup(actor, groupId, { status: 'active' })
  }

  async function addGroupMember(actor, groupId, userId, role = 'member') {
    const group = db().xx_groups?.[groupId]
    if (!group) throw spacesError('not_found')
    if (!canManageGroupRoster(db(), actor, group)) throw spacesError('permission')
    if (!joinedMember(db(), userId, group.orgId)) throw spacesError('member')
    const nextRole = normalizeGroupRole(role)
    const id = groupMemberId(groupId, userId)
    const existing = db().xx_group_members?.[id] || groupMembersOf(db(), groupId).find((member) => member.userId === userId)
    const memberId = existing?.id || id
    await put('xx_group_members', memberId, {
      id: memberId,
      groupId,
      orgId: group.orgId,
      userId,
      role: nextRole,
      joinedAt: existing?.joinedAt || io.now(),
    })
    await syncGroupMemberIds(groupId)
    return db().xx_group_members[memberId]
  }

  async function updateGroupMemberRole(actor, groupId, userId, role) {
    return addGroupMember(actor, groupId, userId, role)
  }

  async function removeGroupMember(actor, groupId, userId) {
    const group = db().xx_groups?.[groupId]
    if (!group) throw spacesError('not_found')
    if (!canManageGroupRoster(db(), actor, group)) throw spacesError('permission')
    const existing =
      db().xx_group_members?.[groupMemberId(groupId, userId)] ||
      groupMembersOf(db(), groupId).find((member) => member.userId === userId)
    if (!existing) return false
    const workspaceBefore = membershipRecord(db(), userId, group.orgId)
    await del('xx_group_members', existing.id)
    await syncGroupMemberIds(groupId)
    const workspaceAfter = membershipRecord(db(), userId, group.orgId)
    if (Boolean(workspaceBefore) !== Boolean(workspaceAfter)) {
      throw spacesError('permission', 'Le retrait du groupe ne doit pas changer l’espace.')
    }
    return true
  }

  async function postMessage(user, groupId, body) {
    const group = db().xx_groups?.[groupId]
    if (!group) throw spacesError('not_found')
    if (groupRole(db(), group, user?.id) === 'observer') throw spacesError('observer')
    if (!canPostInGroup(db(), user, group)) throw spacesError('permission')
    const text = String(body || '').trim()
    if (!text) throw spacesError('empty')
    if (text.length > 4000) throw spacesError('name', 'Message trop long.')
    const id = io.newId('msg')
    const message = {
      id,
      orgId: group.orgId,
      groupId,
      authorId: user.id,
      authorName: user.fullName || '',
      body: text,
      createdAt: io.now(),
      memberIds: group.memberIds || [],
    }
    await put('xx_messages', id, message)
    return message
  }

  async function postGroupNote(user, groupId, input = {}) {
    const group = db().xx_groups?.[groupId]
    if (!group) throw spacesError('not_found')
    if (groupRole(db(), group, user?.id) === 'observer') throw spacesError('observer')
    if (!canPostInGroup(db(), user, group)) throw spacesError('permission')
    const title = String(input.title || '').trim()
    const content = String(input.body || input.content || '').trim()
    if (!title || !content) throw spacesError('name')
    const id = io.newId('note')
    const now = io.now()
    const note = {
      id,
      orgId: group.orgId,
      groupId,
      ownerId: user.id,
      authorId: user.id,
      title,
      content,
      body: content,
      visibility: 'Privée',
      shares: [],
      createdAt: now,
      updatedAt: now,
    }
    await put('xx_notes', id, note)
    return note
  }

  return {
    createWorkspace,
    updateWorkspace,
    archiveWorkspace,
    restoreWorkspace,
    suspendWorkspace,
    deleteWorkspace,
    selectWorkspace,
    inviteMember,
    claimInvites,
    acceptInvite,
    declineInvite,
    updateMemberRole,
    removeMember,
    transferOwnership,
    createGroup,
    updateGroup,
    archiveGroup,
    restoreGroup,
    addGroupMember,
    updateGroupMemberRole,
    removeGroupMember,
    postMessage,
    postGroupNote,
    home(user) {
      return homeSummary(db(), user)
    },
    switcher(user) {
      return switcherWorkspaces(db(), user)
    },
    directory(orgId) {
      return directoryOf(db(), orgId)
    },
    visibleGroups(user, orgId) {
      return visibleGroups(db(), user, orgId)
    },
    manageableGroups(user, orgId) {
      return manageableGroups(db(), user, orgId)
    },
    visibleNotes(user, orgId) {
      return visibleNotes(db(), user, orgId)
    },
    groupNotes(user, groupId) {
      return visibleGroupNotes(db(), user, groupId)
    },
    groupMessages(user, groupId) {
      return visibleGroupMessages(db(), user, groupId)
    },
    workspace(orgId) {
      return asWorkspace(db().xx_orgs?.[orgId], directoryOf(db(), orgId))
    },
  }
}
