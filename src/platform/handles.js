/** Public handles. Email never leaves this module inside a search card. */

export const HANDLE_RE = /^[a-z0-9_]{3,20}$/

export const RESERVED_HANDLES = ['admin', 'nazix', 'support', 'root', 'system', 'help', 'billing']

export function normalizeHandle(raw) {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/^@+/, '')
}

export function validateHandle(raw) {
  const text = String(raw || '').trim()
  if (/[@\s]/.test(text)) return { ok: false, reason: 'format', handle: text.toLowerCase() }
  const handle = text.toLowerCase()
  if (!HANDLE_RE.test(handle)) return { ok: false, reason: 'format', handle }
  if (RESERVED_HANDLES.includes(handle)) return { ok: false, reason: 'reserved', handle }
  return { ok: true, reason: '', handle }
}

export function initialsOf(name) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (!parts.length) return '?'
  return parts
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('')
}

/** Search and invite cards. Discoverable defaults to yes. Email is never copied. */
export function toPublicProfile(user) {
  if (!user || typeof user !== 'object') return null
  if (user.discoverable === false) return null
  const handle = normalizeHandle(user.handle)
  if (!handle) return null
  const card = {
    handle,
    displayName: String(user.displayName || user.fullName || handle),
    avatar: user.avatar ? String(user.avatar) : '',
  }
  if (user.bio) card.bio = String(user.bio)
  return card
}

export function searchProfiles(users, query) {
  const needle = normalizeHandle(query)
  return (users || [])
    .map(toPublicProfile)
    .filter(Boolean)
    .filter((card) => !needle || card.handle.includes(needle))
    .map((card) => {
      const copy = { ...card }
      delete copy.email
      delete copy.passwordHash
      return copy
    })
}
