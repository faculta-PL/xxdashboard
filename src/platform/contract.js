/**
 * Stable exports for identity and billing.
 * Handle, invite and plan rules live in the sibling platform modules.
 */

import { inviteDecision } from './invites.js'

export { LAUNCH_FREE_MODE, featureAllowed as featureEnabled } from './plans.js'
export { validateHandle } from './handles.js'
export { inviteDecision }

export async function hashToken(token) {
  const data = new TextEncoder().encode(String(token ?? ''))
  const digest = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function inviteAllowsAccept(invite, now = new Date()) {
  const instant = now instanceof Date ? now.getTime() : new Date(now).getTime()
  return inviteDecision(invite, instant) === 'pending'
}

export function searchPublicUser(user) {
  if (!user || typeof user !== 'object') return null
  if (user.discoverable === false) return null
  const next = { ...user }
  delete next.email
  delete next.passwordHash
  delete next.verificationCode
  return next
}
