import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  getDocs,
  getDoc,
} from 'firebase/firestore'
import { db, firebaseConfigured } from './firebase'
import { sha256, randomToken, randomCode6, uid } from './crypto'
import { ROLES } from './rbac'

const LOCAL_KEY = 'xxdashboard_v1'
const SESSION_KEY = 'xxdashboard_session_token'
const SESSION_HOURS = 24

const COLLECTIONS = [
  'xx_users',
  'xx_sessions',
  'xx_notes',
  'xx_ideas',
  'xx_projects',
  'xx_events',
  'xx_notifications',
  'xx_reset_tokens',
]

function emptyDb() {
  return Object.fromEntries(COLLECTIONS.map((c) => [c, {}]))
}

function loadLocal() {
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    if (!raw) return emptyDb()
    const parsed = JSON.parse(raw)
    const base = emptyDb()
    for (const c of COLLECTIONS) {
      base[c] = parsed[c] || {}
    }
    return base
  } catch {
    return emptyDb()
  }
}

function saveLocal(data) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(data))
}

let memory = loadLocal()
const listeners = new Set()

function notify() {
  for (const fn of listeners) fn(snapshotState())
}

function snapshotState() {
  return structuredClone(memory)
}

export function subscribeStore(fn) {
  listeners.add(fn)
  fn(snapshotState())
  return () => listeners.delete(fn)
}

export function getStoreSnapshot() {
  return snapshotState()
}

async function persistDoc(col, id, value) {
  memory[col][id] = value
  saveLocal(memory)
  if (firebaseConfigured && db) {
    try {
      await setDoc(doc(db, col, id), value, { merge: true })
    } catch (err) {
      console.warn(`Firestore write ${col}/${id} failed:`, err.message)
    }
  }
  notify()
}

async function removeDoc(col, id) {
  delete memory[col][id]
  saveLocal(memory)
  if (firebaseConfigured && db) {
    try {
      await deleteDoc(doc(db, col, id))
    } catch (err) {
      console.warn(`Firestore delete ${col}/${id} failed:`, err.message)
    }
  }
  notify()
}

async function ensureDefaultAdmin() {
  const users = Object.values(memory.xx_users)
  const exists = users.find((u) => u.email === 'admin@xxdashboard.fr')
  if (exists) return
  const id = uid('user')
  const passwordHash = await sha256('Admin123!')
  const now = new Date().toISOString()
  await persistDoc('xx_users', id, {
    id,
    fullName: 'Administrateur XX',
    email: 'admin@xxdashboard.fr',
    passwordHash,
    role: ROLES.ADMIN,
    emailVerified: true,
    verificationCode: null,
    createdAt: now,
    updatedAt: now,
  })
}

let bootPromise = null

export function bootStore() {
  if (bootPromise) return bootPromise
  bootPromise = (async () => {
    if (firebaseConfigured && db) {
      try {
        for (const col of COLLECTIONS) {
          const snap = await getDocs(collection(db, col))
          const map = {}
          snap.forEach((d) => {
            map[d.id] = { id: d.id, ...d.data() }
          })
          if (Object.keys(map).length) memory[col] = { ...memory[col], ...map }
        }
        saveLocal(memory)
        notify()
        for (const col of COLLECTIONS) {
          onSnapshot(collection(db, col), (snap) => {
            const map = {}
            snap.forEach((d) => {
              map[d.id] = { id: d.id, ...d.data() }
            })
            memory[col] = map
            saveLocal(memory)
            notify()
          })
        }
      } catch (err) {
        console.warn('Firebase sync unavailable, using local store:', err.message)
      }
    }
    await ensureDefaultAdmin()
    return snapshotState()
  })()
  return bootPromise
}

export function getBackendMode() {
  return firebaseConfigured && db ? 'firebase' : 'local'
}

export function diagnoseDatabase() {
  const counts = Object.fromEntries(
    COLLECTIONS.map((c) => [c, Object.keys(memory[c] || {}).length]),
  )
  return {
    mode: getBackendMode(),
    firebaseConfigured,
    collections: counts,
    totalDocuments: Object.values(counts).reduce((a, b) => a + b, 0),
    localKey: LOCAL_KEY,
    generatedAt: new Date().toISOString(),
  }
}

export async function exportDeploymentKit() {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    mode: getBackendMode(),
    data: snapshotState(),
  }
}

/* ─── Auth ─── */

export async function registerUser({ fullName, email, password }) {
  const normalized = email.trim().toLowerCase()
  if (!fullName?.trim()) throw new Error('Le nom complet est requis.')
  if (!normalized.includes('@')) throw new Error('Adresse e-mail invalide.')
  if (!password || password.length < 4) {
    throw new Error('Le mot de passe doit contenir au moins 4 caractères.')
  }
  const exists = Object.values(memory.xx_users).find((u) => u.email === normalized)
  if (exists) throw new Error('Un compte existe déjà avec cet e-mail.')

  const id = uid('user')
  const passwordHash = await sha256(password)
  const verificationCode = randomCode6()
  const now = new Date().toISOString()
  const user = {
    id,
    fullName: fullName.trim(),
    email: normalized,
    passwordHash,
    role: ROLES.MEMBER,
    emailVerified: false,
    verificationCode,
    createdAt: now,
    updatedAt: now,
  }
  await persistDoc('xx_users', id, user)

  const notifId = uid('notif')
  await persistDoc('xx_notifications', notifId, {
    id: notifId,
    userId: id,
    type: 'email_verification',
    title: 'Code de vérification e-mail',
    body: `Votre code de vérification est ${verificationCode}. Saisissez-le dans Paramètres pour activer votre compte.`,
    read: false,
    createdAt: now,
    meta: { verificationCode },
  })

  return { user: publicUser(user), verificationCode }
}

export async function verifyEmail(userId, code) {
  const user = memory.xx_users[userId]
  if (!user) throw new Error('Utilisateur introuvable.')
  if (user.emailVerified) return publicUser(user)
  if (String(code).trim() !== String(user.verificationCode)) {
    throw new Error('Code de vérification incorrect.')
  }
  const updated = {
    ...user,
    emailVerified: true,
    verificationCode: null,
    updatedAt: new Date().toISOString(),
  }
  await persistDoc('xx_users', userId, updated)
  return publicUser(updated)
}

export async function loginUser(email, password) {
  const normalized = email.trim().toLowerCase()
  const user = Object.values(memory.xx_users).find((u) => u.email === normalized)
  if (!user) throw new Error('Identifiants incorrects.')
  const hash = await sha256(password)
  if (hash !== user.passwordHash) throw new Error('Identifiants incorrects.')

  const token = randomToken(32)
  const now = Date.now()
  const expiresAt = new Date(now + SESSION_HOURS * 3600 * 1000).toISOString()
  const sessionId = uid('sess')
  const session = {
    id: sessionId,
    userId: user.id,
    token,
    createdAt: new Date(now).toISOString(),
    expiresAt,
    active: true,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
  }
  await persistDoc('xx_sessions', sessionId, session)
  localStorage.setItem(SESSION_KEY, token)
  return { user: publicUser(user), session }
}

export async function logoutCurrentSession() {
  const token = localStorage.getItem(SESSION_KEY)
  if (!token) return
  const session = Object.values(memory.xx_sessions).find((s) => s.token === token)
  if (session) {
    await persistDoc('xx_sessions', session.id, {
      ...session,
      active: false,
      revokedAt: new Date().toISOString(),
    })
  }
  localStorage.removeItem(SESSION_KEY)
}

export async function getCurrentSession() {
  const token = localStorage.getItem(SESSION_KEY)
  if (!token) return null
  const session = Object.values(memory.xx_sessions).find(
    (s) => s.token === token && s.active,
  )
  if (!session) {
    localStorage.removeItem(SESSION_KEY)
    return null
  }
  if (new Date(session.expiresAt).getTime() < Date.now()) {
    await persistDoc('xx_sessions', session.id, {
      ...session,
      active: false,
      revokedAt: new Date().toISOString(),
    })
    localStorage.removeItem(SESSION_KEY)
    return null
  }
  const user = memory.xx_users[session.userId]
  if (!user) return null
  return { user: publicUser(user), session }
}

export async function revokeSession(sessionId, requester) {
  const session = memory.xx_sessions[sessionId]
  if (!session) throw new Error('Session introuvable.')
  if (session.userId !== requester.id && requester.role !== ROLES.ADMIN) {
    throw new Error('Permission refusée.')
  }
  await persistDoc('xx_sessions', sessionId, {
    ...session,
    active: false,
    revokedAt: new Date().toISOString(),
  })
  if (localStorage.getItem(SESSION_KEY) === session.token) {
    localStorage.removeItem(SESSION_KEY)
  }
}

export async function requestPasswordReset(email) {
  const normalized = email.trim().toLowerCase()
  const user = Object.values(memory.xx_users).find((u) => u.email === normalized)
  if (!user) {
    // Ne pas révéler l'existence du compte
    return { ok: true }
  }
  const token = randomToken(16)
  const id = uid('reset')
  const expiresAt = new Date(Date.now() + 2 * 3600 * 1000).toISOString()
  await persistDoc('xx_reset_tokens', id, {
    id,
    userId: user.id,
    token,
    expiresAt,
    used: false,
    createdAt: new Date().toISOString(),
  })
  const notifId = uid('notif')
  await persistDoc('xx_notifications', notifId, {
    id: notifId,
    userId: user.id,
    type: 'password_reset',
    title: 'Réinitialisation du mot de passe',
    body: `Votre jeton temporaire est ${token}. Valable 2 heures.`,
    read: false,
    createdAt: new Date().toISOString(),
    meta: { token },
  })
  return { ok: true, debugToken: token }
}

export async function resetPasswordWithToken(token, newPassword) {
  if (!newPassword || newPassword.length < 4) {
    throw new Error('Le mot de passe doit contenir au moins 4 caractères.')
  }
  const entry = Object.values(memory.xx_reset_tokens).find(
    (t) => t.token === token && !t.used,
  )
  if (!entry) throw new Error('Jeton invalide ou déjà utilisé.')
  if (new Date(entry.expiresAt).getTime() < Date.now()) {
    throw new Error('Jeton expiré.')
  }
  const user = memory.xx_users[entry.userId]
  if (!user) throw new Error('Utilisateur introuvable.')
  const passwordHash = await sha256(newPassword)
  await persistDoc('xx_users', user.id, {
    ...user,
    passwordHash,
    updatedAt: new Date().toISOString(),
  })
  await persistDoc('xx_reset_tokens', entry.id, {
    ...entry,
    used: true,
    usedAt: new Date().toISOString(),
  })
  return true
}

export async function updateProfile(userId, patch) {
  const user = memory.xx_users[userId]
  if (!user) throw new Error('Utilisateur introuvable.')
  const updated = {
    ...user,
    ...patch,
    id: user.id,
    email: user.email,
    passwordHash: user.passwordHash,
    role: patch.role && user.role === ROLES.ADMIN ? patch.role : user.role,
    updatedAt: new Date().toISOString(),
  }
  // Allow self fullName update only unless admin handled elsewhere
  if (patch.fullName) updated.fullName = patch.fullName.trim()
  await persistDoc('xx_users', userId, updated)
  return publicUser(updated)
}

function publicUser(user) {
  const { passwordHash, verificationCode, ...rest } = user
  return rest
}

export function listUsers() {
  return Object.values(memory.xx_users).map(publicUser)
}

export function listSessionsForUser(userId) {
  return Object.values(memory.xx_sessions)
    .filter((s) => s.userId === userId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
}

/* ─── Generic CRUD helpers ─── */

async function upsert(col, data, user) {
  const now = new Date().toISOString()
  const id = data.id || uid(col.replace('xx_', '').slice(0, 4))
  const existing = memory[col][id]
  const docData = {
    ...existing,
    ...data,
    id,
    ownerId: existing?.ownerId || data.ownerId || user.id,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  }
  await persistDoc(col, id, docData)
  return docData
}

async function destroy(col, id) {
  await removeDoc(col, id)
}

export async function saveNote(data, user) {
  return upsert('xx_notes', data, user)
}
export async function deleteNote(id) {
  return destroy('xx_notes', id)
}
export async function saveIdea(data, user) {
  const idea = await upsert('xx_ideas', data, user)
  return idea
}
export async function deleteIdea(id) {
  return destroy('xx_ideas', id)
}
export async function saveProject(data, user) {
  return upsert('xx_projects', data, user)
}
export async function deleteProject(id) {
  return destroy('xx_projects', id)
}
export async function saveEvent(data, user) {
  return upsert('xx_events', data, user)
}
export async function deleteEvent(id) {
  return destroy('xx_events', id)
}

export async function appendIdeaHistory(ideaId, entry) {
  const idea = memory.xx_ideas[ideaId]
  if (!idea) throw new Error('Idée introuvable.')
  const history = [...(idea.history || []), { ...entry, at: new Date().toISOString() }]
  const updated = { ...idea, history, updatedAt: new Date().toISOString() }
  await persistDoc('xx_ideas', ideaId, updated)
  return updated
}

export async function voteIdea(ideaId, userId) {
  const idea = memory.xx_ideas[ideaId]
  if (!idea) throw new Error('Idée introuvable.')
  const votes = new Set(idea.votes || [])
  if (votes.has(userId)) {
    votes.delete(userId)
  } else {
    votes.add(userId)
  }
  const updated = {
    ...idea,
    votes: [...votes],
    updatedAt: new Date().toISOString(),
  }
  await persistDoc('xx_ideas', ideaId, updated)
  await appendIdeaHistory(ideaId, {
    type: votes.has(userId) ? 'vote' : 'unvote',
    userId,
    label: votes.has(userId) ? 'Vote ajouté' : 'Vote retiré',
  })
  return memory.xx_ideas[ideaId]
}

export async function createNotification(payload) {
  const id = uid('notif')
  const notif = {
    id,
    read: false,
    createdAt: new Date().toISOString(),
    ...payload,
  }
  await persistDoc('xx_notifications', id, notif)
  return notif
}

export async function notifyUsers(userIds, payload) {
  const unique = [...new Set(userIds.filter(Boolean))]
  await Promise.all(unique.map((userId) => createNotification({ ...payload, userId })))
}

export async function markNotificationRead(id) {
  const n = memory.xx_notifications[id]
  if (!n) return
  await persistDoc('xx_notifications', id, { ...n, read: true })
}

export async function markAllNotificationsRead(userId) {
  const list = Object.values(memory.xx_notifications).filter(
    (n) => n.userId === userId && !n.read,
  )
  await Promise.all(
    list.map((n) => persistDoc('xx_notifications', n.id, { ...n, read: true })),
  )
}

export async function pushLocalToFirebase() {
  if (!firebaseConfigured || !db) throw new Error('Firebase non configuré.')
  for (const col of COLLECTIONS) {
    for (const [id, value] of Object.entries(memory[col])) {
      await setDoc(doc(db, col, id), value, { merge: true })
    }
  }
  return diagnoseDatabase()
}

export async function pullFirebaseToLocal() {
  if (!firebaseConfigured || !db) throw new Error('Firebase non configuré.')
  for (const col of COLLECTIONS) {
    const snap = await getDocs(collection(db, col))
    const map = {}
    snap.forEach((d) => {
      map[d.id] = { id: d.id, ...d.data() }
    })
    memory[col] = map
  }
  saveLocal(memory)
  notify()
  return diagnoseDatabase()
}

export async function getRemoteDoc(col, id) {
  if (!firebaseConfigured || !db) return null
  const snap = await getDoc(doc(db, col, id))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}
