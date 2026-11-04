import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  confirmPasswordReset,
  verifyPasswordResetCode,
  reload,
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
import { ROLES, canWriteRole, canEditEntity, canDeleteEntity, isAdmin } from './rbac'

const ADMIN_EMAIL = 'facultamalika@gmail.com'
const ADMIN_PASSWORD = 'Malika2026!'
const AUTH_MIN_PASSWORD = firebaseConfigured ? 6 : 4

const LOCAL_KEY = 'xxdashboard_v1'
const SESSION_KEY = 'xxdashboard_session_token'
const SESSION_HOURS = 24
/** Fail-open budget so splash never waits on a hung Firestore/Auth call. */
const FIRESTORE_BOOT_TIMEOUT_MS = 5000
const FIRESTORE_OP_TIMEOUT_MS = 4000

function withTimeout(promise, ms, label) {
  let timer
  return Promise.race([
    Promise.resolve(promise),
    new Promise((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error(`${label} timed out after ${ms}ms`))
      }, ms)
    }),
  ]).finally(() => {
    if (timer) clearTimeout(timer)
  })
}

/** idle | ok | timeout | error | skipped */
let firestoreSyncState = 'idle'
let realtimeAttached = false

export function getFirestoreSyncState() {
  return firestoreSyncState
}

export function getBootHint() {
  if (firestoreSyncState === 'timeout') {
    return 'Firestore n’a pas répondu à temps — poursuite avec les données locales. La connexion reste possible.'
  }
  if (firestoreSyncState === 'error') {
    return 'Firestore indisponible — poursuite avec les données locales. La connexion reste possible.'
  }
  return null
}

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

async function persistDoc(col, id, value, { required = false, remote = true } = {}) {
  memory[col][id] = value
  saveLocal(memory)
  if (remote && firebaseConfigured && db) {
    try {
      await withTimeout(
        setDoc(doc(db, col, id), value, { merge: true }),
        FIRESTORE_OP_TIMEOUT_MS,
        `Firestore write ${col}/${id}`,
      )
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

function lookupUserEmail(userId) {
  return memory.xx_users[userId]?.email || null
}

function shareFields(data, ownerUser) {
  const shares = Array.isArray(data.shares) ? data.shares : []
  const shareUserIds = [...new Set(shares.map((s) => s.userId).filter(Boolean))]
  const shareEmails = [
    ...new Set(
      shares
        .map((s) => s.email || lookupUserEmail(s.userId))
        .filter(Boolean)
        .map((e) => String(e).toLowerCase()),
    ),
  ]
  const editShares = shares.filter((s) => s.permission === 'Édition')
  const shareEditUserIds = [...new Set(editShares.map((s) => s.userId).filter(Boolean))]
  const shareEditEmails = [
    ...new Set(
      editShares
        .map((s) => s.email || lookupUserEmail(s.userId))
        .filter(Boolean)
        .map((e) => String(e).toLowerCase()),
    ),
  ]
  const ownerEmail =
    data.ownerEmail ||
    ownerUser?.email ||
    lookupUserEmail(data.ownerId) ||
    null
  return {
    shares,
    shareUserIds,
    shareEmails,
    shareEditUserIds,
    shareEditEmails,
    ownerEmail: ownerEmail ? String(ownerEmail).toLowerCase() : null,
  }
}

function remapId(value, fromId, toId) {
  return value === fromId ? toId : value
}

function remapIdList(list, fromId, toId) {
  if (!Array.isArray(list)) return list
  return list.map((value) => remapId(value, fromId, toId))
}

async function remapUserReferences(fromId, toId) {
  if (!fromId || !toId || fromId === toId) return
  const entityCols = ['xx_notes', 'xx_ideas', 'xx_projects', 'xx_events']
  for (const col of entityCols) {
    for (const row of Object.values(memory[col] || {})) {
      let changed = false
      const next = { ...row }
      if (next.ownerId === fromId) {
        next.ownerId = toId
        changed = true
      }
      if (next.leadId === fromId) {
        next.leadId = toId
        changed = true
      }
      if (Array.isArray(next.memberIds) && next.memberIds.includes(fromId)) {
        next.memberIds = remapIdList(next.memberIds, fromId, toId)
        changed = true
      }
      if (Array.isArray(next.participantIds) && next.participantIds.includes(fromId)) {
        next.participantIds = remapIdList(next.participantIds, fromId, toId)
        changed = true
      }
      if (Array.isArray(next.votes) && next.votes.includes(fromId)) {
        next.votes = remapIdList(next.votes, fromId, toId)
        changed = true
      }
      if (Array.isArray(next.shares) && next.shares.some((s) => s.userId === fromId)) {
        next.shares = next.shares.map((s) => ({
          ...s,
          userId: remapId(s.userId, fromId, toId),
        }))
        changed = true
      }
      if (Array.isArray(next.history) && next.history.some((h) => h.userId === fromId)) {
        next.history = next.history.map((h) => ({
          ...h,
          userId: remapId(h.userId, fromId, toId),
        }))
        changed = true
      }
      if (changed) {
        Object.assign(next, shareFields(next, memory.xx_users[toId]))
        await persistDoc(col, next.id, next)
      }
    }
  }
  for (const col of ['xx_sessions', 'xx_notifications', 'xx_reset_tokens']) {
    for (const row of Object.values(memory[col] || {})) {
      if (row.userId === fromId) {
        await persistDoc(col, row.id, { ...row, userId: toId })
      }
    }
  }
}

async function stampOwnedEntities(user) {
  if (!user?.id) return
  const entityCols = ['xx_notes', 'xx_ideas', 'xx_projects', 'xx_events']
  for (const col of entityCols) {
    for (const row of Object.values(memory[col] || {})) {
      const owns = row.ownerId === user.id
      const needsShares = Array.isArray(row.shares) && row.shares.length > 0
      if (!owns && !needsShares) continue
      const stamped = {
        ...row,
        ...(owns ? { ownerEmail: user.email } : {}),
        ...shareFields(row, owns ? user : null),
      }
      if (owns) stamped.ownerEmail = user.email
      const same =
        stamped.ownerEmail === row.ownerEmail &&
        JSON.stringify(stamped.shareUserIds || []) === JSON.stringify(row.shareUserIds || []) &&
        JSON.stringify(stamped.shareEmails || []) === JSON.stringify(row.shareEmails || []) &&
        JSON.stringify(stamped.shareEditUserIds || []) === JSON.stringify(row.shareEditUserIds || []) &&
        JSON.stringify(stamped.shareEditEmails || []) === JSON.stringify(row.shareEditEmails || [])
      if (!same) {
        await persistDoc(col, row.id, stamped)
      }
    }
  }
}

async function alignUserWithAuth(user, authUser) {
  if (!user || !authUser) return user
  const now = new Date().toISOString()
  const targetId = authUser.uid
  let next = {
    ...user,
    firebaseUid: authUser.uid,
    emailVerified: Boolean(user.emailVerified || authUser.emailVerified),
    updatedAt: now,
  }
  if (user.id === targetId) {
    if (
      next.firebaseUid !== user.firebaseUid ||
      next.emailVerified !== user.emailVerified
    ) {
      await persistDoc('xx_users', user.id, next)
    }
    return next
  }
  next = { ...next, id: targetId }
  await persistDoc('xx_users', targetId, next)
  await remapUserReferences(user.id, targetId)
  if (memory.xx_users[user.id] && user.id !== targetId) {
    await removeDoc('xx_users', user.id)
  }
  return next
}

async function refreshRemoteAfterAuth() {
  if (!firebaseConfigured || !db) return
  try {
    await withTimeout(pullCollectionsOnce(), FIRESTORE_OP_TIMEOUT_MS, 'post-login sync')
  } catch (err) {
    console.warn('post-login sync:', err.message)
  }
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
    case 'auth/invalid-action-code':
    case 'auth/expired-action-code':
      return 'Le code e-mail Firebase est invalide ou a expiré. Redemandez un e-mail.'
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
    const snap = await withTimeout(
      getDocs(query(collection(db, col), where(field, '==', value), limit(1))),
      FIRESTORE_OP_TIMEOUT_MS,
      `Firestore query ${col}.${field}`,
    )
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

async function ensureDefaultAdmin({ skipRemote = false } = {}) {
  const passwordHash = await sha256(ADMIN_PASSWORD)
  const now = new Date().toISOString()
  let user = skipRemote
    ? Object.values(memory.xx_users || {}).find((d) => d.email === ADMIN_EMAIL) || null
    : await findUserByEmail(ADMIN_EMAIL)
  let authUser = null
  if (!skipRemote && firebaseConfigured && auth) {
    authUser = await withTimeout(
      ensureAuthUser(ADMIN_EMAIL, ADMIN_PASSWORD),
      FIRESTORE_OP_TIMEOUT_MS,
      'Firebase Auth admin seed',
    )
  }
  if (!user) {
    const id = authUser?.uid || uid('user')
    user = {
      id,
      fullName: 'Administrateur',
      email: ADMIN_EMAIL,
      passwordHash,
      role: ROLES.ADMIN,
      emailVerified: true,
      verificationCode: null,
      firebaseUid: authUser?.uid || null,
      createdAt: now,
      updatedAt: now,
    }
    await persistDoc('xx_users', id, user, {
      required: !skipRemote && firebaseConfigured,
      remote: !skipRemote,
    })
    return
  }
  if (!skipRemote && authUser?.uid && user.id !== authUser.uid) {
    try {
      await alignUserWithAuth(user, authUser)
      return
    } catch (err) {
      console.warn('Admin uid alignment:', err.message)
    }
  }
  const patch = {}
  if (authUser?.uid && user.firebaseUid !== authUser.uid) patch.firebaseUid = authUser.uid
  if (!user.passwordHash) patch.passwordHash = passwordHash
  if (!user.emailVerified) patch.emailVerified = true
  if (user.role !== ROLES.ADMIN) patch.role = ROLES.ADMIN
  if (Object.keys(patch).length) {
    await persistDoc(
      'xx_users',
      user.id,
      { ...user, ...patch, updatedAt: now },
      { required: !skipRemote && firebaseConfigured, remote: !skipRemote },
    )
  }
}

async function pullCollectionsOnce() {
  await Promise.all(
    COLLECTIONS.map(async (col) => {
      const snap = await getDocs(collection(db, col))
      const map = {}
      snap.forEach((d) => {
        map[d.id] = { id: d.id, ...d.data() }
      })
      if (Object.keys(map).length) memory[col] = { ...memory[col], ...map }
    }),
  )
  saveLocal(memory)
  notify()
}

function attachRealtimeListeners() {
  if (!firebaseConfigured || !db || realtimeAttached) return
  realtimeAttached = true
  for (const col of COLLECTIONS) {
    try {
      onSnapshot(
        collection(db, col),
        (snap) => {
          const map = {}
          snap.forEach((d) => {
            map[d.id] = { id: d.id, ...d.data() }
          })
          memory[col] = map
          saveLocal(memory)
          notify()
          firestoreSyncState = 'ok'
        },
        (err) => {
          console.warn(`Firestore listener ${col} failed:`, err.message)
        },
      )
    } catch (err) {
      console.warn(`Firestore onSnapshot ${col} failed:`, err.message)
    }
  }
}

let bootPromise = null

export function bootStore() {
  if (bootPromise) return bootPromise
  bootPromise = (async () => {
    const deadline = Date.now() + FIRESTORE_BOOT_TIMEOUT_MS
    const remaining = (label) => {
      const ms = deadline - Date.now()
      if (ms <= 0) throw new Error(`${label} skipped, boot deadline reached`)
      return ms
    }
    try {
      if (firebaseConfigured && db) {
        try {
          await withTimeout(
            pullCollectionsOnce(),
            remaining('Firestore boot sync'),
            'Firestore boot sync',
          )
          firestoreSyncState = 'ok'
        } catch (err) {
          firestoreSyncState = /timed out|deadline/i.test(err.message) ? 'timeout' : 'error'
          console.warn('Firebase sync unavailable, using local store:', err.message)
          saveLocal(memory)
          notify()
        }
        // Non-blocking: recover in the background if Firestore later becomes reachable.
        attachRealtimeListeners()
      } else {
        firestoreSyncState = 'skipped'
      }
      try {
        const skipRemote = firestoreSyncState !== 'ok'
        const adminMs = Math.max(400, remaining('Admin seed'))
        await withTimeout(ensureDefaultAdmin({ skipRemote }), adminMs, 'Admin seed')
      } catch (err) {
        console.warn('Admin seed failed:', err.message)
        try {
          await ensureDefaultAdmin({ skipRemote: true })
        } catch (localErr) {
          console.warn('Local admin seed failed:', localErr.message)
        }
      }
    } catch (err) {
      console.warn('bootStore fail-open:', err.message)
      if (firestoreSyncState === 'idle') {
        firestoreSyncState = firebaseConfigured && db ? 'error' : 'skipped'
      }
      try {
        attachRealtimeListeners()
      } catch {
        /* ignore */
      }
      try {
        await ensureDefaultAdmin({ skipRemote: true })
      } catch (localErr) {
        console.warn('Local admin seed failed:', localErr.message)
      }
    }
    return snapshotState()
  })().catch((err) => {
    console.warn('bootStore rejected:', err?.message || err)
    if (firestoreSyncState === 'idle') {
      firestoreSyncState = firebaseConfigured && db ? 'error' : 'skipped'
    }
    return snapshotState()
  })
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
    firestoreSync: firestoreSyncState,
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
    try {
      await sendEmailVerification(authUser)
    } catch (err) {
      console.warn('sendEmailVerification:', err.message)
    }
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
    emailVerified: Boolean(authUser?.emailVerified),
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
      email: normalized,
      title: 'Code de vérification e-mail',
      body: `Votre code de vérification est ${verificationCode}. Un e-mail Firebase a aussi été envoyé. Saisissez le code ici ou cliquez le lien, puis confirmez dans Paramètres.`,
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

  let firebaseOk = false
  if (auth?.currentUser) {
    try {
      await reload(auth.currentUser)
      firebaseOk = Boolean(auth.currentUser.emailVerified)
    } catch (err) {
      console.warn('Firebase reload:', err.message)
    }
  }

  const trimmed = String(code || '').trim()
  const codeOk = Boolean(trimmed) && trimmed === String(user.verificationCode || '')
  if (!codeOk && !firebaseOk) {
    throw new Error('Code de vérification incorrect (ou lien e-mail pas encore validé).')
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

export async function resendVerificationEmail() {
  if (!firebaseConfigured || !auth?.currentUser) {
    throw new Error('Connectez-vous avec Firebase pour renvoyer l’e-mail de vérification.')
  }
  try {
    await sendEmailVerification(auth.currentUser)
  } catch (err) {
    throw new Error(mapAuthError(err))
  }
  return true
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

  if (authUser && user.passwordHash !== hash) {
    user = { ...user, passwordHash: hash, updatedAt: new Date().toISOString() }
    await persistDoc('xx_users', user.id, user)
  }

  if (authUser) {
    try {
      user = await alignUserWithAuth(user, authUser)
    } catch (err) {
      console.warn('User Auth uid alignment:', err.message)
      if (user.firebaseUid !== authUser.uid) {
        user = { ...user, firebaseUid: authUser.uid, updatedAt: new Date().toISOString() }
        await persistDoc('xx_users', user.id, user)
      }
    }
    try {
      await stampOwnedEntities(user)
    } catch (err) {
      console.warn('Ownership stamp:', err.message)
    }
    await refreshRemoteAfterAuth()
  }

  const token = randomToken(32)
  const now = Date.now()
  const expiresAt = new Date(now + SESSION_HOURS * 3600 * 1000).toISOString()
  const sessionId = uid('sess')
  const session = {
    id: sessionId,
    userId: user.id,
    email: user.email,
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
  let user = memory.xx_users[session.userId] || (await getRemoteDoc('xx_users', session.userId))
  if (!user) return null
  cacheDoc('xx_users', user)
  if (auth?.currentUser) {
    try {
      await reload(auth.currentUser)
      if (auth.currentUser.emailVerified && !user.emailVerified) {
        user = {
          ...user,
          emailVerified: true,
          verificationCode: null,
          updatedAt: new Date().toISOString(),
        }
        await persistDoc('xx_users', user.id, user)
      }
    } catch (err) {
      console.warn('Session emailVerified sync:', err.message)
    }
  }
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
  let firebaseSent = false
  if (firebaseConfigured && auth) {
    try {
      await sendPasswordResetEmail(auth, normalized)
      firebaseSent = true
    } catch (err) {
      console.warn('sendPasswordResetEmail:', err.message)
    }
  }
  const user = await findUserByEmail(normalized)
  if (!user) {
    // Ne pas révéler l'existence du compte
    return { ok: true, firebaseSent }
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
      email: user.email,
      token,
      expiresAt,
      used: false,
      createdAt: new Date().toISOString(),
    },
    { required: false },
  )
  const notifId = uid('notif')
  await persistDoc(
    'xx_notifications',
    notifId,
    {
      id: notifId,
      userId: user.id,
      email: user.email,
      type: 'password_reset',
      title: 'Réinitialisation du mot de passe',
      body: `Votre jeton temporaire est ${token}. Valable 2 heures. Un e-mail Firebase a aussi été envoyé si le compte Auth existe.`,
      read: false,
      createdAt: new Date().toISOString(),
      meta: { token },
    },
    { required: false },
  )
  return { ok: true, debugToken: token, firebaseSent }
}

async function applyPasswordHash(user, newPassword) {
  const passwordHash = await sha256(newPassword)
  const updated = {
    ...user,
    passwordHash,
    updatedAt: new Date().toISOString(),
  }
  await persistDoc('xx_users', user.id, updated, { required: firebaseConfigured })
  return updated
}

export async function resetPasswordWithToken(token, newPassword) {
  if (!newPassword || newPassword.length < AUTH_MIN_PASSWORD) {
    throw new Error(`Le mot de passe doit contenir au moins ${AUTH_MIN_PASSWORD} caractères.`)
  }
  const trimmed = String(token || '').trim()
  if (!trimmed) throw new Error('Jeton ou code e-mail Firebase requis.')

  let customOk = false
  let user = null
  const entry =
    Object.values(memory.xx_reset_tokens).find((t) => t.token === trimmed && !t.used) ||
    (await queryOne('xx_reset_tokens', 'token', trimmed))

  if (entry && !entry.used) {
    if (new Date(entry.expiresAt).getTime() < Date.now()) {
      throw new Error('Jeton expiré.')
    }
    user = memory.xx_users[entry.userId] || (await getRemoteDoc('xx_users', entry.userId))
    if (!user) throw new Error('Utilisateur introuvable.')
    await applyPasswordHash(user, newPassword)
    await persistDoc(
      'xx_reset_tokens',
      entry.id,
      {
        ...entry,
        used: true,
        usedAt: new Date().toISOString(),
      },
      { required: false },
    )
    customOk = true
    if (auth?.currentUser) {
      const currentEmail = auth.currentUser.email?.toLowerCase()
      if (
        currentEmail === user.email ||
        auth.currentUser.uid === user.firebaseUid ||
        auth.currentUser.uid === user.id
      ) {
        try {
          await updatePassword(auth.currentUser, newPassword)
        } catch (err) {
          console.warn('Firebase Auth updatePassword:', err.message)
        }
      }
    }
  }

  if (firebaseConfigured && auth) {
    try {
      const emailFromCode = await verifyPasswordResetCode(auth, trimmed)
      await confirmPasswordReset(auth, trimmed, newPassword)
      const normalized = String(emailFromCode || '').toLowerCase()
      user = user || (await findUserByEmail(normalized))
      if (user) {
        await applyPasswordHash(user, newPassword)
      }
      return true
    } catch (err) {
      if (customOk) {
        console.warn('confirmPasswordReset:', err.message)
        return true
      }
      const code = err?.code || ''
      if (
        code === 'auth/invalid-action-code' ||
        code === 'auth/expired-action-code' ||
        code === 'auth/argument-error'
      ) {
        throw new Error('Jeton invalide ou déjà utilisé.')
      }
      throw new Error(mapAuthError(err))
    }
  }

  if (customOk) return true
  throw new Error('Jeton invalide ou déjà utilisé.')
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
    role: user.role,
    updatedAt: new Date().toISOString(),
  }
  if (patch.fullName) updated.fullName = patch.fullName.trim()
  await persistDoc('xx_users', userId, updated)
  return publicUser(updated)
}

export async function updateUserRole(targetId, role, actor) {
  if (!isAdmin(actor)) throw new Error('Seuls les administrateurs peuvent changer les rôles.')
  const valid = Object.values(ROLES)
  if (!valid.includes(role)) throw new Error('Rôle invalide.')
  const user = memory.xx_users[targetId] || (await getRemoteDoc('xx_users', targetId))
  if (!user) throw new Error('Utilisateur introuvable.')
  cacheDoc('xx_users', user)
  const updated = {
    ...user,
    role,
    updatedAt: new Date().toISOString(),
  }
  await persistDoc('xx_users', user.id, updated, { required: firebaseConfigured })
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
  if (!existing) {
    if (!canWriteRole(user)) {
      throw new Error('Permission refusée (rôle Lecteur : création interdite).')
    }
  } else if (!canEditEntity(user, existing)) {
    throw new Error('Permission refusée.')
  }
  const merged = {
    ...existing,
    ...data,
    id,
    ownerId: existing?.ownerId || data.ownerId || user.id,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  }
  const docData = {
    ...merged,
    ...shareFields(merged, user),
    ownerEmail:
      existing?.ownerEmail ||
      data.ownerEmail ||
      (merged.ownerId === user.id ? user.email : lookupUserEmail(merged.ownerId)),
  }
  await persistDoc(col, id, docData)
  return docData
}

async function destroy(col, id, user) {
  const existing = memory[col][id]
  if (user && existing && !canDeleteEntity(user, existing)) {
    throw new Error('Permission refusée.')
  }
  await removeDoc(col, id)
}

export async function saveNote(data, user) {
  return upsert('xx_notes', data, user)
}
export async function deleteNote(id, user) {
  return destroy('xx_notes', id, user)
}
export async function saveIdea(data, user) {
  const idea = await upsert('xx_ideas', data, user)
  return idea
}
export async function deleteIdea(id, user) {
  return destroy('xx_ideas', id, user)
}
export async function saveProject(data, user) {
  return upsert('xx_projects', data, user)
}
export async function deleteProject(id, user) {
  return destroy('xx_projects', id, user)
}
export async function saveEvent(data, user) {
  return upsert('xx_events', data, user)
}
export async function deleteEvent(id, user) {
  return destroy('xx_events', id, user)
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
  const target = payload.userId ? memory.xx_users[payload.userId] : null
  const notif = {
    id,
    read: false,
    createdAt: new Date().toISOString(),
    email: payload.email || target?.email || null,
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
  try {
    const snap = await withTimeout(
      getDoc(doc(db, col, id)),
      FIRESTORE_OP_TIMEOUT_MS,
      `Firestore get ${col}/${id}`,
    )
    return snap.exists() ? { id: snap.id, ...snap.data() } : null
  } catch (err) {
    console.warn(`Firestore get ${col}/${id} failed:`, err.message)
    return null
  }
}
