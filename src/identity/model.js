import { searchPublicUser, validateHandle } from '../platform/contract.js'

export { validateHandle }

export const INVITE_COLLECTION = 'xx_invitations'
export const INVITE_FIELDS = [
  'id',
  'workspaceId',
  'groupId',
  'email',
  'handle',
  'invitedUserId',
  'invitedBy',
  'role',
  'tokenHash',
  'expiresAt',
  'maxUses',
  'uses',
  'status',
  'createdAt',
  'organizationId',
  'spaceId',
  'teamId',
]
export const INVITE_FILTERS = ['pending', 'accepted', 'declined', 'expired', 'revoked']
export const INVITE_ROLES = ['member', 'admin', 'owner', 'guest']
export const DEFAULT_INVITE_MS = 7 * 24 * 60 * 60 * 1000
export const DEFAULT_LINK_USES = 10
export const DEFAULT_PERSONAL_USES = 1
export const PENDING_INVITE_KEY = 'nazix_pending_invite'

export function normalizeHandleInput(input) {
  return String(input ?? '').trim().toLowerCase().replace(/^@+/, '')
}

export function handleAvailability(input, users, excludeUserId) {
  const check = validateHandle(normalizeHandleInput(input))
  if (!check.ok) return { ok: false, free: false, handle: check.handle, reason: check.reason }
  const taken = (users || []).some(
    (user) => user && user.id !== excludeUserId && String(user.handle || '').toLowerCase() === check.handle,
  )
  return { ok: !taken, free: !taken, handle: check.handle, reason: taken ? 'taken' : 'ok' }
}

export function validateSignupForm(form, { users = [], minPassword = 4, excludeUserId } = {}) {
  const errors = {}
  const name = String(form?.fullName || form?.displayName || '').trim()
  if (!name) errors.fullName = 'name'
  const email = String(form?.email || '').trim().toLowerCase()
  if (!email || !email.includes('@')) errors.email = 'email'
  const avail = handleAvailability(form?.handle, users, excludeUserId)
  if (!avail.ok) errors.handle = avail.reason
  const password = String(form?.password || '')
  if (password.length < minPassword) errors.password = 'password'
  if (password !== String(form?.confirm ?? '')) errors.confirm = 'confirm'
  if (!form?.terms) errors.terms = 'terms'
  return { ok: Object.keys(errors).length === 0, errors, handle: avail.ok ? avail.handle : '' }
}

function websiteOk(value) {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

export function validateProfileForm(form, users, userId) {
  const errors = {}
  const fullName = String(form?.fullName || form?.displayName || '').trim()
  if (!fullName) errors.fullName = 'name'
  const avail = handleAvailability(form?.handle, users, userId)
  if (!avail.ok) errors.handle = avail.reason
  const bio = String(form?.bio || '')
  if (bio.trim().length > 280) errors.bio = 'bio'
  const title = String(form?.title || '').trim()
  if (title.length > 80) errors.title = 'title'
  const website = String(form?.website || '').trim()
  if (website && !websiteOk(website)) errors.website = 'website'
  return {
    ok: Object.keys(errors).length === 0,
    errors,
    patch: {
      fullName,
      handle: avail.ok ? avail.handle : String(form?.handle || '').trim().toLowerCase(),
      bio: bio.trim(),
      title,
      website,
      discoverable: form?.discoverable === true,
    },
  }
}

export function searchPublicByHandle(users, query) {
  const check = validateHandle(normalizeHandleInput(query))
  if (!check.ok) return null
  const user = (users || []).find((row) => String(row?.handle || '').toLowerCase() === check.handle)
  if (!user || user.discoverable === false) return null
  const stripped = searchPublicUser(user)
  if (!stripped) return null
  const profile = {
    displayName: String(stripped.fullName || stripped.displayName || '').trim(),
    handle: check.handle,
  }
  if (user.discoverable === true) profile.bio = String(stripped.bio || '')
  delete profile.email
  return profile
}

export function toInviteRecord(input) {
  const row = {
    id: String(input?.id || ''),
    workspaceId: String(input?.workspaceId || ''),
    groupId: input?.groupId ? String(input.groupId) : null,
    email: input?.email ? String(input.email).trim().toLowerCase() : null,
    handle: input?.handle ? String(input.handle).trim().toLowerCase() : null,
    invitedUserId: input?.invitedUserId ? String(input.invitedUserId) : null,
    invitedBy: String(input?.invitedBy || ''),
    role: INVITE_ROLES.includes(input?.role) ? input.role : 'member',
    tokenHash: String(input?.tokenHash || ''),
    expiresAt: String(input?.expiresAt || ''),
    maxUses: Number(input?.maxUses),
    uses: Number(input?.uses || 0),
    status: String(input?.status || 'pending'),
    createdAt: String(input?.createdAt || ''),
    organizationId: String(input?.organizationId || input?.workspaceId || ''),
    spaceId: input?.spaceId ? String(input.spaceId) : null,
    teamId: input?.teamId ? String(input.teamId) : input?.groupId ? String(input.groupId) : null,
  }
  return row
}

export function classifyInvite(invite, now = new Date()) {
  if (!invite) return 'pending'
  if (invite.status === 'revoked') return 'revoked'
  if (invite.status === 'declined') return 'declined'
  if (invite.status === 'accepted') return 'accepted'
  const instant = now instanceof Date ? now.getTime() : new Date(now).getTime()
  const exp = new Date(invite.expiresAt).getTime()
  if (invite.status === 'expired' || (Number.isFinite(exp) && exp <= instant)) return 'expired'
  if (Number(invite.uses) >= Number(invite.maxUses)) return 'accepted'
  return 'pending'
}

export function inviteChannel(invite) {
  if (invite?.email) return 'email'
  if (invite?.handle) return 'handle'
  return 'link'
}

export function isInviteRecipient(invite, user) {
  if (!invite || !user) return false
  if (invite.invitedUserId && invite.invitedUserId === user.id) return true
  const email = String(user.email || '').trim().toLowerCase()
  if (invite.email && email && invite.email === email) return true
  const handle = String(user.handle || '').trim().toLowerCase()
  if (invite.handle && handle && invite.handle === handle) return true
  return false
}

export function readInviteToken() {
  if (typeof window === 'undefined') return ''
  try {
    const fromUrl = new URLSearchParams(window.location.search).get('invite')
    if (fromUrl) return fromUrl
    const hash = window.location.hash || ''
    const hashToken = hash.match(/(?:^#|[?&])invite=([^&]+)/)
    if (hashToken) return decodeURIComponent(hashToken[1])
    return sessionStorage.getItem(PENDING_INVITE_KEY) || ''
  } catch {
    return ''
  }
}

export function stashInviteToken(token) {
  if (!token || typeof window === 'undefined') return
  try {
    sessionStorage.setItem(PENDING_INVITE_KEY, token)
  } catch {
    /* session storage is optional */
  }
}

export function clearInviteToken() {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.removeItem(PENDING_INVITE_KEY)
  } catch {
    /* ignore */
  }
  try {
    const url = new URL(window.location.href)
    url.searchParams.delete('invite')
    const next = `${url.pathname}${url.search}${url.hash}`
    window.history.replaceState({}, '', next)
  } catch {
    /* ignore */
  }
}
