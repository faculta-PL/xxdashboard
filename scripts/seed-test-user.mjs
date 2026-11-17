/**
 * Create the normal test account in Firebase Auth and xx_users.
 * Password comes from TEST_USER_PASSWORD. Nothing is printed except a status.
 */
import { createHash } from 'node:crypto'
const email = 'testeur@nazix.app'
const password = process.env.TEST_USER_PASSWORD || ''
const apiKey = process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY || ''
const projectId = process.env.VITE_FIREBASE_PROJECT_ID || 'partagio'

if (!password) {
  console.error('firebase: skipped-no-password')
  process.exit(1)
}
if (!apiKey) {
  console.log('firebase: skipped-no-config')
  console.log('profile: skipped')
  process.exit(0)
}

const referer = 'https://xxdashboard-amber.vercel.app/'

async function postJson(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Referer: referer },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok, data }
}

const signUp = await postJson(
  `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${encodeURIComponent(apiKey)}`,
  { email, password, returnSecureToken: true },
)

let idToken = signUp.data?.idToken || ''
let localId = signUp.data?.localId || ''
let firebase = 'created'

if (signUp.data?.error?.message === 'EMAIL_EXISTS') {
  const signIn = await postJson(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(apiKey)}`,
    { email, password, returnSecureToken: true },
  )
  if (!signIn.data?.idToken || !signIn.data?.localId) {
    console.log('firebase: existed-password-mismatch')
    console.log('profile: skipped')
    process.exit(0)
  }
  idToken = signIn.data.idToken
  localId = signIn.data.localId
  firebase = 'existed-password-ok'
} else if (!idToken || !localId) {
  console.log('firebase: error')
  console.log('profile: skipped')
  process.exit(1)
}

await postJson(
  `https://identitytoolkit.googleapis.com/v1/accounts:update?key=${encodeURIComponent(apiKey)}`,
  { idToken, displayName: 'Testeur', returnSecureToken: false },
)

const passwordHash = createHash('sha256').update(password, 'utf8').digest('hex')
const now = new Date().toISOString()
const fields = {
  id: { stringValue: localId },
  fullName: { stringValue: 'Testeur' },
  handle: { stringValue: 'testeur' },
  email: { stringValue: email },
  passwordHash: { stringValue: passwordHash },
  role: { stringValue: 'Membre' },
  status: { stringValue: 'active' },
  emailVerified: { booleanValue: true },
  firebaseUid: { stringValue: localId },
  createdAt: { stringValue: now },
  updatedAt: { stringValue: now },
}
const profileRes = await fetch(
  `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/xx_users/${encodeURIComponent(localId)}`,
  {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
      Referer: referer,
    },
    body: JSON.stringify({ fields }),
  },
)
console.log(`firebase: ${firebase}`)
console.log(profileRes.ok ? 'profile: written' : 'profile: error')
process.exit(profileRes.ok ? 0 : 1)
