import { hashToken, inviteAllowsAccept } from '../platform/contract.js'
import {
  DEFAULT_INVITE_MS,
  DEFAULT_LINK_USES,
  DEFAULT_PERSONAL_USES,
  classifyInvite,
  isInviteRecipient,
  toInviteRecord,
  validateHandle,
} from './model.js'

function fail(code) {
  const err = new Error(code)
  err.code = code
  throw err
}

function randomHex(bytes = 24) {
  const arr = new Uint8Array(bytes)
  crypto.getRandomValues(arr)
  return [...arr].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function asDate(value) {
  if (value instanceof Date) return value
  const date = new Date(value || Date.now())
  return Number.isNaN(date.getTime()) ? new Date() : date
}

function noticeBody() {
  return 'Vous avez une invitation Nazix. Ouvrez Invitations pour accepter. Aucun e-mail n’est envoyé.'
}

export function createInviteService(deps) {
  const repo = deps.repo
  const now = () => asDate(deps.now ? deps.now() : new Date())
  const users = () => (deps.users ? deps.users() : [])
  const orgs = () => (deps.orgs ? deps.orgs() : [])
  const randomToken = deps.randomToken || (() => randomHex(24))
  const linkFor = deps.link || ((token) => `/?invite=${encodeURIComponent(token)}`)

  function rejectClosed(invite, instant) {
    if (invite.status === 'revoked') fail('invite_revoked')
    if (invite.status === 'declined') fail('invite_declined')
    if (invite.status === 'accepted') fail('invite_accepted')
    if (invite.status !== 'pending') fail('invite_closed')
    const exp = new Date(invite.expiresAt).getTime()
    if (!Number.isFinite(exp) || exp <= instant.getTime()) fail('invite_expired')
    if (Number(invite.uses) >= Number(invite.maxUses)) fail('invite_full')
    fail('invite_closed')
  }

  function audienceOk(invite, user, viaToken) {
    if (!user?.id) return false
    if (invite.email) return String(user.email || '').trim().toLowerCase() === invite.email
    if (invite.handle) return String(user.handle || '').trim().toLowerCase() === invite.handle
    if (invite.invitedUserId) return invite.invitedUserId === user.id
    return viaToken
  }

  async function issue(actor, input, channel) {
    if (!actor?.id) fail('invite_actor')
    const workspaceId = String(input?.workspaceId || '').trim()
    if (!workspaceId) fail('invite_workspace')
    if (deps.canInvite && !deps.canInvite(actor, workspaceId)) fail('invite_forbidden')
    const role = input?.role || 'member'
    if (!['member', 'admin', 'owner', 'guest'].includes(role)) fail('invite_role')
    if (role === 'owner' && deps.canGrantOwner && !deps.canGrantOwner(actor, workspaceId)) fail('invite_role')
    const instant = now()
    const token = randomToken()
    const tokenHash = await hashToken(token)
    let email = null
    let handle = null
    let invitedUserId = null
    let noticed = false
    if (channel === 'email') {
      email = String(input?.email || '').trim().toLowerCase()
      if (!email.includes('@')) fail('invite_email')
      const match = users().find((user) => String(user.email || '').trim().toLowerCase() === email)
      if (match) invitedUserId = match.id
    } else if (channel === 'handle') {
      const check = validateHandle(String(input?.handle || '').trim().toLowerCase().replace(/^@+/, ''))
      if (!check.ok) fail('invite_handle')
      handle = check.handle
      const match = users().find((user) => String(user.handle || '').toLowerCase() === handle)
      if (match) invitedUserId = match.id
    }
    const maxUses = Number.isFinite(Number(input?.maxUses))
      ? Number(input.maxUses)
      : channel === 'link'
        ? DEFAULT_LINK_USES
        : DEFAULT_PERSONAL_USES
    if (maxUses < 1) fail('invite_full')
    const invite = toInviteRecord({
      id: deps.newId ? deps.newId() : `inv_${randomHex(8)}`,
      workspaceId,
      groupId: input?.groupId || null,
      email,
      handle,
      invitedUserId,
      invitedBy: actor.id,
      role,
      tokenHash,
      expiresAt: input?.expiresAt || new Date(instant.getTime() + DEFAULT_INVITE_MS).toISOString(),
      maxUses,
      uses: 0,
      status: 'pending',
      createdAt: instant.toISOString(),
    })
    repo.save(invite)
    if (invitedUserId && deps.notify) {
      await deps.notify(invitedUserId, {
        type: 'workspace_invite',
        title: 'Invitation Nazix',
        body: noticeBody(),
        mailSent: false,
        meta: { inviteId: invite.id, workspaceId, channel },
      })
      noticed = true
    }
    return {
      invite: repo.get(invite.id),
      token,
      link: linkFor(token),
      mailSent: false,
      noticed,
    }
  }

  async function findByToken(token) {
    const hash = await hashToken(token)
    return repo.list().find((row) => row.tokenHash === hash) || null
  }

  return {
    createEmailInvite(actor, input) {
      return issue(actor, input, 'email')
    },
    createHandleInvite(actor, input) {
      return issue(actor, input, 'handle')
    },
    createLinkInvite(actor, input) {
      return issue(actor, input, 'link')
    },
    async previewInvite(token) {
      if (!token) return null
      const invite = await findByToken(token)
      if (!invite) return null
      const instant = now()
      const org = orgs().find((row) => row.id === invite.workspaceId)
      const inviter = users().find((row) => row.id === invite.invitedBy)
      return {
        id: invite.id,
        workspaceId: invite.workspaceId,
        workspaceName: org?.name || invite.workspaceId,
        inviterName: inviter?.fullName || inviter?.displayName || '',
        role: invite.role,
        groupId: invite.groupId,
        status: classifyInvite(invite, instant),
        allowsAccept: inviteAllowsAccept(invite, instant),
        expiresAt: invite.expiresAt,
        channel: invite.email ? 'email' : invite.handle ? 'handle' : 'link',
      }
    },
    async acceptInvite(user, { token, inviteId } = {}) {
      const viaToken = Boolean(token)
      const invite = viaToken ? await findByToken(token) : inviteId ? repo.get(inviteId) : null
      if (!invite) fail('invite_missing')
      const instant = now()
      if (!audienceOk(invite, user, viaToken)) fail('invite_audience')
      if (!viaToken && !isInviteRecipient(invite, user)) fail('invite_audience')
      if (!inviteAllowsAccept(invite, instant)) rejectClosed(invite, instant)
      if (deps.addMembership) await deps.addMembership(invite, user)
      const uses = Number(invite.uses) + 1
      const next = toInviteRecord({
        ...invite,
        uses,
        status: uses >= Number(invite.maxUses) ? 'accepted' : 'pending',
      })
      repo.save(next)
      return repo.get(next.id)
    },
    declineInvite(user, inviteId) {
      const invite = repo.get(inviteId)
      if (!invite) fail('invite_missing')
      if (!isInviteRecipient(invite, user)) fail('invite_audience')
      if (invite.status === 'revoked') fail('invite_revoked')
      if (invite.status !== 'pending' && classifyInvite(invite, now()) !== 'expired') fail('invite_closed')
      const next = toInviteRecord({ ...invite, status: 'declined' })
      repo.save(next)
      return repo.get(next.id)
    },
    revokeInvite(actor, inviteId) {
      const invite = repo.get(inviteId)
      if (!invite) fail('invite_missing')
      const allowed = invite.invitedBy === actor?.id || (deps.canInvite && deps.canInvite(actor, invite.workspaceId))
      if (!allowed) fail('invite_forbidden')
      const next = toInviteRecord({ ...invite, status: 'revoked' })
      repo.save(next)
      return repo.get(next.id)
    },
    async resendInvite(actor, inviteId) {
      const invite = repo.get(inviteId)
      if (!invite) fail('invite_missing')
      if (invite.invitedBy !== actor?.id && !(deps.canInvite && deps.canInvite(actor, invite.workspaceId))) fail('invite_forbidden')
      if (invite.status === 'revoked' || invite.status === 'declined' || invite.status === 'accepted') fail('invite_closed')
      if (deps.dropToken && invite.tokenHash) await deps.dropToken(invite.tokenHash)
      if (Number(invite.uses) >= Number(invite.maxUses)) fail('invite_full')
      const instant = now()
      const token = randomToken()
      const tokenHash = await hashToken(token)
      const next = toInviteRecord({
        ...invite,
        tokenHash,
        status: 'pending',
        expiresAt: new Date(instant.getTime() + DEFAULT_INVITE_MS).toISOString(),
      })
      repo.save(next)
      let noticed = false
      if (next.invitedUserId && deps.notify) {
        await deps.notify(next.invitedUserId, {
          type: 'workspace_invite',
          title: 'Invitation Nazix',
          body: noticeBody(),
          mailSent: false,
          meta: { inviteId: next.id, workspaceId: next.workspaceId, channel: 'resend' },
        })
        noticed = true
      }
      return { invite: repo.get(next.id), token, link: linkFor(token), mailSent: false, noticed }
    },
    listInbox(user, filter) {
      const instant = now()
      return repo
        .list()
        .filter((row) => isInviteRecipient(row, user))
        .filter((row) => !filter || classifyInvite(row, instant) === filter)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    },
    listSent(actor, filter) {
      const instant = now()
      return repo
        .list()
        .filter((row) => row.invitedBy === actor?.id)
        .filter((row) => !filter || classifyInvite(row, instant) === filter)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    },
  }
}
