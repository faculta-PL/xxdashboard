/** Invite tokens are stored as SHA-256 only. The raw token never sits on the record. */

const ROLES = ['owner', 'admin', 'member', 'guest']

export function defaultInviteExpiry(now, days = 7) {
  return new Date(now + days * 24 * 60 * 60 * 1000).toISOString()
}

export function createInviteState({
  id,
  workspaceId,
  groupId = null,
  email = null,
  handle = null,
  invitedUserId = null,
  invitedBy,
  role = 'member',
  tokenHash,
  expiresAt,
  maxUses = 1,
  now,
}) {
  const safeRole = ROLES.includes(role) ? role : 'member'
  return {
    id,
    workspaceId,
    orgId: workspaceId,
    groupId: groupId || null,
    email: email ? String(email).trim().toLowerCase() : null,
    handle: handle ? String(handle).trim().toLowerCase().replace(/^@+/, '') : null,
    invitedUserId: invitedUserId || null,
    invitedBy,
    role: safeRole,
    tokenHash,
    expiresAt,
    maxUses: Math.max(1, Number(maxUses) || 1),
    uses: 0,
    status: 'pending',
    createdAt: new Date(now).toISOString(),
  }
}

export function inviteDecision(invite, now) {
  if (!invite) return 'missing'
  if (invite.status === 'revoked') return 'revoked'
  if (invite.status === 'declined') return 'declined'
  const expiry = new Date(invite.expiresAt).getTime()
  if (!Number.isNaN(expiry) && expiry <= now) return 'expired'
  if (invite.status === 'expired') return 'expired'
  if (Number(invite.uses || 0) >= Number(invite.maxUses || 1)) return 'exhausted'
  if (invite.status === 'accepted') return 'accepted'
  return 'pending'
}

export function acceptInvite(invite, { now, userId }) {
  const reason = inviteDecision(invite, now)
  if (reason !== 'pending') return { ok: false, reason, invite }
  const uses = Number(invite.uses || 0) + 1
  const maxUses = Number(invite.maxUses || 1)
  const next = {
    ...invite,
    uses,
    invitedUserId: invite.invitedUserId || userId || invite.invitedUserId,
    status: uses >= maxUses ? 'accepted' : 'pending',
    acceptedAt: new Date(now).toISOString(),
  }
  return { ok: true, reason: 'accepted', invite: next }
}

export function declineInvite(invite, now) {
  if (!invite) return { ok: false, reason: 'missing', invite }
  const reason = inviteDecision(invite, now)
  if (reason !== 'pending') return { ok: false, reason, invite }
  return {
    ok: true,
    reason: 'declined',
    invite: { ...invite, status: 'declined', declinedAt: new Date(now).toISOString() },
  }
}

export function revokeInvite(invite, now) {
  if (!invite) return { ok: false, reason: 'missing', invite }
  if (invite.status === 'revoked') return { ok: false, reason: 'revoked', invite }
  const reason = inviteDecision(invite, now)
  if (reason === 'exhausted' || reason === 'expired') return { ok: false, reason, invite }
  return {
    ok: true,
    reason: 'revoked',
    invite: { ...invite, status: 'revoked', revokedAt: new Date(now).toISOString() },
  }
}

export function stampExpired(invite, now) {
  if (!invite) return invite
  if (inviteDecision(invite, now) === 'expired' && invite.status === 'pending') {
    return { ...invite, status: 'expired' }
  }
  return invite
}
