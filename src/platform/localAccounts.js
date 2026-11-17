/** Local fallback accounts. Passwords are stored as SHA-256 only. */
export const LOCAL_SEEDED_USERS = Object.freeze([
  Object.freeze({
    id: 'user_testeur_nazix',
    fullName: 'Testeur',
    handle: 'testeur',
    email: 'testeur@nazix.app',
    passwordHash: '100efc67b28f0de3eef4db950876d78a4cb1161b1f9d308d8bc59cd2e4762a4a',
    role: 'Membre',
    status: 'active',
    emailVerified: true,
    verificationCode: null,
    firebaseUid: null,
    createdAt: '2026-11-17T00:00:00.000Z',
    updatedAt: '2026-11-17T00:00:00.000Z',
  }),
])

function sameSeed(existing, next) {
  return (
    existing.fullName === next.fullName &&
    existing.handle === next.handle &&
    existing.email === next.email &&
    existing.passwordHash === next.passwordHash &&
    existing.role === next.role &&
    Boolean(existing.emailVerified) === Boolean(next.emailVerified) &&
    (existing.status || 'active') === (next.status || 'active')
  )
}

/**
 * Insert the local test account. An existing row is updated only when its
 * email is this exact test account.
 */
export function applyLocalAccountSeed(db) {
  if (!db || typeof db !== 'object') return false
  if (!db.xx_users || typeof db.xx_users !== 'object') db.xx_users = {}
  let changed = false
  for (const seed of LOCAL_SEEDED_USERS) {
    const existingId = Object.keys(db.xx_users).find(
      (id) => String(db.xx_users[id]?.email || '').trim().toLowerCase() === seed.email,
    )
    if (!existingId) {
      db.xx_users[seed.id] = { ...seed }
      changed = true
      continue
    }
    const existing = db.xx_users[existingId]
    const next = {
      ...existing,
      fullName: seed.fullName,
      handle: seed.handle,
      email: seed.email,
      passwordHash: seed.passwordHash,
      role: seed.role,
      emailVerified: Boolean(existing.emailVerified || seed.emailVerified),
      status: existing.status || seed.status,
    }
    if (!sameSeed(existing, next)) {
      db.xx_users[existingId] = next
      changed = true
    }
  }
  return changed
}
