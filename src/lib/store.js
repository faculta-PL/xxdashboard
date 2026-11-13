/** Nazix store — collections xx_* kept for Firestore compatibility. */
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
import { ref, uploadBytesResumable, getBlob, deleteObject } from 'firebase/storage'
import { auth, db, storage, firebaseConfigured, getFirebaseStatus, firebaseConfig } from './firebase'
import { sha256, randomToken, randomCode6, uid } from './crypto'
import { toIsoDate } from './calendar'
import {
  ROLES,
  canWriteRole,
  canEditEntity,
  canDeleteEntity,
  isAdmin,
  isAdminEmail,
  canReadGroup,
  canWriteGroup,
  canAddInFolder,
  canModifyFileOrFolder,
  canManageFileOrFolder,
  canDeleteFileOrFolder,
  canReadFileOrFolder,
  canManageBudgetRisk,
  canDeleteBudgetRisk,
  computeRiskPriority,
  isNoteAncestor,
  LINK_TYPES,
  BUDGET_CURRENCIES,
  BUDGET_CATEGORIES,
  BUDGET_LINE_KINDS,
  BUDGET_ACTUAL_STATUSES,
  RISK_CATEGORIES,
  RISK_PROBABILITIES,
  RISK_IMPACTS,
  RISK_STATUSES,
  RISK_ACTION_STATUSES,
} from './rbac'
import {
  validateUploadFile,
  safeFileName,
  storageObjectPath,
  idbPutBlob,
  idbGetBlob,
  idbDeleteBlob,
} from './files'
import { VERIFY_EMAIL, RESET_EMAIL, firebaseUnavailableLine } from './emailCopy'
import { ORG_SCOPED_COLLECTIONS, createOrgLayer } from './orgLayer'

function viteEnv(key) {
  try {
    return import.meta.env?.[key]
  } catch {
    return undefined
  }
}

function adminsFromEnv() {
  const pairs = [
    [viteEnv('VITE_ADMIN_EMAIL'), viteEnv('VITE_ADMIN_PASSWORD')],
    [viteEnv('VITE_ADMIN_EMAIL_2'), viteEnv('VITE_ADMIN_PASSWORD_2')],
  ]
  const out = []
  for (const [emailRaw, passwordRaw] of pairs) {
    const email = String(emailRaw || '').trim().toLowerCase()
    const password = String(passwordRaw || '').trim()
    if (email && password) out.push({ email, password, fullName: 'Administrateur' })
  }
  return out
}

const DEFAULT_ADMINS = adminsFromEnv()
const AUTH_MIN_PASSWORD = firebaseConfigured ? 6 : 4
const LOCAL_FALLBACK_NOTICE = 'Connexion en mode local — synchronisation plus tard.'

// Nazix persistence keys kept for compatibility with existing local data.
const LOCAL_KEY = 'xxdashboard_v1'
const SESSION_KEY = 'xxdashboard_session_token'
const ACTIVE_ORG_KEY = 'nazix_active_org'
const GENERAL_GROUP_ID = 'grp_general'
const SESSION_HOURS = 24
/** Fail-open budget so splash never waits on a hung Firestore/Auth call. */
const FIRESTORE_BOOT_TIMEOUT_MS = 5000
const FIRESTORE_OP_TIMEOUT_MS = 4000
const AUTH_SIGNIN_TIMEOUT_MS = 8000

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

/** idle | ok | timeout | error | skipped | offline */
let firestoreSyncState = 'idle'
let realtimeAttached = false
let activeOrgId = ''
try { activeOrgId = localStorage.getItem(ACTIVE_ORG_KEY) || '' } catch { activeOrgId = '' }
let orgPeek = { orgId: '', loading: false, error: '', rows: {} }
let listenerUserId = ''
let listenerIsAdmin = false
const ORG_SCOPED = new Set(ORG_SCOPED_COLLECTIONS)
const GLOBAL_LISTEN = ['xx_users', 'xx_sessions', 'xx_orgs', 'xx_org_members', 'xx_settings', 'xx_dashboard_prefs', 'xx_game_profiles', 'xx_reset_tokens']

export function getFirestoreSyncState() {
  return firestoreSyncState
}

export function computeSyncStatus() {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'offline'
  if (!firebaseConfigured || !db) return 'local'
  if (firestoreSyncState === 'ok') return 'live'
  return 'local'
}

export function getActiveOrgId() {
  return activeOrgId
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
  'xx_todo_lists',
  'xx_todos',
  'xx_notifications',
  'xx_reset_tokens',
  'xx_groups',
  'xx_messages',
  'xx_files',
  'xx_folders',
  'xx_budgets',
  'xx_budget_lines',
  'xx_risks',
  'xx_risk_actions',
  'xx_links',
  'xx_canvas_layout',
  'xx_ai_threads',
  'xx_settings',
  'xx_dashboard_prefs',
  'xx_game_profiles',
  'xx_game_scores',
  'xx_feedback',
  'xx_orgs',
  'xx_org_members',
]

function emptyDb() {
  return Object.fromEntries(COLLECTIONS.map((c) => [c, {}]))
}

function loadLocal() {
  const base = emptyDb()
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      for (const c of COLLECTIONS) base[c] = parsed[c] || {}
    }
  } catch { /* keep empty */ }
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i) || ''
      const match = key.match(/^nazix:([^:]+):(xx_[a-z0-9_]+)$/)
      if (!match || !ORG_SCOPED.has(match[2])) continue
      const parsed = JSON.parse(localStorage.getItem(key) || '{}')
      if (parsed && typeof parsed === 'object') base[match[2]] = { ...(base[match[2]] || {}), ...parsed }
    }
  } catch { /* namespaced keys are optional */ }
  return base
}

function saveLocal(data) {
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(data)) }
  catch (err) { console.warn('localStorage save failed:', err.message) }
  try {
    const buckets = {}
    for (const col of ORG_SCOPED) {
      for (const row of Object.values(data[col] || {})) {
        if (!row?.id) continue
        const oid = row.orgId || '_unscoped'
        if (!buckets[oid]) buckets[oid] = {}
        if (!buckets[oid][col]) buckets[oid][col] = {}
        buckets[oid][col][row.id] = row
      }
    }
    for (const [oid, cols] of Object.entries(buckets)) {
      for (const [col, map] of Object.entries(cols)) localStorage.setItem(`nazix:${oid}:${col}`, JSON.stringify(map))
    }
  } catch (err) { console.warn('org localStorage save failed:', err.message) }
}

function applyOrgStamp(col, value) {
  if (!value || typeof value !== 'object' || !ORG_SCOPED.has(col)) return value
  if (value.orgId) return value
  if (!activeOrgId) return value
  return { ...value, orgId: activeOrgId }
}

let memory = loadLocal()
const listeners = new Set()

function publicUser(user) {
  if (!user) return user
  const rest = { ...user }
  delete rest.passwordHash
  delete rest.verificationCode
  return rest
}

function notify() {
  for (const fn of listeners) fn(snapshotState())
}

function snapshotState() {
  const clone = structuredClone(memory)
  for (const id of Object.keys(clone.xx_users || {})) {
    clone.xx_users[id] = publicUser(clone.xx_users[id])
  }
  for (const id of Object.keys(clone.xx_sessions || {})) {
    const rest = { ...clone.xx_sessions[id] }
    delete rest.token
    clone.xx_sessions[id] = rest
  }
  clone.xx_reset_tokens = {}
  clone.activeOrgId = activeOrgId
  clone.syncStatus = computeSyncStatus()
  clone.orgPeek = orgPeek
  return clone
}

export function subscribeStore(fn) {
  listeners.add(fn)
  fn(snapshotState())
  return () => listeners.delete(fn)
}

export function getStoreSnapshot() {
  return snapshotState()
}

async function persistDoc(col, id, value, { required = false, remote = true, wait = false } = {}) {
  value = applyOrgStamp(col, value)
  if (!memory[col]) memory[col] = {}
  memory[col][id] = value
  saveLocal(memory)
  notify()
  let remoteError = null
  if (remote && firebaseConfigured && db) {
    const write = withTimeout(
      setDoc(doc(db, col, id), value, { merge: true }),
      FIRESTORE_OP_TIMEOUT_MS,
      `Firestore write ${col}/${id}`,
    ).catch((err) => {
      remoteError = err
      console.warn(`Firestore write ${col}/${id} failed:`, err.message)
      if (required) {
        throw new Error(toUserMessage(err, 'Enregistrement cloud impossible.'))
      }
    })
    if (required || wait) await write
  }
  return { remoteError }
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
  const entityCols = [
    'xx_notes',
    'xx_ideas',
    'xx_projects',
    'xx_events',
    'xx_todo_lists',
    'xx_todos',
    'xx_groups',
    'xx_files',
    'xx_folders',
    'xx_budgets',
    'xx_budget_lines',
    'xx_risks',
    'xx_risk_actions',
    'xx_links',
    'xx_canvas_layout',
    'xx_ai_threads',
    'xx_settings',
    'xx_dashboard_prefs',
    'xx_game_profiles',
  ]
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
      if (next.assigneeId === fromId) {
        next.assigneeId = toId
        changed = true
      }
      if (next.responsibleId === fromId) {
        next.responsibleId = toId
        changed = true
      }
      if (next.createdBy === fromId) {
        next.createdBy = toId
        changed = true
      }
      if (next.userId === fromId) {
        next.userId = toId
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
      if (Array.isArray(next.comments) && next.comments.some((c) => c.userId === fromId)) {
        next.comments = next.comments.map((c) => ({
          ...c,
          userId: remapId(c.userId, fromId, toId),
        }))
        changed = true
      }
      if (changed) {
        if (col === 'xx_files' || col === 'xx_folders') {
          Object.assign(next, withFileAccess(next, col === 'xx_files'))
        } else if (col === 'xx_budgets' || col === 'xx_risks') {
          Object.assign(next, withScopedAccess(next))
        } else if (col === 'xx_budget_lines' || col === 'xx_risk_actions') {
          const parent =
            col === 'xx_budget_lines'
              ? memory.xx_budgets[next.budgetId]
              : memory.xx_risks[next.riskId]
          Object.assign(next, parent ? inheritScopedAccess(parent, next) : shareFields(next, memory.xx_users[toId]))
        } else if (
          col !== 'xx_groups'
          && col !== 'xx_ai_threads'
          && col !== 'xx_settings'
          && col !== 'xx_canvas_layout'
          && col !== 'xx_dashboard_prefs'
          && col !== 'xx_game_profiles'
        ) {
          Object.assign(next, shareFields(next, memory.xx_users[toId]))
        }
        await persistDoc(col, next.id, next)
      }
    }
  }
  for (const row of Object.values(memory.xx_messages || {})) {
    if (row.authorId === fromId) {
      await persistDoc('xx_messages', row.id, { ...row, authorId: toId })
    }
  }
  for (const col of ['xx_sessions', 'xx_notifications', 'xx_reset_tokens', 'xx_ai_threads', 'xx_settings', 'xx_dashboard_prefs', 'xx_game_profiles', 'xx_feedback']) {
    for (const row of Object.values(memory[col] || {})) {
      if (row.userId === fromId) {
        await persistDoc(col, row.id, { ...row, userId: toId, ownerId: row.ownerId === fromId ? toId : row.ownerId })
      }
    }
  }
  for (const row of Object.values(memory.xx_game_scores || {})) {
    if (row.userId === fromId) {
      const next = { ...row, userId: toId, ownerId: row.ownerId === fromId ? toId : row.ownerId }
      memory.xx_game_scores[row.id] = next
    }
  }
  saveLocal(memory)
  notify()
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
  for (const col of ['xx_files', 'xx_folders']) {
    for (const row of Object.values(memory[col] || {})) {
      const owns = row.ownerId === user.id
      const needsShares = Array.isArray(row.shares) && row.shares.length > 0
      if (!owns && !needsShares) continue
      const stamped = withFileAccess(
        { ...row, ...(owns ? { ownerEmail: user.email } : {}) },
        col === 'xx_files',
      )
      const same =
        stamped.ownerEmail === row.ownerEmail &&
        JSON.stringify(stamped.shareUserIds || []) === JSON.stringify(row.shareUserIds || []) &&
        JSON.stringify(stamped.shareManageUserIds || []) === JSON.stringify(row.shareManageUserIds || []) &&
        stamped.inheritedTeam === row.inheritedTeam
      if (!same) {
        await persistDoc(col, row.id, stamped)
      }
    }
  }
  for (const col of ['xx_budgets', 'xx_risks']) {
    for (const row of Object.values(memory[col] || {})) {
      const owns = row.ownerId === user.id
      const needsShares = Array.isArray(row.shares) && row.shares.length > 0
      if (!owns && !needsShares) continue
      const stamped = withScopedAccess({
        ...row,
        ...(owns ? { ownerEmail: user.email } : {}),
      })
      const same =
        stamped.ownerEmail === row.ownerEmail &&
        JSON.stringify(stamped.shareUserIds || []) === JSON.stringify(row.shareUserIds || []) &&
        JSON.stringify(stamped.shareEditUserIds || []) === JSON.stringify(row.shareEditUserIds || [])
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
  const code = String(err?.code || '')
  const raw = String(err?.message || '')
  if (/timed out|deadline|abort/i.test(raw)) {
    return 'La connexion a pris trop de temps. Réessayez.'
  }
  switch (code) {
    case 'auth/email-already-in-use':
      return 'Un compte existe déjà avec cet e-mail.'
    case 'auth/invalid-email':
      return 'Adresse e-mail invalide.'
    case 'auth/weak-password':
      return 'Le mot de passe doit contenir au moins 6 caractères.'
    case 'auth/missing-password':
      return 'Saisissez votre mot de passe.'
    case 'auth/missing-email':
      return 'Saisissez votre e-mail.'
    case 'auth/user-not-found':
      return 'Aucun compte ne correspond à cet e-mail.'
    case 'auth/wrong-password':
      return 'Mot de passe incorrect.'
    case 'auth/invalid-credential':
      return 'E-mail ou mot de passe incorrect.'
    case 'auth/too-many-requests':
      return 'Trop de tentatives. Réessayez dans quelques minutes.'
    case 'auth/network-request-failed':
      return 'Réseau indisponible. Vérifiez votre connexion.'
    case 'auth/operation-not-allowed':
      return 'La connexion e-mail / mot de passe n’est pas activée.'
    case 'auth/invalid-action-code':
    case 'auth/expired-action-code':
      return 'Le code e-mail est invalide ou a expiré. Redemandez un e-mail.'
    case 'auth/user-disabled':
      return 'Ce compte a été désactivé.'
    case 'permission-denied':
      return 'Permission refusée.'
    default:
      if (/auth\/invalid-credential/i.test(raw)) return 'E-mail ou mot de passe incorrect.'
      if (/auth\/user-not-found/i.test(raw)) return 'Aucun compte ne correspond à cet e-mail.'
      if (/auth\/wrong-password/i.test(raw)) return 'Mot de passe incorrect.'
      if (/auth\/too-many-requests/i.test(raw)) return 'Trop de tentatives. Réessayez dans quelques minutes.'
      if (/auth\/network-request-failed/i.test(raw)) return 'Réseau indisponible. Vérifiez votre connexion.'
      if (/auth\/email-already-in-use/i.test(raw)) return 'Un compte existe déjà avec cet e-mail.'
      if (/permission[- ]denied/i.test(raw)) return 'Permission refusée.'
      return 'Connexion impossible. Réessayez.'
  }
}

/** One-line French message. Never dumps a stack trace. */
export function toUserMessage(err, fallback = 'Une erreur est survenue.') {
  if (err == null || err === '') return fallback
  if (typeof err === 'string') {
    const s = err.trim()
    if (!s) return fallback
    const codeMatch = s.match(/auth\/[a-z0-9-]+/i)
    if (codeMatch) return mapAuthError({ code: codeMatch[0], message: s })
    if (/permission[- ]denied/i.test(s)) return 'Permission refusée.'
    if (/unavailable|failed to fetch|network-request-failed/i.test(s) && /firebase|firestore|auth/i.test(s)) {
      return 'Réseau indisponible. Vérifiez votre connexion.'
    }
    if (s.includes('\n') || /\s+at\s+\S+/.test(s)) {
      const first = s.split('\n')[0].replace(/^Error:\s*/i, '').trim()
      if (first && first.length <= 180 && !/\s+at\s+/.test(first)) return first
      return fallback
    }
    if (s.length > 180) return fallback
    return s
  }
  if (typeof err === 'object') {
    const code = String(err.code || '')
    if (code.startsWith('auth/') || code === 'permission-denied') return mapAuthError(err)
    if (err.message) return toUserMessage(String(err.message), fallback)
  }
  return fallback
}

/** Create a Firebase Auth user via REST so the JS SDK is not signed in. */
async function provisionAuthUserWithoutSignIn(email, password) {
  const apiKey = firebaseConfig?.apiKey
  if (!firebaseConfigured || !apiKey || !email || !password) return null
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null
  const timer = setTimeout(() => ctrl?.abort(), 5000)
  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, returnSecureToken: true }),
        signal: ctrl?.signal,
      },
    )
    const data = await res.json().catch(() => ({}))
    if (data?.error) {
      const msg = String(data.error.message || '')
      if (msg === 'EMAIL_EXISTS') return { existed: true }
      console.warn('Auth provision:', msg)
      return null
    }
    if (!data?.localId) return null
    return { created: true, localId: data.localId }
  } catch (err) {
    console.warn('Auth provision:', err.message)
    return null
  } finally {
    clearTimeout(timer)
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

async function upsertLocalAdmin(admin, { skipRemote = false } = {}) {
  const passwordHash = await sha256(admin.password)
  const now = new Date().toISOString()
  let user = Object.values(memory.xx_users || {}).find((d) => d.email === admin.email) || null
  if (!user && !skipRemote) {
    user = await findUserByEmail(admin.email)
  }
  if (!user) {
    const id = uid('user')
    user = {
      id,
      fullName: admin.fullName,
      email: admin.email,
      passwordHash,
      role: ROLES.ADMIN,
      emailVerified: true,
      verificationCode: null,
      firebaseUid: null,
      createdAt: now,
      updatedAt: now,
    }
    await persistDoc('xx_users', id, user, {
      required: false,
      remote: !skipRemote,
    })
    return user
  }
  const patch = {}
  if (user.passwordHash !== passwordHash) patch.passwordHash = passwordHash
  if (!user.emailVerified) patch.emailVerified = true
  if (user.role !== ROLES.ADMIN) patch.role = ROLES.ADMIN
  if (!Object.keys(patch).length) return user
  user = { ...user, ...patch, updatedAt: now }
  await persistDoc('xx_users', user.id, user, {
    required: false,
    remote: !skipRemote,
  })
  return user
}

async function provisionAdminAuth(admin, { skipRemote = false } = {}) {
  if (!firebaseConfigured || !firebaseConfig?.apiKey) return
  try {
    // REST signUp = createUserWithEmailAndPassword without signing the SDK in.
    // EMAIL_EXISTS is OK — the Auth user already exists.
    const provisioned = await provisionAuthUserWithoutSignIn(admin.email, admin.password)
    if (!provisioned?.localId) return
    const user = Object.values(memory.xx_users || {}).find((d) => d.email === admin.email)
    if (!user || user.firebaseUid === provisioned.localId) return
    await persistDoc(
      'xx_users',
      user.id,
      { ...user, firebaseUid: provisioned.localId, updatedAt: new Date().toISOString() },
      { required: false, remote: !skipRemote },
    )
  } catch (err) {
    console.warn('Admin Auth provision:', err.message)
  }
}

async function ensureDefaultAdmin({ skipRemote = false } = {}) {
  // Never sign in during boot: createUser/signIn would silently authenticate
  // every visitor as admin (accounts:signUp 400 + Auth persistence on landing).
  for (const admin of DEFAULT_ADMINS) {
    try {
      await upsertLocalAdmin(admin, { skipRemote })
    } catch (err) {
      console.warn(`Admin seed ${admin.email}:`, err.message)
    }
  }
  if (!skipRemote) {
    for (const admin of DEFAULT_ADMINS) {
      await provisionAdminAuth(admin, { skipRemote })
    }
  }
  if (auth?.currentUser && !localStorage.getItem(SESSION_KEY)) {
    try {
      await signOutAuthSafe()
    } catch (err) {
      console.warn('boot Auth signOut after provision:', err.message)
    }
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

const listenerUnsubs = []

function watchCollection(col, ref) {
  try {
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!memory[col]) memory[col] = {}
        for (const change of snap.docChanges()) {
          const d = change.doc
          if (change.type === 'removed') {
            const current = memory[col][d.id]
            if (ORG_SCOPED.has(col) && activeOrgId && current?.orgId && current.orgId !== activeOrgId) continue
            delete memory[col][d.id]
          } else {
            memory[col][d.id] = { id: d.id, ...d.data() }
          }
        }
        saveLocal(memory)
        firestoreSyncState = 'ok'
        if (col === 'xx_org_members' && listenerUserId) hydrateMemberOrgs(listenerUserId)
        notify()
      },
      (err) => {
        console.warn(`Firestore listener ${col} failed:`, err.message)
        if (firestoreSyncState !== 'ok') firestoreSyncState = 'error'
        notify()
      },
    )
    listenerUnsubs.push(unsub)
  } catch (err) {
    console.warn(`Firestore onSnapshot ${col} failed:`, err.message)
  }
}

async function hydrateMemberOrgs(userId) {
  if (!firebaseConfigured || !db || !userId) return
  const mine = Object.values(memory.xx_org_members || {}).filter((m) => m.userId === userId && m.orgId)
  let changed = false
  for (const member of mine) {
    if (memory.xx_orgs?.[member.orgId]?.name) continue
    try {
      const snap = await getDoc(doc(db, 'xx_orgs', member.orgId))
      if (snap.exists()) {
        if (!memory.xx_orgs) memory.xx_orgs = {}
        memory.xx_orgs[member.orgId] = { id: snap.id, ...snap.data() }
        changed = true
      }
    } catch (err) { console.warn('org hydrate:', err.message) }
  }
  if (changed) { saveLocal(memory); notify() }
}

function rebindOrgListeners() {
  if (!firebaseConfigured || !db) return
  while (listenerUnsubs.length) {
    try { listenerUnsubs.pop()() } catch { /* ignore */ }
  }
  realtimeAttached = true
  const globals = listenerIsAdmin
    ? GLOBAL_LISTEN
    : GLOBAL_LISTEN.filter((col) => !['xx_orgs', 'xx_org_members', 'xx_sessions', 'xx_reset_tokens'].includes(col))
  for (const col of globals) {
    if (COLLECTIONS.includes(col)) watchCollection(col, collection(db, col))
  }
  if (!listenerIsAdmin && listenerUserId) {
    watchCollection('xx_org_members', query(collection(db, 'xx_org_members'), where('userId', '==', listenerUserId)))
    hydrateMemberOrgs(listenerUserId)
  }
  if (listenerIsAdmin) watchCollection('xx_feedback', collection(db, 'xx_feedback'))
  if (!activeOrgId) { notify(); return }
  const privateCols = new Set(['xx_notifications', 'xx_ai_threads', 'xx_canvas_layout'])
  for (const col of ORG_SCOPED) {
    if (privateCols.has(col)) {
      if (!listenerUserId) continue
      watchCollection(col, query(collection(db, col), where('userId', '==', listenerUserId)))
    } else {
      watchCollection(col, query(collection(db, col), where('orgId', '==', activeOrgId)))
    }
  }
}

function attachRealtimeListeners() {
  if (!firebaseConfigured || !db) return
  rebindOrgListeners()
}

function setActiveOrgId(id) {
  const next = id || ''
  if (next === activeOrgId) return
  if (!listenerIsAdmin) {
    for (const col of ORG_SCOPED) {
      for (const [rowId, row] of Object.entries(memory[col] || {})) {
        if (row?.orgId && row.orgId !== next) delete memory[col][rowId]
      }
    }
  }
  activeOrgId = next
  try {
    if (next) localStorage.setItem(ACTIVE_ORG_KEY, next)
    else localStorage.removeItem(ACTIVE_ORG_KEY)
  } catch { /* ignore */ }
  if (firebaseConfigured && db) rebindOrgListeners()
  notify()
}

function setPeek(next) {
  orgPeek = next
  notify()
}

export function bindRealtimeForUser(user) {
  listenerUserId = user?.id || ''
  listenerIsAdmin = Boolean(user && isAdmin(user))
  if (firebaseConfigured && db) rebindOrgListeners()
  else notify()
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
      // Landing must not inherit a leftover Auth session from a previous boot seed.
      if (!localStorage.getItem(SESSION_KEY) && auth?.currentUser) {
        try {
          await withTimeout(signOutAuthSafe(), 2000, 'boot Auth signOut')
        } catch (err) {
          console.warn('boot Auth signOut:', err.message)
        }
      }
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
  let firebaseSent = false
  let firebaseError = null
  if (firebaseConfigured) {
    authUser = await createAuthUser(normalized, password)
    try {
      await sendEmailVerification(authUser)
      firebaseSent = true
    } catch (err) {
      firebaseError = err
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
  await persistDoc('xx_users', id, user)
  try {
    await addUserToGeneralGroup(id)
  } catch (err) {
    console.warn('General group membership:', err.message)
  }

  const notifBody = firebaseSent
    ? VERIFY_EMAIL.summary(normalized) + ` Code : ${verificationCode}.`
    : `${firebaseUnavailableLine()} Code : ${verificationCode}.`
  const notifId = uid('notif')
  await persistDoc('xx_notifications', notifId, {
    id: notifId,
    userId: id,
    type: 'email_verification',
    email: normalized,
    title: VERIFY_EMAIL.subject,
    body: notifBody,
    read: false,
    createdAt: now,
    meta: { verificationCode, firebaseSent: Boolean(firebaseSent) },
  })

  return {
    user: publicUser(user),
    verificationCode,
    firebaseSent,
    firebaseError: firebaseError ? String(firebaseError.message || firebaseError) : null,
    emailCopy: {
      subject: VERIFY_EMAIL.subject,
      body: VERIFY_EMAIL.body(normalized, verificationCode),
    },
  }
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
  const normalized = String(email || '').trim().toLowerCase()
  if (!normalized) throw new Error('Saisissez votre e-mail.')
  if (!normalized.includes('@')) throw new Error('Adresse e-mail invalide.')
  if (!password) throw new Error('Saisissez votre mot de passe.')

  let user = await findUserByEmail(normalized)
  const hash = await sha256(password)
  const defaultAdmin = DEFAULT_ADMINS.find((a) => a.email === normalized)
  let hashOk = Boolean(user && user.passwordHash === hash)
  if (!hashOk && defaultAdmin && password === defaultAdmin.password) {
    hashOk = true
  }

  let authUser = null
  let localAuthFallback = false
  const notices = []

  if (firebaseConfigured && auth) {
    try {
      const cred = await withTimeout(
        signInWithEmailAndPassword(auth, normalized, password),
        AUTH_SIGNIN_TIMEOUT_MS,
        'Firebase Auth',
      )
      authUser = cred?.user || null
    } catch (err) {
      console.warn('Firebase Auth sign-in:', err.message)
      authUser = null
      if (!hashOk) throw new Error(mapAuthError(err))
      localAuthFallback = true
      const code = String(err?.code || '')
      if (code === 'auth/user-not-found' || code === 'auth/invalid-credential') {
        try {
          authUser = await withTimeout(
            ensureAuthUser(normalized, password),
            AUTH_SIGNIN_TIMEOUT_MS,
            'Firebase Auth ensure user',
          )
          if (authUser) localAuthFallback = false
        } catch (ensureErr) {
          console.warn('Firebase Auth ensure user:', ensureErr.message)
        }
      }
    }
    if (!user && authUser) {
      user = await findUserByFirebaseUid(authUser.uid)
    }
  } else if (!hashOk) {
    throw new Error('E-mail ou mot de passe incorrect.')
  } else {
    localAuthFallback = true
  }

  if (!hashOk && !authUser) throw new Error('E-mail ou mot de passe incorrect.')

  // Auth user can exist while xx_users is missing — upsert instead of failing.
  if (!user && (authUser || hashOk)) {
    const createdAt = new Date().toISOString()
    const admin = Boolean(defaultAdmin) || isAdminEmail(normalized)
    user = {
      id: authUser?.uid || uid('user'),
      fullName: authUser?.displayName || defaultAdmin?.fullName || normalized.split('@')[0],
      email: normalized,
      passwordHash: hash,
      role: admin ? ROLES.ADMIN : ROLES.MEMBER,
      emailVerified: admin ? true : Boolean(authUser?.emailVerified),
      verificationCode: null,
      firebaseUid: authUser?.uid || null,
      createdAt,
      updatedAt: createdAt,
    }
    try {
      const written = await persistDoc('xx_users', user.id, user)
      if (written?.remoteError) notices.push('Session cloud indisponible, mode local')
    } catch (err) {
      console.warn('profile upsert:', err.message)
      if (!memory.xx_users) memory.xx_users = {}
      memory.xx_users[user.id] = user
      saveLocal(memory)
      notify()
      notices.push('Session cloud indisponible, mode local')
    }
  }

  if (!user) throw new Error('E-mail ou mot de passe incorrect.')

  if (isAdminEmail(user.email) || defaultAdmin) {
    const patch = {}
    if (user.role !== ROLES.ADMIN) patch.role = ROLES.ADMIN
    if (!user.emailVerified) patch.emailVerified = true
    if (hashOk && user.passwordHash !== hash) patch.passwordHash = hash
    if (Object.keys(patch).length) {
      user = { ...user, ...patch, updatedAt: new Date().toISOString() }
      try {
        await persistDoc('xx_users', user.id, user)
      } catch (err) {
        console.warn('admin restore:', err.message)
      }
    }
  }

  try {
    if (authUser && user.passwordHash !== hash) {
      user = { ...user, passwordHash: hash, updatedAt: new Date().toISOString() }
      await persistDoc('xx_users', user.id, user)
    }
  } catch (err) {
    console.warn('password hash sync:', err.message)
  }

  if (authUser) {
    try {
      user = await withTimeout(
        alignUserWithAuth(user, authUser),
        FIRESTORE_OP_TIMEOUT_MS,
        'Auth uid alignment',
      )
    } catch (err) {
      console.warn('User Auth uid alignment:', err.message)
      if (user.firebaseUid !== authUser.uid) {
        user = { ...user, firebaseUid: authUser.uid, updatedAt: new Date().toISOString() }
        try {
          await persistDoc('xx_users', user.id, user)
        } catch (persistErr) {
          console.warn('firebaseUid persist:', persistErr.message)
        }
      }
    }
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
  try {
    localStorage.setItem(SESSION_KEY, token)
  } catch (err) {
    console.warn('session token localStorage:', err.message)
  }
  if (!memory.xx_sessions) memory.xx_sessions = {}
  memory.xx_sessions[sessionId] = session
  saveLocal(memory)
  notify()
  try {
    const written = await persistDoc('xx_sessions', sessionId, session, { wait: Boolean(authUser) })
    if (written?.remoteError) notices.push('Session cloud indisponible, mode local')
  } catch (err) {
    console.warn('session persist:', err.message)
    notices.push('Session cloud indisponible, mode local')
  }
  try {
    const seen = new Date().toISOString()
    user = { ...user, lastSeenAt: seen, updatedAt: seen }
    await persistDoc('xx_users', user.id, user)
  } catch (err) {
    console.warn('lastSeenAt:', err.message)
  }
  if (authUser) {
    const synced = user
    stampOwnedEntities(synced).catch((err) => console.warn('Ownership stamp:', err.message))
    refreshRemoteAfterAuth().catch((err) => console.warn('post-login sync:', err.message))
  }
  if (localAuthFallback && !authUser) {
    notices.unshift(LOCAL_FALLBACK_NOTICE)
  }
  const uniqueNotices = [...new Set(notices)]
  return {
    user: publicUser(user),
    session,
    warning: uniqueNotices[0] || null,
    localOnly: localAuthFallback && !authUser,
  }
}

export async function logoutCurrentSession() {
  const token = localStorage.getItem(SESSION_KEY)
  localStorage.removeItem(SESSION_KEY)
  try {
    if (token) {
      const session =
        Object.values(memory.xx_sessions || {}).find((s) => s.token === token) ||
        (await queryOne('xx_sessions', 'token', token))
      if (session) {
        await persistDoc('xx_sessions', session.id, {
          ...session,
          active: false,
          revokedAt: new Date().toISOString(),
        })
      }
    }
  } catch (err) {
    console.warn('logout session:', err.message)
  }
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
  const seen = new Date().toISOString()
  user = { ...user, lastSeenAt: seen, updatedAt: seen }
  persistDoc('xx_users', user.id, user).catch((err) => {
    console.warn('Session lastSeenAt:', err.message)
  })
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
  const normalized = String(email || '').trim().toLowerCase()
  if (!normalized) throw new Error('Saisissez votre e-mail.')
  if (!normalized.includes('@')) throw new Error('Adresse e-mail invalide.')

  let firebaseSent = false
  let firebaseError = null
  if (firebaseConfigured && auth) {
    try {
      await withTimeout(
        sendPasswordResetEmail(auth, normalized),
        AUTH_SIGNIN_TIMEOUT_MS,
        'Password reset email',
      )
      firebaseSent = true
    } catch (err) {
      console.warn('sendPasswordResetEmail:', err.message)
      firebaseError = err
      const code = String(err?.code || '')
      if (code === 'auth/too-many-requests' || code === 'auth/network-request-failed') {
        throw new Error(mapAuthError(err))
      }
      if (code && code !== 'auth/user-not-found' && code !== 'auth/invalid-email' && !/timed out/i.test(err.message || '')) {
        throw new Error(mapAuthError(err))
      }
    }
  }

  const user = await findUserByEmail(normalized)
  if (user) {
    const token = randomToken(16)
    const id = uid('reset')
    const expiresAt = new Date(Date.now() + 1 * 3600 * 1000).toISOString()
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
    const notifBody = firebaseSent
      ? RESET_EMAIL.summary(user.email) + ` Code local : ${token}.`
      : `${firebaseUnavailableLine()} ${token}`
    const notifId = uid('notif')
    await persistDoc(
      'xx_notifications',
      notifId,
      {
        id: notifId,
        userId: user.id,
        email: user.email,
        type: 'password_reset',
        title: RESET_EMAIL.subject,
        body: notifBody,
        read: false,
        createdAt: new Date().toISOString(),
        meta: { token, firebaseSent: Boolean(firebaseSent) },
      },
      { required: false },
    )
    return {
      ok: true,
      firebaseSent,
      localCode: token,
      email: user.email,
      emailCopy: {
        subject: RESET_EMAIL.subject,
        body: RESET_EMAIL.body(user.email, token),
      },
      message: firebaseSent
        ? RESET_EMAIL.summary(user.email)
        : `${firebaseUnavailableLine()} ${token}`,
    }
  }

  if (firebaseSent) {
    return { ok: true, firebaseSent, message: 'E-mail de réinitialisation envoyé.' }
  }
  if (firebaseError) {
    const code = String(firebaseError.code || '')
    if (code === 'auth/user-not-found' || code === 'auth/invalid-email') {
      return { ok: true, firebaseSent: false, message: 'Si un compte existe, un e-mail a été envoyé.' }
    }
    throw new Error(mapAuthError(firebaseError))
  }
  if (!firebaseConfigured) {
    throw new Error('Impossible d’envoyer l’e-mail. Vérifiez l’adresse.')
  }
  return { ok: true, firebaseSent: false, message: 'Si un compte existe, un e-mail a été envoyé.' }
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

export function listUsers() {
  return Object.values(memory.xx_users).map(publicUser)
}

export function listSessionsForUser(userId) {
  return Object.values(memory.xx_sessions)
    .filter((s) => s.userId === userId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
}

export function listPresentUserIds() {
  const cutoff = Date.now() - SESSION_HOURS * 3600 * 1000
  const ids = new Set()
  for (const s of Object.values(memory.xx_sessions || {})) {
    if (!s.active) continue
    if (new Date(s.expiresAt).getTime() < Date.now()) continue
    if (new Date(s.createdAt).getTime() >= cutoff) ids.add(s.userId)
  }
  for (const u of Object.values(memory.xx_users || {})) {
    if (u.lastSeenAt && new Date(u.lastSeenAt).getTime() >= cutoff) ids.add(u.id)
  }
  return [...ids]
}

function generalGroupId(orgId = activeOrgId) {
  return orgId ? `grp_${orgId}_general` : GENERAL_GROUP_ID
}
function orgMemberUserIds(orgId = activeOrgId) {
  if (!orgId) return []
  return Object.values(memory.xx_org_members || {}).filter((m) => m.orgId === orgId && m.userId).map((m) => m.userId)
}
async function addUserToGeneralGroup(userId) {
  if (!activeOrgId || !userId) return null
  const group = memory.xx_groups[generalGroupId()]
  if (!group || !userId) return group
  if ((group.memberIds || []).includes(userId)) return group
  const updated = {
    ...group,
    memberIds: [...(group.memberIds || []), userId],
    updatedAt: new Date().toISOString(),
  }
  await persistDoc('xx_groups', group.id, updated)
  return updated
}

export async function ensureGeneralGroup(user) {
  if (!user?.id) throw new Error('Session requise.')
  if (!activeOrgId) throw new Error('Aucune organisation active.')
  const id = generalGroupId()
  const memberIds = [...new Set([...orgMemberUserIds(), user.id])]
  const existing = memory.xx_groups[id]
  const now = new Date().toISOString()
  if (!existing) {
    const group = { id, name: 'Général', memberIds, ownerId: user.id, isGeneral: true, orgId: activeOrgId, createdAt: now, updatedAt: now }
    await persistDoc('xx_groups', id, group)
    return group
  }
  const updated = { ...existing, orgId: activeOrgId, memberIds, isGeneral: true, name: existing.name || 'Général', updatedAt: now }
  await persistDoc('xx_groups', id, updated)
  return updated
}

export function listGroupsForUser(user) {
  return Object.values(memory.xx_groups || {})
    .filter((g) => g.orgId === activeOrgId && canReadGroup(user, g))
    .sort((a, b) => {
      if (a.isGeneral && !b.isGeneral) return -1
      if (!a.isGeneral && b.isGeneral) return 1
      return String(a.name || '').localeCompare(String(b.name || ''), 'fr')
    })
}

export function listMessagesForGroup(groupId, user) {
  const group = memory.xx_groups[groupId]
  if (!canReadGroup(user, group)) return []
  return Object.values(memory.xx_messages || {})
    .filter((m) => m.groupId === groupId)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
}

export async function saveGroup(data, user) {
  if (!user) throw new Error('Permission refusée.')
  if (!canWriteRole(user)) {
    throw new Error('Permission refusée (rôle Lecteur : création interdite).')
  }
  const name = String(data.name || '').trim()
  if (!name) throw new Error('Nom du groupe requis.')
  const now = new Date().toISOString()
  const id = data.id || uid('grp')
  const existing = memory.xx_groups[id]
  if (existing && !isAdmin(user) && existing.ownerId !== user.id) {
    throw new Error('Permission refusée.')
  }
  if (existing?.isGeneral && !isAdmin(user)) {
    throw new Error('Le groupe Général ne peut pas être modifié ainsi.')
  }
  const memberIds = [...new Set([user.id, ...(data.memberIds || existing?.memberIds || [])])]
  const group = {
    ...(existing || {}),
    id,
    name,
    memberIds,
    ownerId: existing?.ownerId || user.id,
    isGeneral: Boolean(existing?.isGeneral),
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  }
  await persistDoc('xx_groups', id, group)
  return group
}

export async function inviteToGroup(groupId, userIds, actor) {
  const group = memory.xx_groups[groupId]
  if (!group) throw new Error('Groupe introuvable.')
  if (!canWriteGroup(actor, group)) throw new Error('Permission refusée.')
  const allowed = new Set(orgMemberUserIds(group.orgId || activeOrgId))
  const incoming = (userIds || []).filter((id) => id && allowed.has(id))
  const memberIds = [...new Set([...(group.memberIds || []), ...incoming])]
  const updated = { ...group, memberIds, updatedAt: new Date().toISOString() }
  await persistDoc('xx_groups', groupId, updated)
  await notifyUsers(
    incoming.filter((id) => id !== actor.id),
    {
      type: 'group_invite',
      title: 'Invitation groupe',
      body: `${actor.fullName} vous a ajouté au groupe « ${group.name} ».`,
      meta: { groupId },
    },
  )
  return updated
}

export async function sendMessage(groupId, body, user) {
  const group = memory.xx_groups[groupId]
  if (!canWriteGroup(user, group)) throw new Error('Permission refusée.')
  const text = String(body || '').trim()
  if (!text) throw new Error('Message vide.')
  if (text.length > 4000) throw new Error('Message trop long.')
  const id = uid('msg')
  const msg = {
    id,
    groupId,
    authorId: user.id,
    authorName: user.fullName || '',
    body: text,
    createdAt: new Date().toISOString(),
    memberIds: group.memberIds || [],
  }
  await persistDoc('xx_messages', id, msg)
  return msg
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
  if (ORG_SCOPED.has(col) && !existing?.orgId && !data.orgId && !activeOrgId) {
    throw new Error('Choisissez ou créez une organisation avant d’enregistrer.')
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
  const existing = data.id ? memory.xx_notes[data.id] : null
  const parentId = data.parentId !== undefined ? data.parentId || null : existing?.parentId || null
  if (parentId) {
    const parent = memory.xx_notes[parentId]
    if (!parent) throw new Error('Note parente introuvable.')
    if (data.id && (parentId === data.id || isNoteAncestor(memory.xx_notes, parentId, data.id))) {
      throw new Error('Lien parent invalide.')
    }
  }
  return upsert('xx_notes', { ...data, parentId }, user)
}
export async function deleteNote(id, user) {
  const existing = memory.xx_notes[id]
  const parentId = existing?.parentId || null
  await destroy('xx_notes', id, user)
  for (const child of Object.values(memory.xx_notes || {})) {
    if (child.parentId === id) {
      await persistDoc('xx_notes', child.id, { ...child, parentId, updatedAt: new Date().toISOString() })
    }
  }
  await removeLinksFor('note', id)
}
export async function saveIdea(data, user) {
  const idea = await upsert('xx_ideas', data, user)
  return idea
}
export async function deleteIdea(id, user) {
  await destroy('xx_ideas', id, user)
  await removeLinksFor('idea', id)
}
export async function saveProject(data, user) {
  const prev = data.id ? memory.xx_projects[data.id] : null
  const saved = await upsert('xx_projects', data, user)
  if (prev && prev.leadId !== saved.leadId) {
    await refreshProjectFilesAccess(saved.id)
    await refreshProjectScopedAccess(saved.id)
  }
  return saved
}
export async function deleteProject(id, user) {
  await destroy('xx_projects', id, user)
  await removeLinksFor('project', id)
}
export async function saveEvent(data, user) {
  return upsert('xx_events', data, user)
}
export async function deleteEvent(id, user) {
  await destroy('xx_events', id, user)
  await removeLinksFor('event', id)
}

const TODO_PRIORITIES = new Set(['low', 'medium', 'high', 'urgent'])
const TODO_STATUSES = new Set(['todo', 'doing', 'done'])

function normalizeTodoTags(value) {
  const list = Array.isArray(value) ? value : String(value || '').split(/[\s,]+/)
  return [...new Set(list.map((tag) => String(tag || '').replace(/^#/, '').trim().toLowerCase()).filter(Boolean))].slice(0, 12)
}

function normalizeTodoSubtasks(value) {
  if (!Array.isArray(value)) return []
  return value
    .map((sub) => ({
      id: String(sub?.id || uid('sub')).slice(0, 48),
      title: String(sub?.title || '').trim().slice(0, 240),
      done: Boolean(sub?.done),
    }))
    .filter((sub) => sub.title)
    .slice(0, 50)
}

export async function saveTodoList(data, user) {
  const name = String(data?.name || '').trim()
  if (!name) throw new Error('Nom de liste requis.')
  if (!memory.xx_todo_lists) memory.xx_todo_lists = {}
  return upsert('xx_todo_lists', {
    ...data,
    name: name.slice(0, 80),
    color: String(data.color || '#3f6b54'),
    archived: Boolean(data.archived),
    visibility: data.visibility || 'Privée',
  }, user)
}

export async function deleteTodoList(id, user) {
  const existing = memory.xx_todo_lists?.[id]
  if (!existing) return
  await destroy('xx_todo_lists', id, user)
  const children = Object.values(memory.xx_todos || {}).filter((task) => task.listId === id)
  for (const task of children) {
    if (!user || canDeleteEntity(user, task)) await removeDoc('xx_todos', task.id)
  }
}

export async function saveTodo(data, user) {
  const title = String(data?.title || '').trim()
  if (!title) throw new Error('Titre requis.')
  if (!memory.xx_todos) memory.xx_todos = {}
  if (!memory.xx_todo_lists) memory.xx_todo_lists = {}
  const existing = data.id ? memory.xx_todos[data.id] : null
  const listId = String(data.listId || existing?.listId || '')
  if (!listId || !memory.xx_todo_lists[listId]) throw new Error('Liste introuvable.')
  const ownerId = existing?.ownerId || user?.id
  const assigneeId = String(data.assigneeId ?? existing?.assigneeId ?? '').trim()
  const prevAssignee = String(existing?.assigneeId || '')
  let shares = Array.isArray(data.shares)
    ? data.shares.map((share) => ({ ...share }))
    : Array.isArray(existing?.shares)
      ? existing.shares.map((share) => ({ ...share }))
      : []
  if (prevAssignee && prevAssignee !== assigneeId) {
    shares = shares.filter((share) => share.userId !== prevAssignee)
  }
  if (assigneeId && assigneeId !== ownerId && !shares.some((share) => share.userId === assigneeId)) {
    const assignee = memory.xx_users?.[assigneeId]
    shares.push({
      userId: assigneeId,
      email: assignee?.email || '',
      permission: 'Édition',
    })
  }
  const status = TODO_STATUSES.has(data.status) ? data.status : existing?.status || 'todo'
  const priority = TODO_PRIORITIES.has(data.priority) ? data.priority : existing?.priority || 'medium'
  const dueRaw = data.dueDate !== undefined ? data.dueDate : existing?.dueDate
  const dueDate = toIsoDate(dueRaw || '')
  let completedAt = null
  if (status === 'done') {
    completedAt = existing?.status === 'done' && existing.completedAt ? existing.completedAt : new Date().toISOString()
  }
  return upsert('xx_todos', {
    id: data.id,
    title: title.slice(0, 200),
    description: String(data.description ?? existing?.description ?? '').slice(0, 8000),
    listId,
    priority,
    status,
    dueDate,
    tags: normalizeTodoTags(data.tags !== undefined ? data.tags : existing?.tags),
    subtasks: normalizeTodoSubtasks(data.subtasks !== undefined ? data.subtasks : existing?.subtasks),
    assigneeId,
    completedAt,
    visibility: 'Privée',
    shares,
  }, user)
}

export async function deleteTodo(id, user) {
  await destroy('xx_todos', id, user)
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
      try {
        if (col === 'xx_game_scores') {
          // Append-only : pas de merge / update d’un score existant.
          await setDoc(doc(db, col, id), value)
        } else {
          await setDoc(doc(db, col, id), value, { merge: true })
        }
      } catch (err) {
        console.warn(`push ${col}/${id}:`, err.message)
      }
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

/* ─── Fichiers / dossiers ─── */

function fileCtx() {
  return { folders: memory.xx_folders || {}, projects: memory.xx_projects || {} }
}

function fileHistory(user, type, label) {
  return { type, userId: user.id, label, at: new Date().toISOString() }
}

function fileShareFields(data) {
  const shares = Array.isArray(data.shares)
    ? data.shares
        .filter((s) => s?.userId && ['Lecture', 'Modification', 'Gestion'].includes(s.permission))
        .map((s) => {
          const email = s.email || lookupUserEmail(s.userId)
          return {
            userId: s.userId,
            permission: s.permission,
            ...(email ? { email: String(email).toLowerCase() } : {}),
          }
        })
    : []
  const shareUserIds = [...new Set(shares.map((s) => s.userId))]
  const shareEmails = [...new Set(shares.map((s) => s.email).filter(Boolean))]
  const editShares = shares.filter((s) => s.permission === 'Modification' || s.permission === 'Gestion')
  const manageShares = shares.filter((s) => s.permission === 'Gestion')
  const ownerEmail = data.ownerEmail || lookupUserEmail(data.ownerId) || null
  return {
    shares,
    shareUserIds,
    shareEmails,
    shareEditUserIds: [...new Set(editShares.map((s) => s.userId))],
    shareEditEmails: [...new Set(editShares.map((s) => s.email).filter(Boolean))],
    shareManageUserIds: [...new Set(manageShares.map((s) => s.userId))],
    shareManageEmails: [...new Set(manageShares.map((s) => s.email).filter(Boolean))],
    ownerEmail: ownerEmail ? String(ownerEmail).toLowerCase() : null,
  }
}

function collectAncestorAccess(startFolderId) {
  const shareUserIds = new Set()
  const shareEmails = new Set()
  const shareEditUserIds = new Set()
  const shareEditEmails = new Set()
  const shareManageUserIds = new Set()
  const shareManageEmails = new Set()
  let team = false
  let cur = startFolderId ? memory.xx_folders[startFolderId] : null
  const seen = new Set()
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id)
    if (cur.visibility === 'Équipe' || cur.visibility === 'Publique') team = true
    if (cur.ownerId) shareUserIds.add(cur.ownerId)
    const ownerEmail = cur.ownerEmail || lookupUserEmail(cur.ownerId)
    if (ownerEmail) shareEmails.add(String(ownerEmail).toLowerCase())
    for (const s of cur.shares || []) {
      if (!s?.userId) continue
      shareUserIds.add(s.userId)
      const email = s.email || lookupUserEmail(s.userId)
      if (email) shareEmails.add(String(email).toLowerCase())
      if (s.permission === 'Modification' || s.permission === 'Gestion') {
        shareEditUserIds.add(s.userId)
        if (email) shareEditEmails.add(String(email).toLowerCase())
      }
      if (s.permission === 'Gestion') {
        shareManageUserIds.add(s.userId)
        if (email) shareManageEmails.add(String(email).toLowerCase())
      }
    }
    cur = cur.parentId ? memory.xx_folders[cur.parentId] : null
  }
  return {
    shareUserIds,
    shareEmails,
    shareEditUserIds,
    shareEditEmails,
    shareManageUserIds,
    shareManageEmails,
    team,
  }
}

function withFileAccess(row, isFile) {
  const own = fileShareFields(row)
  const inherited = collectAncestorAccess(isFile ? row.folderId : row.parentId)
  const project = row.projectId ? memory.xx_projects[row.projectId] : null
  const shareUserIds = new Set([...(own.shareUserIds || []), ...inherited.shareUserIds])
  const shareEmails = new Set([...(own.shareEmails || []), ...inherited.shareEmails])
  const shareEditUserIds = new Set([...(own.shareEditUserIds || []), ...inherited.shareEditUserIds])
  const shareEditEmails = new Set([...(own.shareEditEmails || []), ...inherited.shareEditEmails])
  const shareManageUserIds = new Set([...(own.shareManageUserIds || []), ...inherited.shareManageUserIds])
  const shareManageEmails = new Set([...(own.shareManageEmails || []), ...inherited.shareManageEmails])
  if (project?.leadId) {
    shareUserIds.add(project.leadId)
    shareEditUserIds.add(project.leadId)
    shareManageUserIds.add(project.leadId)
    const leadEmail = lookupUserEmail(project.leadId)
    if (leadEmail) {
      const e = String(leadEmail).toLowerCase()
      shareEmails.add(e)
      shareEditEmails.add(e)
      shareManageEmails.add(e)
    }
  }
  return {
    ...row,
    ...own,
    shareUserIds: [...shareUserIds],
    shareEmails: [...shareEmails],
    shareEditUserIds: [...shareEditUserIds],
    shareEditEmails: [...shareEditEmails],
    shareManageUserIds: [...shareManageUserIds],
    shareManageEmails: [...shareManageEmails],
    inheritedTeam: Boolean(inherited.team),
  }
}

function descendantFolderIds(rootId) {
  const ids = new Set([rootId])
  let added = true
  while (added) {
    added = false
    for (const folder of Object.values(memory.xx_folders || {})) {
      if (folder.parentId && ids.has(folder.parentId) && !ids.has(folder.id)) {
        ids.add(folder.id)
        added = true
      }
    }
  }
  return ids
}

function isFolderInside(maybeChildId, folderId) {
  if (!folderId || !maybeChildId) return false
  let cur = memory.xx_folders[maybeChildId]
  const seen = new Set()
  while (cur && !seen.has(cur.id)) {
    if (cur.id === folderId) return true
    seen.add(cur.id)
    cur = cur.parentId ? memory.xx_folders[cur.parentId] : null
  }
  return false
}

async function propagateFolderAccess(rootId) {
  const ids = descendantFolderIds(rootId)
  for (const id of ids) {
    const folder = memory.xx_folders[id]
    if (folder) await persistDoc('xx_folders', id, withFileAccess(folder, false))
  }
  for (const file of Object.values(memory.xx_files || {})) {
    if (file.folderId && ids.has(file.folderId)) {
      await persistDoc('xx_files', file.id, withFileAccess(file, true))
    }
  }
}

async function refreshProjectFilesAccess(projectId) {
  if (!projectId) return
  for (const folder of Object.values(memory.xx_folders || {})) {
    if (folder.projectId === projectId) {
      await persistDoc('xx_folders', folder.id, withFileAccess(folder, false))
    }
  }
  for (const file of Object.values(memory.xx_files || {})) {
    if (file.projectId === projectId) {
      await persistDoc('xx_files', file.id, withFileAccess(file, true))
    }
  }
}

function deriveVisibility(shares, teamWide) {
  if (teamWide) return 'Équipe'
  if ((shares || []).length) return 'Partagée'
  return 'Privée'
}

export function isRemoteFileStorage() {
  return Boolean(storage)
}

export function folderDeleteSummary(folderId) {
  const ids = descendantFolderIds(folderId)
  const folders = [...ids].map((id) => memory.xx_folders[id]).filter(Boolean)
  const files = Object.values(memory.xx_files || {}).filter((f) => f.folderId && ids.has(f.folderId))
  return { folderCount: Math.max(0, folders.length - 1), fileCount: files.length, files, folders }
}

export async function saveFolder(data, user) {
  if (!user) throw new Error('Permission refusée.')
  const now = new Date().toISOString()
  const id = data.id || uid('fold')
  const existing = memory.xx_folders[id]
  const parentId =
    data.parentId === undefined ? existing?.parentId ?? null : data.parentId || null
  if (parentId === id) throw new Error('Un dossier ne peut pas se contenir lui-même.')
  if (parentId && isFolderInside(parentId, id)) throw new Error('Déplacement invalide.')
  const parent = parentId ? memory.xx_folders[parentId] : null
  if (parentId && !parent) throw new Error('Dossier parent introuvable.')

  if (!existing) {
    if (!canAddInFolder(user, parent, fileCtx())) {
      throw new Error('Permission refusée.')
    }
  } else {
    if (!canReadFileOrFolder(user, existing, fileCtx())) throw new Error('Accès refusé.')
    const nextShares = data.shares !== undefined ? data.shares : existing.shares
    const nextTeam =
      data.teamWide !== undefined ? Boolean(data.teamWide) : existing.visibility === 'Équipe'
    const shareChanged =
      JSON.stringify(nextShares || []) !== JSON.stringify(existing.shares || []) ||
      (nextTeam ? 'Équipe' : deriveVisibility(nextShares, false)) !== existing.visibility
    if (shareChanged && !canManageFileOrFolder(user, existing, fileCtx())) {
      throw new Error('Permission refusée.')
    }
    if (!canModifyFileOrFolder(user, existing, fileCtx())) {
      throw new Error('Permission refusée.')
    }
  }

  const name = String(data.name || '').trim()
  if (!name) throw new Error('Nom du dossier requis.')
  const shares = data.shares !== undefined ? data.shares : existing?.shares || []
  const teamWide = data.teamWide !== undefined ? Boolean(data.teamWide) : existing?.visibility === 'Équipe'
  const visibility = deriveVisibility(shares, teamWide)
  const projectId =
    data.projectId !== undefined ? data.projectId || null : existing?.projectId || parent?.projectId || null

  const history = [...(existing?.history || [])]
  if (!existing) history.push(fileHistory(user, 'create', 'Dossier créé'))
  else {
    if (existing.name !== name) history.push(fileHistory(user, 'rename', `Renommé en « ${name} »`))
    if ((existing.parentId || null) !== parentId) history.push(fileHistory(user, 'move', 'Dossier déplacé'))
    if (
      JSON.stringify(existing.shares || []) !== JSON.stringify(shares || []) ||
      existing.visibility !== visibility
    ) {
      history.push(fileHistory(user, 'share', 'Partage mis à jour'))
    }
  }

  const row = withFileAccess(
    {
      ...(existing || {}),
      id,
      name,
      parentId,
      ownerId: existing?.ownerId || user.id,
      ownerEmail: existing?.ownerEmail || user.email,
      projectId,
      shares,
      visibility,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      history,
    },
    false,
  )
  await persistDoc('xx_folders', id, row)
  await propagateFolderAccess(id)

  const prevIds = new Set((existing?.shares || []).map((s) => s.userId))
  const notifyIds = (shares || [])
    .map((s) => s.userId)
    .filter((shareId) => shareId && shareId !== user.id && !prevIds.has(shareId))
  if (notifyIds.length) {
    await notifyUsers(notifyIds, {
      type: 'folder_share',
      title: 'Dossier partagé',
      body: `${user.fullName} a partagé un dossier avec vous.`,
      meta: { folderId: id },
    })
  }
  return row
}

export async function deleteFolder(id, user) {
  const existing = memory.xx_folders[id]
  if (!existing || !canReadFileOrFolder(user, existing, fileCtx())) {
    throw new Error('Accès refusé.')
  }
  if (!canDeleteFileOrFolder(user, existing, fileCtx())) {
    throw new Error('Permission refusée.')
  }
  const summary = folderDeleteSummary(id)
  for (const file of summary.files) {
    await deleteFile(file.id, user)
  }
  const nested = summary.folders.filter((f) => f.id !== id)
  nested.sort((a, b) => {
    const da = descendantFolderIds(a.id).size
    const db = descendantFolderIds(b.id).size
    return da - db
  })
  for (const folder of nested) {
    await removeDoc('xx_folders', folder.id)
  }
  await removeDoc('xx_folders', id)
}

export function startFileUpload(payload, user, { onProgress } = {}) {
  if (!user) throw new Error('Permission refusée.')
  if (!canWriteRole(user)) {
    throw new Error('Permission refusée (rôle Lecteur : ajout interdit).')
  }
  const nativeFile = payload.file
  const meta = validateUploadFile(nativeFile)
  const folderId = payload.folderId || null
  const folder = folderId ? memory.xx_folders[folderId] : null
  if (folderId && !folder) throw new Error('Dossier introuvable.')
  if (!canAddInFolder(user, folder, fileCtx())) throw new Error('Permission refusée.')

  const id = uid('file')
  let cancelled = false
  let storageTask = null
  let unsub = () => {}

  const done = (async () => {
    let storagePath = null
    let localId = null
    try {
      if (storage) {
        const path = storageObjectPath(user.id, id, nativeFile.name)
        const storageRef = ref(storage, path)
        storageTask = uploadBytesResumable(storageRef, nativeFile, {
          contentType: meta.mime,
          customMetadata: { ownerId: user.id, fileId: id },
        })
        const completeMs = Math.min(180000, Math.max(8000, Math.ceil(meta.size / 2000) + 8000))
        await withTimeout(
          new Promise((resolve, reject) => {
            unsub = storageTask.on(
              'state_changed',
              (snap) => {
                const pct = snap.totalBytes
                  ? Math.round((snap.bytesTransferred / snap.totalBytes) * 90)
                  : 0
                onProgress?.(pct)
              },
              reject,
              resolve,
            )
          }),
          completeMs,
          'Firebase Storage upload',
        )
        unsub()
        storagePath = path
        onProgress?.(92)
      } else {
        onProgress?.(35)
        await idbPutBlob(id, nativeFile)
        localId = id
        onProgress?.(90)
      }
    } catch (err) {
      try {
        unsub()
      } catch {
        /* ignore */
      }
      if (storageTask) {
        try {
          storageTask.cancel()
        } catch {
          /* ignore */
        }
      }
      if (cancelled || err?.code === 'storage/canceled') {
        throw new Error('Téléversement annulé.')
      }
      console.warn('Firebase Storage indisponible, repli IndexedDB:', err?.message || err)
      await idbPutBlob(id, nativeFile)
      localId = id
      onProgress?.(90)
    }

    if (cancelled) {
      if (storagePath && storage) {
        try {
          await deleteObject(ref(storage, storagePath))
        } catch {
          /* ignore */
        }
      }
      if (localId) await idbDeleteBlob(localId)
      throw new Error('Téléversement annulé.')
    }

    const now = new Date().toISOString()
    const shares = Array.isArray(payload.shares) ? payload.shares : []
    const teamWide = Boolean(payload.teamWide)
    const visibility = deriveVisibility(shares, teamWide)
    const projectId = payload.projectId || folder?.projectId || null
    const row = withFileAccess(
      {
        id,
        name: safeFileName(nativeFile.name),
        mime: meta.mime,
        ext: meta.ext,
        size: meta.size,
        folderId,
        ownerId: user.id,
        ownerEmail: user.email,
        projectId,
        description: String(payload.description || '').trim(),
        storagePath,
        localId,
        shares,
        visibility,
        createdAt: now,
        updatedAt: now,
        uploadedBy: user.id,
        history: [fileHistory(user, 'create', 'Fichier importé')],
      },
      true,
    )
    await persistDoc('xx_files', id, row)
    onProgress?.(100)
    const notifyIds = (row.shares || []).map((s) => s.userId).filter((shareId) => shareId !== user.id)
    if (notifyIds.length) {
      await notifyUsers(notifyIds, {
        type: 'file_add',
        title: 'Fichier partagé',
        body: `${user.fullName} a ajouté un fichier pour vous.`,
        meta: { fileId: id },
      })
    }
    return row
  })()

  return {
    fileId: id,
    done,
    cancel() {
      cancelled = true
      try {
        unsub()
      } catch {
        /* ignore */
      }
      if (storageTask) {
        try {
          storageTask.cancel()
        } catch {
          /* ignore */
        }
      }
    },
  }
}

export async function saveFileMeta(data, user) {
  if (!user || !data?.id) throw new Error('Permission refusée.')
  const existing = memory.xx_files[data.id]
  if (!existing || !canReadFileOrFolder(user, existing, fileCtx())) {
    throw new Error('Accès refusé.')
  }
  const changingShares = data.shares !== undefined || data.teamWide !== undefined
  const changingMeta =
    data.name !== undefined ||
    data.folderId !== undefined ||
    data.description !== undefined ||
    data.projectId !== undefined
  if (changingShares && !canManageFileOrFolder(user, existing, fileCtx())) {
    throw new Error('Permission refusée.')
  }
  if (changingMeta && !canModifyFileOrFolder(user, existing, fileCtx())) {
    throw new Error('Permission refusée.')
  }

  const folderId = data.folderId !== undefined ? data.folderId || null : existing.folderId
  if (folderId) {
    const dest = memory.xx_folders[folderId]
    if (!dest) throw new Error('Dossier introuvable.')
    if (folderId !== existing.folderId && !canAddInFolder(user, dest, fileCtx())) {
      throw new Error('Permission refusée.')
    }
  }

  const shares = data.shares !== undefined ? data.shares : existing.shares
  const teamWide = data.teamWide !== undefined ? Boolean(data.teamWide) : existing.visibility === 'Équipe'
  const visibility = deriveVisibility(shares, teamWide)
  const name = data.name !== undefined ? safeFileName(String(data.name || '').trim() || existing.name) : existing.name
  const description =
    data.description !== undefined ? String(data.description || '').trim() : existing.description
  const projectId = data.projectId !== undefined ? data.projectId || null : existing.projectId
  const history = [...(existing.history || [])]
  if (name !== existing.name) history.push(fileHistory(user, 'rename', `Renommé en « ${name} »`))
  if (folderId !== existing.folderId) history.push(fileHistory(user, 'move', 'Fichier déplacé'))
  if (description !== existing.description) {
    history.push(fileHistory(user, 'description', 'Description mise à jour'))
  }
  if (
    JSON.stringify(shares || []) !== JSON.stringify(existing.shares || []) ||
    visibility !== existing.visibility
  ) {
    history.push(fileHistory(user, 'share', 'Partage mis à jour'))
  }

  const row = withFileAccess(
    {
      ...existing,
      name,
      folderId,
      description,
      projectId,
      shares,
      visibility,
      history,
      updatedAt: new Date().toISOString(),
    },
    true,
  )
  await persistDoc('xx_files', data.id, row)
  const prevShare = new Set((existing.shares || []).map((s) => s.userId))
  const newIds = (shares || [])
    .map((s) => s.userId)
    .filter((shareId) => shareId && shareId !== user.id && !prevShare.has(shareId))
  if (newIds.length) {
    await notifyUsers(newIds, {
      type: 'file_share',
      title: 'Fichier partagé',
      body: `${user.fullName} a partagé un fichier avec vous.`,
      meta: { fileId: row.id },
    })
  }
  return row
}

export async function deleteFile(id, user) {
  const existing = memory.xx_files[id]
  if (!existing || !canReadFileOrFolder(user, existing, fileCtx())) {
    throw new Error('Accès refusé.')
  }
  if (!canDeleteFileOrFolder(user, existing, fileCtx())) {
    throw new Error('Permission refusée.')
  }
  if (existing.storagePath && storage) {
    try {
      await deleteObject(ref(storage, existing.storagePath))
    } catch (err) {
      console.warn('Storage delete:', err.message)
    }
  }
  if (existing.localId) {
    try {
      await idbDeleteBlob(existing.localId)
    } catch (err) {
      console.warn('IndexedDB delete:', err.message)
    }
  }
  await removeDoc('xx_files', id)
  await removeLinksFor('file', id)
}

export async function getFileBlob(fileId, user) {
  const file = memory.xx_files[fileId]
  if (!file || !canReadFileOrFolder(user, file, fileCtx())) {
    throw new Error('Accès refusé.')
  }
  if (file.storagePath && storage) {
    try {
      return await getBlob(ref(storage, file.storagePath))
    } catch (err) {
      console.warn('getBlob:', err.message)
      if (file.localId) {
        const local = await idbGetBlob(file.localId)
        if (local) return local
      }
      throw new Error('Accès refusé.')
    }
  }
  if (file.localId) {
    const local = await idbGetBlob(file.localId)
    if (local) return local
  }
  throw new Error('Fichier indisponible.')
}

/* ─── Budgets / risques ─── */

function scopedProjects() {
  return memory.xx_projects || {}
}

function scopedHistory(user, type, label) {
  return { type, userId: user.id, label, at: new Date().toISOString() }
}

function withScopedAccess(row) {
  const fields = shareFields(row, memory.xx_users[row.ownerId])
  const project = row.projectId ? memory.xx_projects[row.projectId] : null
  const shareUserIds = new Set(fields.shareUserIds || [])
  const shareEditUserIds = new Set(fields.shareEditUserIds || [])
  const shareEmails = new Set(fields.shareEmails || [])
  const shareEditEmails = new Set(fields.shareEditEmails || [])
  if (project?.leadId) {
    shareUserIds.add(project.leadId)
    shareEditUserIds.add(project.leadId)
    const leadEmail = lookupUserEmail(project.leadId)
    if (leadEmail) {
      const e = String(leadEmail).toLowerCase()
      shareEmails.add(e)
      shareEditEmails.add(e)
    }
  }
  return {
    ...row,
    ...fields,
    shareUserIds: [...shareUserIds],
    shareEmails: [...shareEmails],
    shareEditUserIds: [...shareEditUserIds],
    shareEditEmails: [...shareEditEmails],
  }
}

function inheritScopedAccess(parent, row) {
  return {
    ...row,
    ownerId: parent.ownerId,
    ownerEmail: parent.ownerEmail,
    visibility: parent.visibility,
    shares: parent.shares || [],
    shareUserIds: parent.shareUserIds || [],
    shareEmails: parent.shareEmails || [],
    shareEditUserIds: parent.shareEditUserIds || [],
    shareEditEmails: parent.shareEditEmails || [],
  }
}

async function syncScopedChildren(parent, childCol, parentKey) {
  for (const row of Object.values(memory[childCol] || {})) {
    if (row[parentKey] !== parent.id) continue
    await persistDoc(childCol, row.id, inheritScopedAccess(parent, row))
  }
}

async function refreshProjectScopedAccess(projectId) {
  if (!projectId) return
  for (const budget of Object.values(memory.xx_budgets || {})) {
    if (budget.projectId !== projectId) continue
    const next = withScopedAccess(budget)
    await persistDoc('xx_budgets', next.id, next)
    await syncScopedChildren(next, 'xx_budget_lines', 'budgetId')
  }
  for (const risk of Object.values(memory.xx_risks || {})) {
    if (risk.projectId !== projectId) continue
    const next = withScopedAccess(risk)
    await persistDoc('xx_risks', next.id, next)
    await syncScopedChildren(next, 'xx_risk_actions', 'riskId')
  }
}

function requireBudgetRiskManage(user, entity) {
  if (!canManageBudgetRisk(user, entity, scopedProjects())) {
    throw new Error('Permission refusée.')
  }
}

function requireBudgetRiskDelete(user, entity) {
  if (!canDeleteBudgetRisk(user, entity, scopedProjects())) {
    throw new Error('Permission refusée.')
  }
}

function parseAmount(value) {
  const amount = Number(value)
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error('Montant invalide.')
  }
  return amount
}

async function notifyNewShares(prev, next, user, payload) {
  const prevIds = new Set((prev?.shares || []).map((s) => s.userId))
  const ids = (next.shares || [])
    .map((s) => s.userId)
    .filter((id) => id && id !== user.id && !prevIds.has(id))
  if (ids.length) await notifyUsers(ids, payload)
}

export async function saveBudget(data, user) {
  if (!user) throw new Error('Permission refusée.')
  const now = new Date().toISOString()
  const id = data.id || uid('bdg')
  const existing = memory.xx_budgets[id]
  if (!existing) {
    if (!canWriteRole(user)) {
      throw new Error('Permission refusée (rôle Lecteur : création interdite).')
    }
  } else {
    requireBudgetRiskManage(user, existing)
  }
  const name = String(data.name || '').trim()
  if (!name) throw new Error('Nom du budget requis.')
  const projectId = data.projectId || existing?.projectId || null
  if (!projectId) throw new Error('Projet requis.')
  const currency = data.currency || existing?.currency || 'EUR'
  if (!BUDGET_CURRENCIES.includes(currency)) throw new Error('Devise invalide (EUR ou USD).')
  const plannedTotal = parseAmount(data.plannedTotal ?? existing?.plannedTotal ?? 0)
  const visibility = data.visibility || existing?.visibility || 'Privée'
  const shares = visibility === 'Privée' ? [] : data.shares !== undefined ? data.shares : existing?.shares || []
  const merged = {
    ...(existing || {}),
    id,
    projectId,
    name,
    currency,
    periodStart: data.periodStart ?? existing?.periodStart ?? '',
    periodEnd: data.periodEnd ?? existing?.periodEnd ?? '',
    launchDate: data.launchDate ?? existing?.launchDate ?? '',
    plannedTotal,
    ownerId: existing?.ownerId || user.id,
    shares,
    visibility,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    history: [
      ...(existing?.history || []),
      scopedHistory(user, existing ? 'update' : 'create', existing ? 'Budget modifié' : 'Budget créé'),
    ],
  }
  const docData = withScopedAccess(merged)
  await persistDoc('xx_budgets', id, docData)
  if (existing) await syncScopedChildren(docData, 'xx_budget_lines', 'budgetId')
  await notifyNewShares(existing, docData, user, {
    type: 'budget_share',
    title: 'Budget partagé',
    body: `${user.fullName} a partagé le budget « ${docData.name} » avec vous.`,
    meta: { budgetId: id },
  })
  return docData
}

export async function deleteBudget(id, user) {
  const existing = memory.xx_budgets[id]
  if (!existing) throw new Error('Budget introuvable.')
  requireBudgetRiskDelete(user, existing)
  for (const line of Object.values(memory.xx_budget_lines || {})) {
    if (line.budgetId === id) {
      await removeDoc('xx_budget_lines', line.id)
      await removeLinksFor('budget_line', line.id)
    }
  }
  await removeDoc('xx_budgets', id)
}

export async function saveBudgetLine(data, user) {
  if (!user) throw new Error('Permission refusée.')
  const budget = memory.xx_budgets[data.budgetId]
  if (!budget) throw new Error('Budget introuvable.')
  requireBudgetRiskManage(user, budget)
  const now = new Date().toISOString()
  const id = data.id || uid('bln')
  const existing = memory.xx_budget_lines[id]
  if (existing && existing.budgetId !== budget.id) throw new Error('Ligne invalide.')
  const kind = data.kind || existing?.kind || 'planned'
  if (!BUDGET_LINE_KINDS.includes(kind)) throw new Error('Type de ligne invalide.')
  const category = data.category || existing?.category || BUDGET_CATEGORIES[0]
  if (!BUDGET_CATEGORIES.includes(category)) throw new Error('Catégorie invalide.')
  const name = String(data.name || data.label || existing?.name || '').trim()
  if (!name) throw new Error('Libellé requis.')
  const amount = parseAmount(data.amount ?? existing?.amount ?? 0)
  const flow = data.flow || existing?.flow || 'expense'
  if (flow !== 'income' && flow !== 'expense') throw new Error('Type de ligne invalide.')
  let status = existing?.status || ''
  if (kind === 'actual') {
    status = data.status || existing?.status || 'planned'
    if (!BUDGET_ACTUAL_STATUSES.includes(status)) throw new Error('Statut invalide.')
  }
  const line = inheritScopedAccess(budget, {
    ...(existing || {}),
    id,
    budgetId: budget.id,
    kind,
    category,
    name,
    amount,
    flow,
    date: data.date ?? existing?.date ?? '',
    duePeriod: kind === 'salary' ? data.duePeriod ?? existing?.duePeriod ?? '' : '',
    roleTitle: kind === 'salary' ? String(data.roleTitle ?? existing?.roleTitle ?? '').trim() : '',
    status: kind === 'actual' ? status : '',
    responsibleId: data.responsibleId ?? existing?.responsibleId ?? '',
    notes: data.notes ?? existing?.notes ?? '',
    receiptNote: kind === 'actual' ? data.receiptNote ?? existing?.receiptNote ?? '' : '',
    comments: existing?.comments || [],
    createdBy: existing?.createdBy || user.id,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  })
  await persistDoc('xx_budget_lines', id, line)
  return line
}

export async function deleteBudgetLine(id, user) {
  const existing = memory.xx_budget_lines[id]
  if (!existing) throw new Error('Ligne introuvable.')
  const budget = memory.xx_budgets[existing.budgetId]
  if (!budget) throw new Error('Budget introuvable.')
  requireBudgetRiskManage(user, budget)
  await removeDoc('xx_budget_lines', id)
  await removeLinksFor('budget_line', id)
}

export async function addBudgetLineComment(lineId, body, user) {
  const line = memory.xx_budget_lines[lineId]
  if (!line) throw new Error('Ligne introuvable.')
  const budget = memory.xx_budgets[line.budgetId]
  if (!budget) throw new Error('Budget introuvable.')
  requireBudgetRiskManage(user, budget)
  const text = String(body || '').trim()
  if (!text) throw new Error('Commentaire vide.')
  const comments = [...(line.comments || []), { userId: user.id, body: text, at: new Date().toISOString() }]
  const updated = inheritScopedAccess(budget, {
    ...line,
    comments,
    updatedAt: new Date().toISOString(),
  })
  await persistDoc('xx_budget_lines', lineId, updated)
  return updated
}

export async function saveRisk(data, user) {
  if (!user) throw new Error('Permission refusée.')
  const now = new Date().toISOString()
  const id = data.id || uid('rsk')
  const existing = memory.xx_risks[id]
  if (!existing) {
    if (!canWriteRole(user)) {
      throw new Error('Permission refusée (rôle Lecteur : création interdite).')
    }
  } else {
    requireBudgetRiskManage(user, existing)
  }
  const title = String(data.title || '').trim()
  if (!title) throw new Error('Titre du risque requis.')
  const projectId = data.projectId || existing?.projectId || null
  if (!projectId) throw new Error('Projet requis.')
  const category = data.category || existing?.category || 'autre'
  if (!RISK_CATEGORIES.includes(category)) throw new Error('Catégorie invalide.')
  const probability = data.probability || existing?.probability || 'faible'
  const impact = data.impact || existing?.impact || 'faible'
  if (!RISK_PROBABILITIES.includes(probability)) throw new Error('Probabilité invalide.')
  if (!RISK_IMPACTS.includes(impact)) throw new Error('Impact invalide.')
  const status = data.status || existing?.status || 'nouveau'
  if (!RISK_STATUSES.includes(status)) throw new Error('Statut invalide.')
  const visibility = data.visibility || existing?.visibility || 'Privée'
  const shares = visibility === 'Privée' ? [] : data.shares !== undefined ? data.shares : existing?.shares || []
  const merged = {
    ...(existing || {}),
    id,
    projectId,
    title,
    description: data.description ?? existing?.description ?? '',
    category,
    probability,
    impact,
    priority: computeRiskPriority(probability, impact),
    ownerId: existing?.ownerId || user.id,
    assigneeId: data.assigneeId ?? existing?.assigneeId ?? '',
    detectedAt: data.detectedAt ?? existing?.detectedAt ?? now.slice(0, 10),
    dueDate: data.dueDate ?? existing?.dueDate ?? '',
    status,
    shares,
    visibility,
    comments: existing?.comments || [],
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    history: [
      ...(existing?.history || []),
      scopedHistory(user, existing ? 'update' : 'create', existing ? 'Risque modifié' : 'Risque créé'),
    ],
  }
  const docData = withScopedAccess(merged)
  await persistDoc('xx_risks', id, docData)
  if (existing) await syncScopedChildren(docData, 'xx_risk_actions', 'riskId')
  await notifyNewShares(existing, docData, user, {
    type: 'risk_share',
    title: 'Risque partagé',
    body: `${user.fullName} a partagé le risque « ${docData.title} » avec vous.`,
    meta: { riskId: id },
  })
  return docData
}

export async function deleteRisk(id, user) {
  const existing = memory.xx_risks[id]
  if (!existing) throw new Error('Risque introuvable.')
  requireBudgetRiskDelete(user, existing)
  for (const action of Object.values(memory.xx_risk_actions || {})) {
    if (action.riskId === id) await removeDoc('xx_risk_actions', action.id)
  }
  await removeDoc('xx_risks', id)
  await removeLinksFor('risk', id)
}

export async function addRiskComment(riskId, body, user) {
  const risk = memory.xx_risks[riskId]
  if (!risk) throw new Error('Risque introuvable.')
  requireBudgetRiskManage(user, risk)
  const text = String(body || '').trim()
  if (!text) throw new Error('Commentaire vide.')
  const comments = [...(risk.comments || []), { userId: user.id, body: text, at: new Date().toISOString() }]
  const updated = withScopedAccess({
    ...risk,
    comments,
    updatedAt: new Date().toISOString(),
  })
  await persistDoc('xx_risks', riskId, updated)
  return updated
}

function actionIsOverdue(action) {
  if (!action?.dueDate || action.status === 'terminée') return false
  const due = new Date(`${String(action.dueDate).slice(0, 10)}T23:59:59`)
  if (Number.isNaN(due.getTime())) return false
  return due < new Date()
}

export async function saveRiskAction(data, user) {
  if (!user) throw new Error('Permission refusée.')
  const risk = memory.xx_risks[data.riskId]
  if (!risk) throw new Error('Risque introuvable.')
  requireBudgetRiskManage(user, risk)
  const now = new Date().toISOString()
  const id = data.id || uid('ract')
  const existing = memory.xx_risk_actions[id]
  if (existing && existing.riskId !== risk.id) throw new Error('Action invalide.')
  const title = String(data.title || existing?.title || '').trim()
  if (!title) throw new Error('Titre de l’action requis.')
  const status = data.status || existing?.status || 'à faire'
  if (!RISK_ACTION_STATUSES.includes(status)) throw new Error('Statut invalide.')
  const action = inheritScopedAccess(risk, {
    ...(existing || {}),
    id,
    riskId: risk.id,
    title,
    assigneeId: data.assigneeId ?? existing?.assigneeId ?? '',
    dueDate: data.dueDate ?? existing?.dueDate ?? '',
    status,
    comments: existing?.comments || [],
    createdBy: existing?.createdBy || user.id,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  })
  await persistDoc('xx_risk_actions', id, action)
  if (actionIsOverdue(action)) {
    const ids = [action.assigneeId, risk.assigneeId, risk.ownerId].filter((id) => id && id !== user.id)
    await notifyUsers(ids, {
      type: 'risk_overdue',
      title: 'Action en retard',
      body: `L’action « ${action.title} » du risque « ${risk.title} » est en retard.`,
      meta: { riskId: risk.id, actionId: action.id },
    })
  }
  return action
}

export async function deleteRiskAction(id, user) {
  const existing = memory.xx_risk_actions[id]
  if (!existing) throw new Error('Action introuvable.')
  const risk = memory.xx_risks[existing.riskId]
  if (!risk) throw new Error('Risque introuvable.')
  requireBudgetRiskManage(user, risk)
  await removeDoc('xx_risk_actions', id)
}

export async function addRiskActionComment(actionId, body, user) {
  const action = memory.xx_risk_actions[actionId]
  if (!action) throw new Error('Action introuvable.')
  const risk = memory.xx_risks[action.riskId]
  if (!risk) throw new Error('Risque introuvable.')
  requireBudgetRiskManage(user, risk)
  const text = String(body || '').trim()
  if (!text) throw new Error('Commentaire vide.')
  const comments = [...(action.comments || []), { userId: user.id, body: text, at: new Date().toISOString() }]
  const updated = inheritScopedAccess(risk, {
    ...action,
    comments,
    updatedAt: new Date().toISOString(),
  })
  await persistDoc('xx_risk_actions', actionId, updated)
  return updated
}

/* ─── Liens + canvas ─── */

function linkTypeOk(type) {
  return LINK_TYPES.includes(type)
}

async function removeLinksFor(type, id) {
  const types = type === 'idea' ? ['idea', 'task'] : [type]
  for (const link of Object.values(memory.xx_links || {})) {
    const hitFrom = types.includes(link.fromType) && link.fromId === id
    const hitTo = types.includes(link.toType) && link.toId === id
    if (hitFrom || hitTo) await removeDoc('xx_links', link.id)
  }
}

export async function saveLink(data, user) {
  if (!user) throw new Error('Permission refusée.')
  if (!canWriteRole(user)) {
    throw new Error('Permission refusée (rôle Lecteur : création interdite).')
  }
  const fromType = data.fromType
  const toType = data.toType
  if (!linkTypeOk(fromType) || !linkTypeOk(toType)) throw new Error('Type de lien invalide.')
  if (!data.fromId || !data.toId) throw new Error('Lien incomplet.')
  if (fromType === toType && data.fromId === data.toId) throw new Error('Lien circulaire refusé.')
  const dup = Object.values(memory.xx_links || {}).find(
    (l) =>
      l.fromType === fromType &&
      l.fromId === data.fromId &&
      l.toType === toType &&
      l.toId === data.toId,
  )
  if (dup) return dup
  const now = new Date().toISOString()
  const id = data.id || uid('lnk')
  const row = {
    id,
    fromType,
    fromId: data.fromId,
    toType,
    toId: data.toId,
    createdBy: user.id,
    ownerId: user.id,
    ownerEmail: user.email,
    createdAt: now,
  }
  await persistDoc('xx_links', id, row)
  return row
}

export async function deleteLink(id, user) {
  const existing = memory.xx_links[id]
  if (!existing) return
  if (!isAdmin(user) && existing.createdBy !== user.id && existing.ownerId !== user.id) {
    throw new Error('Permission refusée.')
  }
  await removeDoc('xx_links', id)
}

export async function syncNoteLinks(noteId, targets, user) {
  if (!noteId) throw new Error('Note requise.')
  const wanted = new Set(
    (targets || [])
      .filter((t) => t?.id && linkTypeOk(t.type))
      .map((t) => `${t.type}:${t.id}`),
  )
  const existing = Object.values(memory.xx_links || {}).filter(
    (l) => l.fromType === 'note' && l.fromId === noteId,
  )
  for (const link of existing) {
    if (!wanted.has(`${link.toType}:${link.toId}`)) {
      try {
        await deleteLink(link.id, user)
      } catch {
        /* ignore */
      }
    }
  }
  const have = new Set(existing.map((l) => `${l.toType}:${l.toId}`))
  for (const key of wanted) {
    if (have.has(key)) continue
    const i = key.indexOf(':')
    await saveLink(
      {
        fromType: 'note',
        fromId: noteId,
        toType: key.slice(0, i),
        toId: key.slice(i + 1),
      },
      user,
    )
  }
}

export async function saveCanvasLayout(positions, user) {
  if (!user) throw new Error('Permission refusée.')
  if (!canWriteRole(user)) {
    throw new Error('Permission refusée (rôle Lecteur : positions en lecture seule).')
  }
  const now = new Date().toISOString()
  const id = activeOrgId ? `${user.id}__${activeOrgId}` : user.id
  const legacy = memory.xx_canvas_layout[user.id]
  const legacyOk = legacy && (!legacy.orgId || legacy.orgId === activeOrgId)
  const existing = memory.xx_canvas_layout[id] || (legacyOk ? legacy : null)
  const row = {
    id,
    userId: user.id,
    ownerId: user.id,
    ownerEmail: user.email,
    positions: positions && typeof positions === 'object' ? positions : {},
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  }
  await persistDoc('xx_canvas_layout', id, row)
  return row
}

/* ─── Assistant IA (threads + prefs) ─── */

function requireThreadOwner(thread, user) {
  if (!user) throw new Error('Permission refusée.')
  if (!thread) throw new Error('Conversation introuvable.')
  if (thread.userId !== user.id) throw new Error('Permission refusée.')
}

export function listAiThreads(user) {
  if (!user) return []
  return Object.values(memory.xx_ai_threads || {})
    .filter((t) => t.userId === user.id && t.orgId === activeOrgId)
    .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))
}

export async function saveAiThread(data, user) {
  if (!user) throw new Error('Permission refusée.')
  const now = new Date().toISOString()
  const id = data.id || uid('ait')
  const existing = memory.xx_ai_threads[id]
  if (existing) requireThreadOwner(existing, user)
  const messages = Array.isArray(data.messages) ? data.messages : existing?.messages || []
  const titleRaw = String(data.title || existing?.title || '').trim()
  const firstUser = messages.find((m) => m.role === 'user')?.content || ''
  const title = titleRaw || clipTitle(firstUser) || 'Nouvelle conversation'
  const row = {
    ...(existing || {}),
    id,
    userId: user.id,
    ownerId: user.id,
    ownerEmail: user.email,
    title,
    section: data.section !== undefined ? data.section : existing?.section || 'dashboard',
    contextLabel: data.contextLabel !== undefined ? data.contextLabel : existing?.contextLabel || '',
    messages,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  }
  await persistDoc('xx_ai_threads', id, row)
  return row
}

function clipTitle(text) {
  const s = String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!s) return ''
  return s.length > 48 ? `${s.slice(0, 47)}…` : s
}

export async function deleteAiThread(id, user) {
  const existing = memory.xx_ai_threads[id]
  requireThreadOwner(existing, user)
  await removeDoc('xx_ai_threads', id)
}

export function getUserSettings(user) {
  if (!user) return null
  return memory.xx_settings?.[user.id] || null
}

export async function saveUserSettings(user, patch) {
  if (!user) throw new Error('Permission refusée.')
  const now = new Date().toISOString()
  const id = user.id
  const existing = memory.xx_settings[id] || {}
  const row = {
    ...existing,
    ...patch,
    id,
    userId: user.id,
    ownerId: user.id,
    ownerEmail: user.email,
    createdAt: existing.createdAt || now,
    updatedAt: now,
  }
  await persistDoc('xx_settings', id, row)
  return row
}

/* ─── Dashboard prefs + arcade (KingX / Zianotix) ─── */

const RESERVED_GAME_NAMES = new Set(['kingx', 'zianotix'])

function foldGameName(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '')
}

async function persistCreateOnly(col, id, value) {
  value = applyOrgStamp(col, value)
  if (!memory[col]) memory[col] = {}
  if (memory[col][id]) throw new Error('Enregistrement déjà présent (ajout seul).')
  memory[col][id] = value
  saveLocal(memory)
  notify()
  if (firebaseConfigured && db) {
    try {
      await withTimeout(
        setDoc(doc(db, col, id), value),
        FIRESTORE_OP_TIMEOUT_MS,
        `Firestore create ${col}/${id}`,
      )
    } catch (err) {
      console.warn(`Firestore create ${col}/${id} failed:`, err.message)
    }
  }
  return value
}

export function getDashboardPrefs(user) {
  if (!user) return null
  return memory.xx_dashboard_prefs?.[user.id] || null
}

export async function saveDashboardPrefs(user, patch) {
  if (!user) throw new Error('Permission refusée.')
  const now = new Date().toISOString()
  const id = user.id
  const existing = memory.xx_dashboard_prefs[id] || {}
  const hidden = Array.isArray(patch.hidden) ? patch.hidden.map(String) : existing.hidden || []
  const order = Array.isArray(patch.order) ? patch.order.map(String) : existing.order || []
  const row = {
    id,
    userId: user.id,
    ownerId: user.id,
    hidden,
    order,
    favoriteProjectId:
      patch.favoriteProjectId !== undefined ? patch.favoriteProjectId || '' : existing.favoriteProjectId || '',
    updatedAt: now,
    createdAt: existing.createdAt || now,
  }
  await persistDoc('xx_dashboard_prefs', id, row)
  return row
}

export function getGameProfile(user) {
  if (!user) return null
  return memory.xx_game_profiles?.[user.id] || null
}

export async function saveGameProfile(displayName, user) {
  if (!user) throw new Error('Permission refusée.')
  const name = String(displayName || '').trim()
  if (name.length < 2) throw new Error('Le pseudo doit contenir au moins 2 caractères.')
  if (name.length > 32) throw new Error('Le pseudo est trop long (32 caractères max).')
  const folded = foldGameName(name)
  if (!folded) throw new Error('Pseudo invalide.')
  if (RESERVED_GAME_NAMES.has(folded)) {
    throw new Error('Ce nom est réservé aux personnages officiels KingX et Zianotix.')
  }
  for (const row of Object.values(memory.xx_game_profiles || {})) {
    if (row.userId !== user.id && foldGameName(row.displayName) === folded) {
      throw new Error('Ce pseudo est déjà utilisé par un autre membre.')
    }
  }
  const now = new Date().toISOString()
  const id = user.id
  const existing = memory.xx_game_profiles[id] || {}
  const row = {
    id,
    userId: user.id,
    ownerId: user.id,
    displayName: name,
    updatedAt: now,
    createdAt: existing.createdAt || now,
  }
  await persistDoc('xx_game_profiles', id, row)
  return row
}

export async function createGameScore({ gameId, score, displayName }, user) {
  if (!user) throw new Error('Permission refusée.')
  const n = Number(score)
  if (!Number.isFinite(n)) throw new Error('Score invalide.')
  const gid = String(gameId || '').trim()
  if (!gid) throw new Error('Jeu inconnu.')
  const profile = memory.xx_game_profiles[user.id]
  const name = String(displayName || profile?.displayName || '').trim()
  if (!name) throw new Error('Pseudo de jeu requis.')
  const id = uid('gscore')
  const row = {
    id,
    userId: user.id,
    ownerId: user.id,
    displayName: name,
    gameId: gid,
    score: n,
    at: new Date().toISOString(),
  }
  await persistCreateOnly('xx_game_scores', id, row)
  return row
}

/** Lecteur autorisé. Seul un admin peut supprimer. */
export async function saveFeedback(data, user) {
  if (!user) throw new Error('Permission refusée.')
  const title = String(data.title || '').trim()
  const body = String(data.body || '').trim()
  if (!title) throw new Error('Titre requis.')
  if (!body) throw new Error('Message requis.')
  const now = new Date().toISOString()
  const id = uid('fbk')
  const module = String(data.module || '').trim() || null
  const row = {
    id,
    userId: user.id,
    ownerId: user.id,
    title: title.slice(0, 200),
    body: body.slice(0, 8000),
    module,
    status: 'nouveau',
    createdAt: now,
    authorName: user.fullName || '',
    authorEmail: user.email || '',
  }
  if (!memory.xx_feedback) memory.xx_feedback = {}
  await persistDoc('xx_feedback', id, row)
  const adminIds = Object.values(memory.xx_users || {})
    .filter((u) => isAdmin(u))
    .map((u) => u.id)
    .filter((adminId) => adminId && adminId !== user.id)
  if (adminIds.length) {
    await notifyUsers(adminIds, {
      type: 'feedback',
      title: 'Nouveau retour',
      body: `${user.fullName || user.email} : ${row.title}`,
      meta: { feedbackId: row.id },
    })
  }
  return row
}

export async function deleteFeedback(id, user) {
  if (!isAdmin(user)) throw new Error('Seuls les administrateurs peuvent supprimer un retour.')
  const existing = memory.xx_feedback?.[id]
  if (!existing) return
  await removeDoc('xx_feedback', id)
}

/** Merge a feedback document. Does not delete it. */
export async function writeFeedbackDoc(row) {
  const id = String(row?.id || '').trim()
  if (!id || id.includes('/')) throw new Error('Retour invalide.')
  if (!memory.xx_feedback) memory.xx_feedback = {}
  const prev = memory.xx_feedback[id] || null
  const next = { ...(prev || {}), ...row, id }
  await persistDoc('xx_feedback', id, next)
  return next
}

async function fetchOrgCol(col, orgId) {
  if (!firebaseConfigured || !db || !orgId) return []
  const snap = await getDocs(query(collection(db, col), where('orgId', '==', orgId)))
  const list = []
  snap.forEach((d) => {
    const data = d.data() || {}
    list.push({ id: d.id, title: data.title || data.name || '—', orgId: data.orgId || orgId })
  })
  return list
}

const orgApi = createOrgLayer({
  getMemory: () => memory,
  persistDoc,
  removeDoc,
  getActiveOrgId: () => activeOrgId,
  setActiveOrgId,
  isAdminUser: isAdmin,
  newId: uid,
  now: () => new Date().toISOString(),
  setPeek,
  fetchOrgCol,
})

export function listAllFeedback() {
  return Object.values(memory.xx_feedback || {})
}
export function listOrgMemberships(user) { return orgApi.membershipsFor(user) }
export function orgRole(user, orgId = activeOrgId) { return orgApi.memberOf(user, orgId)?.role || '' }
export function canManageOrg(user, orgId = activeOrgId) { return orgApi.isManager(user, orgId) }
export function selectOrganization(orgId, user) {
  if (!user) throw new Error('Session requise.')
  if (!orgId) { setActiveOrgId(''); return }
  const allowed = orgApi.membershipsFor(user).some((m) => m.orgId === orgId)
  if (!allowed) throw new Error('Vous n’appartenez pas à cette organisation.')
  setActiveOrgId(orgId)
}
export function listOrganizations() {
  return Object.values(memory.xx_orgs || {}).sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'fr'))
}
export function listMembersOfOrg(orgId) {
  return Object.values(memory.xx_org_members || {}).filter((m) => m.orgId === orgId)
}
export const createOrganization = (...args) => orgApi.createOrganization(...args)
export async function resolveOrganizations(user) {
  const result = await orgApi.resolveOrganizations(user)
  bindRealtimeForUser(user)
  return result
}
export const placeUserInOrg = (...args) => orgApi.placeUserInOrg(...args)
export const removeOrgMember = (...args) => orgApi.removeOrgMember(...args)
export const deleteOrganization = (...args) => orgApi.deleteOrganization(...args)
export const loadOrgPeek = (...args) => orgApi.loadOrgPeek(...args)

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    firestoreSyncState = firebaseConfigured && db ? 'ok' : 'skipped'
    if (firebaseConfigured && db) rebindOrgListeners()
    notify()
  })
  window.addEventListener('offline', () => { firestoreSyncState = 'offline'; notify() })
}

