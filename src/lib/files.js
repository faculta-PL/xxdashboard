/** Nazix Fichiers — types, taille max, IndexedDB locale, helpers Storage. */

export const MAX_FILE_BYTES = 20 * 1024 * 1024

export const ALLOWED_FILE_EXTS = ['pdf', 'docx', 'xlsx', 'csv', 'txt', 'md', 'jpg', 'jpeg', 'png', 'gif', 'webp']

/** Exécutables et formats XSS — toujours refusés, même hors liste blanche. */
export const BLOCKED_FILE_EXTS = [
  'exe',
  'bat',
  'cmd',
  'sh',
  'bash',
  'js',
  'mjs',
  'cjs',
  'msi',
  'apk',
  'html',
  'htm',
  'xhtml',
  'svg',
  'svgz',
  'com',
  'scr',
  'ps1',
  'vbs',
  'jar',
  'wasm',
]

export const FILE_VISIBILITIES = ['Privée', 'Partagée', 'Équipe']

export const FILE_PERM_OPTIONS = ['Lecture', 'Modification', 'Gestion']

const EXT_MIME = {
  pdf: ['application/pdf'],
  docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  xlsx: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  csv: ['text/csv', 'text/plain', 'application/csv', 'application/vnd.ms-excel'],
  txt: ['text/plain'],
  md: ['text/markdown', 'text/plain', 'text/x-markdown'],
  jpg: ['image/jpeg'],
  jpeg: ['image/jpeg'],
  png: ['image/png'],
  gif: ['image/gif'],
  webp: ['image/webp'],
}

const BLOCKED_MIMES = new Set([
  'text/html',
  'application/xhtml+xml',
  'image/svg+xml',
  'application/javascript',
  'text/javascript',
  'application/x-javascript',
  'application/x-msdownload',
  'application/x-msdos-program',
  'application/vnd.microsoft.portable-executable',
  'application/x-sh',
  'application/x-bat',
  'application/java-archive',
])

const IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp'])
const IDB_NAME = 'nazix_files'
const IDB_STORE = 'blobs'

export function maxFileSizeLabel() {
  return `${Math.round(MAX_FILE_BYTES / (1024 * 1024))} Mo`
}

export function formatFileSize(bytes) {
  const n = Number(bytes) || 0
  if (n < 1024) return `${n} o`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} Ko`
  return `${(n / (1024 * 1024)).toFixed(1)} Mo`
}

export function fileExt(name) {
  const base = String(name || '').trim().split(/[/\\]/).pop() || ''
  const dot = base.lastIndexOf('.')
  if (dot <= 0 || dot === base.length - 1) return ''
  return base.slice(dot + 1).toLowerCase()
}

export function safeFileName(name) {
  const cleaned = String(name || 'fichier')
    .replace(/[/\\]/g, '_')
    .replace(/\0/g, '')
    .trim()
  return (cleaned || 'fichier').slice(0, 180)
}

export function isImageExt(ext) {
  return IMAGE_EXTS.has(String(ext || '').toLowerCase())
}

export function isPdfExt(ext) {
  return String(ext || '').toLowerCase() === 'pdf'
}

export function mimeForExt(ext, fallback = '') {
  const list = EXT_MIME[String(ext || '').toLowerCase()]
  return list?.[0] || fallback || 'application/octet-stream'
}

export function validateUploadFile(file) {
  if (!file) throw new Error('Aucun fichier sélectionné.')
  const size = Number(file.size) || 0
  if (size <= 0) throw new Error('Fichier vide.')
  if (size > MAX_FILE_BYTES) {
    throw new Error(`Fichier trop volumineux (maximum ${maxFileSizeLabel()}).`)
  }
  const ext = fileExt(file.name)
  if (!ext) throw new Error('Extension de fichier manquante.')
  if (BLOCKED_FILE_EXTS.includes(ext)) {
    throw new Error('Type de fichier bloqué (exécutable ou risque XSS).')
  }
  if (!ALLOWED_FILE_EXTS.includes(ext)) {
    throw new Error(`Type non autorisé (.${ext}). Formats : ${ALLOWED_FILE_EXTS.join(', ')}.`)
  }
  const mime = String(file.type || '').toLowerCase()
  if (mime && BLOCKED_MIMES.has(mime)) {
    throw new Error('Type MIME bloqué.')
  }
  if (mime && mime !== 'application/octet-stream') {
    const allowed = EXT_MIME[ext] || []
    if (allowed.length && !allowed.includes(mime)) {
      throw new Error('Le type MIME ne correspond pas à l’extension.')
    }
  }
  return { ext, mime: mimeForExt(ext, mime), size }
}

function openIdb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB indisponible.'))
      return
    }
    const req = indexedDB.open(IDB_NAME, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function idbPutBlob(id, blob) {
  const db = await openIdb()
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite')
      tx.objectStore(IDB_STORE).put(blob, id)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } finally {
    db.close()
  }
}

export async function idbGetBlob(id) {
  const db = await openIdb()
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly')
      const req = tx.objectStore(IDB_STORE).get(id)
      req.onsuccess = () => resolve(req.result || null)
      req.onerror = () => reject(req.error)
    })
  } finally {
    db.close()
  }
}

export async function idbDeleteBlob(id) {
  if (!id) return
  const db = await openIdb()
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite')
      tx.objectStore(IDB_STORE).delete(id)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } finally {
    db.close()
  }
}

export function storageObjectPath(ownerId, fileId, name) {
  return `files/${ownerId}/${fileId}/${safeFileName(name)}`
}
