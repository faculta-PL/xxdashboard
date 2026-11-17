/**
 * Platform contract used by identity.
 * Created because src/platform was absent. Another agent owns this folder.
 * Keep these exports stable if this file is replaced:
 * validateHandle, hashToken, inviteAllowsAccept, searchPublicUser,
 * LAUNCH_FREE_MODE, featureEnabled.
 */

export const LAUNCH_FREE_MODE = true

const HANDLE_RE = /^[a-z0-9_]{3,20}$/
const RESERVED_HANDLES = new Set(['admin', 'nazix', 'support', 'root', 'system', 'help', 'billing'])

export function featureEnabled() {
  return true
}

export function validateHandle(input) {
  const handle = String(input ?? '').trim().toLowerCase()
  if (!HANDLE_RE.test(handle) || RESERVED_HANDLES.has(handle)) {
    return { ok: false, handle, reason: RESERVED_HANDLES.has(handle) ? 'reserved' : 'format' }
  }
  return { ok: true, handle, reason: 'ok' }
}

export async function hashToken(token) {
  const data = new TextEncoder().encode(String(token ?? ''))
  const digest = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function inviteAllowsAccept(invite, now = new Date()) {
  if (!invite || typeof invite !== 'object') return false
  if (invite.status !== 'pending') return false
  if (invite.status === 'revoked') return false
  const instant = now instanceof Date ? now.getTime() : new Date(now).getTime()
  const exp = new Date(invite.expiresAt).getTime()
  if (!Number.isFinite(exp) || exp <= instant) return false
  const uses = Number(invite.uses)
  const maxUses = Number(invite.maxUses)
  if (!Number.isFinite(uses) || !Number.isFinite(maxUses) || uses >= maxUses) return false
  return true
}

export function searchPublicUser(user) {
  if (!user || typeof user !== 'object') return null
  const next = { ...user }
  delete next.email
  delete next.passwordHash
  delete next.verificationCode
  return next
}
