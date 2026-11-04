import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

const ENV_KEYS = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
]

function env(name) {
  return String(import.meta.env[name] || '').trim()
}

const config = {
  apiKey: env('VITE_FIREBASE_API_KEY'),
  authDomain: env('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: env('VITE_FIREBASE_PROJECT_ID'),
  storageBucket: env('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: env('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId: env('VITE_FIREBASE_APP_ID'),
}

export const missingFirebaseVars = ENV_KEYS.filter((key) => !env(key))

/** True when at least apiKey + projectId are present (minimum to init the SDK). */
export const firebaseConfigured = Boolean(config.apiKey && config.projectId)

let app = null
let auth = null
let db = null
let storage = null
let initError = null

if (firebaseConfigured) {
  try {
    app = initializeApp(config)
    auth = getAuth(app)
    db = getFirestore(app)
    storage = config.storageBucket ? getStorage(app) : null
  } catch (err) {
    initError = err
    console.warn('Firebase init failed, falling back to local store:', err)
  }
}

export function getFirebaseStatus() {
  return {
    configured: firebaseConfigured,
    authReady: Boolean(auth),
    firestoreReady: Boolean(db),
    storageReady: Boolean(storage),
    storageBucket: config.storageBucket || null,
    missingVars: missingFirebaseVars,
    initError: initError?.message || null,
    projectId: config.projectId || null,
  }
}

export function isStorageConfigured() {
  return Boolean(storage)
}

export { app, auth, db, storage, config as firebaseConfig, ENV_KEYS as FIREBASE_ENV_KEYS }
