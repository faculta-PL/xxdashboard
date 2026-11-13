/* Nazix Mini — app shell only. Never cache private data or API responses. */
const SHELL = 'nazix-shell-v1'
const PRECACHE = ['/', '/index.html', '/manifest.webmanifest', '/favicon.svg', '/icons/icon-192.png', '/icons/icon-512.png']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== SHELL).map((key) => caches.delete(key)))).then(() => self.clients.claim()),
  )
})

function isPrivate(url) {
  if (url.origin !== self.location.origin) return true
  if (url.pathname.startsWith('/api')) return true
  return false
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  if (event.request.method !== 'GET' || isPrivate(url)) return
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/index.html')),
    )
    return
  }
  const shellLike = ['document', 'script', 'style', 'image', 'font'].includes(event.request.destination)
  if (!shellLike) return
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.ok) {
          const copy = response.clone()
          caches.open(SHELL).then((cache) => cache.put(event.request, copy))
        }
        return response
      })
      .catch(() => caches.match(event.request)),
  )
})
