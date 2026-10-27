import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
} from 'firebase/auth'
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  getDocs,
  getDoc,
  query,
  where,
  limit,
} from 'firebase/firestore'
import { auth, db, firebaseConfigured, getFirebaseStatus } from './firebase'
import { sha256, randomToken, randomCode6, uid } from './crypto'
import { ROLES } from './rbac'

const ADMIN_EMAIL = 'admin@xxdashboard.fr'
const ADMIN_PASSWORD = 'Admin123!'
const AUTH_MIN_PASSWORD = firebaseConfigured ? 6 : 4

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

async function persistDoc(col, id, value, { required = false } = {}) {
  memory[col][id] = value
  saveLocal(memory)
  if (firebaseConfigured && db) {
    try {
      await setDoc(doc(db, col, id), value, { merge: true })
    } catch (err) {
      console.warn(`Firestore write ${col}/${id} failed:`, err.message)
      if (required) {
        throw new Error(`Écriture Firebase impossible (${col}) : ${err.message}`)
      }
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

function mapAuthError(err) {
  const code = err?.code || ''
  switch (code) {
    case 'auth/email-already-in-use':
      return 'Un compte existe déjà avec cet e-mail.'
    case 'auth/invalid-email':
      return 'Adresse e-mail invalide.'
    case 'auth/weak-password':
      return 'Le mot de passe doit contenir au moins 6 caractères (exigence Firebase Auth).'
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Identifiants incorrects.'
    case 'auth/too-many-requests':
      return 'Trop de tentatives. Réessayez dans quelques minutes.'
    case 'auth/network-request-failed':
      return 'Réseau indisponible : impossible de joindre Firebase.'
    case 'auth/operation-not-allowed':
      return 'Activez le fournisseur E-mail/mot de passe dans Firebase Authentication.'
    default:
      return err?.message || 'Erreur Firebase Auth.'
  }
}

function cacheDoc(col, row) {
  if (!row?.id) return row
  memory[col][row.id] = row
  return row
}

async function queryOne(col, field, value) {
  const local = Object.values(memory[col] || {}).find((d) => d[field] === value)
  if (local) return local
  if (!firebaseConfigured || !db) return null
  try {
    const snap = await getDocs(query(collection(db, col), where(field, '==', value), limit(1)))
    if (snap.empty) return null
    const d = snap.docs[0]
    return cacheDoc(col, { id: d.id, ...d.data() })
  } catch (err) {
    console.warn(`Firestore query ${col}.${field} failed:`, err.message)
    return null
  }
}

async function findUserByEmail(email) {
  return queryOne('xx_users', 'email', email)
}

async function findUserByFirebaseUid(firebaseUid) {
  if (!firebaseUid) return null
  const byId = memory.xx_users[firebaseUid]
  if (byId) return byId
  if (firebaseConfigured && db) {
    try {
      const remote = await getRemoteDoc('xx_users', firebaseUid)
      if (remote) return cacheDoc('xx_users', remote)
    } catch (err) {
      console.warn('Firestore user-by-uid lookup failed:', err.message)
    }
  }
  return Object.values(memory.xx_users).find((u) => u.firebaseUid === firebaseUid) || null
}

function requireFirebaseAuth() {
  if (!firebaseConfigured || !auth) {
    throw new Error(
      'Firebase Auth n’est pas initialisé. Vérifiez les variables VITE_FIREBASE_* et redémarrez Vite.',
    )
  }
}

async function createAuthUser(email, password) {
  requireFirebaseAuth()
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password)
    return cred.user
  } catch (err) {
    throw new Error(mapAuthError(err))
  }
}

async function signInAuth(email, password) {
  if (!firebaseConfigured || !auth) return null
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password)
    return cred.user
  } catch (err) {
    if (
      err.code === 'auth/user-not-found' ||
      err.code === 'auth/wrong-password' ||
      err.code === 'auth/invalid-credential' ||
      err.code === 'auth/invalid-email'
    ) {
      return null
    }
    throw new Error(mapAuthError(err))
  }
}

async function ensureAuthUser(email, password) {
  if (!firebaseConfigured || !auth) return null
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password)
    return cred.user
  } catch (err) {
    if (err.code === 'auth/email-already-in-use') {
      return signInAuth(email, password)
    }
    console.warn('Firebase Auth ensure user:', err.message)
    return null
  }
}

async function signOutAuthSafe() {
  if (!auth) return
  try {
    if (auth.currentUser) await signOut(auth)
  } catch (err) {
    console.warn('Firebase Auth signOut:', err.message)
  }
}

async function ensureDefaultAdmin() {
  const passwordHash = await sha256(ADMIN_PASSWORD)
  const now = new Date().toISOString()
  let user = await findUserByEmail(ADMIN_EMAIL)
  let authUser = null
  if (firebaseConfigured && auth) {
    authUser = await ensureAuthUser(ADMIN_EMAIL, ADMIN_PASSWORD)
  }
  if (!user) {
    const id = authUser?.uid || uid('user')
    user = {
      id,
      fullName: 'Administrateur XX',
      email: ADMIN_EMAIL,
      passwordHash,
      role: ROLES.ADMIN,
      emailVerified: true,
      verificationCode: null,
      firebaseUid: authUser?.uid || null,
      createdAt: now,
      updatedAt: now,
    }
    await persistDoc('xx_users', id, user, { required: firebaseConfigured })
    return
  }
  const patch = {}
  if (authUser?.uid && user.firebaseUid !== authUser.uid) patch.firebaseUid = authUser.uid
  if (!user.passwordHash) patch.passwordHash = passwordHash
  if (Object.keys(patch).length) {
    await persistDoc(
      'xx_users',
      user.id,
      { ...user, ...patch, updatedAt: now },
      { required: firebaseConfigured },
    )
  }
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
    try {
      await ensureDefaultAdmin()
    } catch (err) {
      console.warn('Admin seed failed:', err.message)
    }
    return snapshotState()
  })()
  return bootPromise
}

export function getBackendMode() {
  return firebaseConfigured && db ? 'firebase' : 'local'
}

export function getMinPasswordLength() {
  return AUTH_MIN_PASSWORD
}

export function diagnoseDatabase() {
  const counts = Object.fromEntries(
    COLLECTIONS.map((c) => [c, Object.keys(memory[c] || {}).length]),
  )
  return {
    mode: getBackendMode(),
    firebase: getFirebaseStatus(),
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
  if (!password || password.length < AUTH_MIN_PASSWORD) {
    throw new Error(`Le mot de passe doit contenir au moins ${AUTH_MIN_PASSWORD} caractères.`)
  }
  const exists = await findUserByEmail(normalized)
  if (exists) throw new Error('Un compte existe déjà avec cet e-mail.')

  let authUser = null
  if (firebaseConfigured) {
    authUser = await createAuthUser(normalized, password)
  }

  const id = authUser?.uid || uid('user')
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
    firebaseUid: authUser?.uid || null,
    createdAt: now,
    updatedAt: now,
  }
  await persistDoc('xx_users', id, user, { required: firebaseConfigured })

  const notifId = uid('notif')
  await persistDoc(
    'xx_notifications',
    notifId,
    {
      id: notifId,
      userId: id,
      type: 'email_verification',
      title: 'Code de vérification e-mail',
      body: `Votre code de vérification est ${verificationCode}. Saisissez-le dans Paramètres pour activer votre compte.`,
      read: false,
      createdAt: now,
      meta: { verificationCode },
    },
    { required: firebaseConfigured },
  )

  return { user: publicUser(user), verificationCode }
}

export async function verifyEmail(userId, code) {
  const user = memory.xx_users[userId] || (await getRemoteDoc('xx_users', userId))
  if (!user) throw new Error('Utilisateur introuvable.')
  cacheDoc('xx_users', user)
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
  await persistDoc('xx_users', userId, updated, { required: firebaseConfigured })
  return publicUser(updated)
}

export async function loginUser(email, password) {
  const normalized = email.trim().toLowerCase()
  if (!password) throw new Error('Identifiants incorrects.')

  let user = await findUserByEmail(normalized)
  const hash = await sha256(password)
  const hashOk = Boolean(user && user.passwordHash === hash)

  let authUser = null
  if (firebaseConfigured && auth) {
    authUser = await signInAuth(normalized, password)
    if (!user && authUser) {
      user = await findUserByFirebaseUid(authUser.uid)
    }
    if (hashOk && !authUser) {
      // Compte Firestore existant (ex. reset SHA-256) sans Auth, ou Auth pas encore créé.
      authUser = await ensureAuthUser(normalized, password)
    }
  }

  if (!hashOk && !authUser) throw new Error('Identifiants incorrects.')

  if (!user && authUser) {
    const now = new Date().toISOString()
    user = {
      id: authUser.uid,
      fullName: authUser.displayName || normalized.split('@')[0],
      email: normalized,
      passwordHash: hash,
      role: normalized === ADMIN_EMAIL ? ROLES.ADMIN : ROLES.MEMBER,
      emailVerified: Boolean(authUser.emailVerified),
      verificationCode: null,
      firebaseUid: authUser.uid,
      createdAt: now,
      updatedAt: now,
    }
    await persistDoc('xx_users', user.id, user, { required: true })
  }

  if (!user) throw new Error('Identifiants incorrects.')

  if (authUser && user.firebaseUid !== authUser.uid) {
    user = { ...user, firebaseUid: authUser.uid, updatedAt: new Date().toISOString() }
    await persistDoc('xx_users', user.id, user)
  }

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
  await persistDoc('xx_sessions', sessionId, session, { required: firebaseConfigured })
  localStorage.setItem(SESSION_KEY, token)
  return { user: publicUser(user), session }
}

export async function logoutCurrentSession() {
  const token = localStorage.getItem(SESSION_KEY)
  if (token) {
    const session =
      Object.values(memory.xx_sessions).find((s) => s.token === token) ||
      (await queryOne('xx_sessions', 'token', token))
    if (session) {
      await persistDoc(
        'xx_sessions',
        session.id,
        {
          ...session,
          active: false,
          revokedAt: new Date().toISOString(),
        },
        { required: firebaseConfigured },
      )
    }
  }
  localStorage.removeItem(SESSION_KEY)
  await signOutAuthSafe()
}

export async function getCurrentSession() {
  const token = localStorage.getItem(SESSION_KEY)
  if (!token) return null
  let session =
    Object.values(memory.xx_sessions).find((s) => s.token === token) ||
    (await queryOne('xx_sessions', 'token', token))
  if (!session || !session.active) {
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
  const user = memory.xx_users[session.userId] || (await getRemoteDoc('xx_users', session.userId))
  if (!user) return null
  cacheDoc('xx_users', user)
  return { user: publicUser(user), session }
}

export async function revokeSession(sessionId, requester) {
  const session = memory.xx_sessions[sessionId]
  if (!session) throw new Error('Session introuvable.')
  if (session.userId !== requester.id && requester.role !== ROLES.ADMIN) {
    throw new Error('Permission refusée.')
  }
  await persistDoc(
    'xx_sessions',
    sessionId,
    {
      ...session,
      active: false,
      revokedAt: new Date().toISOString(),
    },
    { required: firebaseConfigured },
  )
  if (localStorage.getItem(SESSION_KEY) === session.token) {
    localStorage.removeItem(SESSION_KEY)
    await signOutAuthSafe()
  }
}

export async function requestPasswordReset(email) {
  const normalized = email.trim().toLowerCase()
  const user = await findUserByEmail(normalized)
  if (!user) {
    // Ne pas révéler l'existence du compte
    return { ok: true }
  }
  const token = randomToken(16)
  const id = uid('reset')
  const expiresAt = new Date(Date.now() + 2 * 3600 * 1000).toISOString()
  await persistDoc(
    'xx_reset_tokens',
    id,
    {
      id,
      userId: user.id,
      token,
      expiresAt,
      used: false,
      createdAt: new Date().toISOString(),
    },
    { required: firebaseConfigured },
  )
  const notifId = uid('notif')
  await persistDoc(
    'xx_notifications',
    notifId,
    {
      id: notifId,
      userId: user.id,
      type: 'password_reset',
      title: 'Réinitialisation du mot de passe',
      body: `Votre jeton temporaire est ${token}. Valable 2 heures.`,
      read: false,
      createdAt: new Date().toISOString(),
      meta: { token },
    },
    { required: firebaseConfigured },
  )
  return { ok: true, debugToken: token }
}

export async function resetPasswordWithToken(token, newPassword) {
  if (!newPassword || newPassword.length < AUTH_MIN_PASSWORD) {
    throw new Error(`Le mot de passe doit contenir au moins ${AUTH_MIN_PASSWORD} caractères.`)
  }
  const entry =
    Object.values(memory.xx_reset_tokens).find((t) => t.token === token && !t.used) ||
    (await queryOne('xx_reset_tokens', 'token', token))
  if (!entry || entry.used) throw new Error('Jeton invalide ou déjà utilisé.')
  if (new Date(entry.expiresAt).getTime() < Date.now()) {
    throw new Error('Jeton expiré.')
  }
  const user = memory.xx_users[entry.userId] || (await getRemoteDoc('xx_users', entry.userId))
  if (!user) throw new Error('Utilisateur introuvable.')
  const passwordHash = await sha256(newPassword)
  await persistDoc(
    'xx_users',
    user.id,
    {
      ...user,
      passwordHash,
      updatedAt: new Date().toISOString(),
    },
    { required: firebaseConfigured },
  )
  await persistDoc(
    'xx_reset_tokens',
    entry.id,
    {
      ...entry,
      used: true,
      usedAt: new Date().toISOString(),
    },
    { required: firebaseConfigured },
  )
  if (auth?.currentUser) {
    const currentEmail = auth.currentUser.email?.toLowerCase()
    if (currentEmail === user.email || auth.currentUser.uid === user.firebaseUid) {
      try {
        await updatePassword(auth.currentUser, newPassword)
      } catch (err) {
        console.warn('Firebase Auth updatePassword:', err.message)
      }
    }
  }
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
