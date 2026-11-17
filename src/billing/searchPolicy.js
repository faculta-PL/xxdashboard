/** External search stays on DuckDuckGo and Wikipedia. Sources are links. No client API key. */

export const SEARCH_SOURCES = [
  'https://api.duckduckgo.com/',
  'https://html.duckduckgo.com/html/',
  'https://lite.duckduckgo.com/lite/',
  'https://fr.wikipedia.org/w/api.php',
  'https://en.wikipedia.org/w/api.php',
]

const KEY_FIELDS = ['apiKey', 'api_key', 'apikey', 'key', 'token', 'authorization', 'secret']

export function isApprovedSearchHost(hostname) {
  const host = String(hostname || '').toLowerCase()
  if (!host) return false
  if (host === 'google.com' || host.endsWith('.google.com') || host.includes('google.')) return false
  if (host === 'instagram.com' || host.endsWith('.instagram.com')) return false
  return host === 'duckduckgo.com' || host.endsWith('.duckduckgo.com') || host === 'wikipedia.org' || host.endsWith('.wikipedia.org')
}

export function assertApprovedSearchUrl(url) {
  let host = ''
  try {
    host = new URL(url).hostname
  } catch {
    throw new Error('Source de recherche non autorisée.')
  }
  if (!isApprovedSearchHost(host)) throw new Error('Source de recherche non autorisée.')
  return url
}

export function searchSourcesAreApproved(urls = SEARCH_SOURCES) {
  return (urls || []).every((url) => {
    try {
      return isApprovedSearchHost(new URL(url).hostname)
    } catch {
      return false
    }
  })
}

export function stripClientSecrets(body) {
  if (!body || typeof body !== 'object') return {}
  const next = { ...body }
  for (const field of KEY_FIELDS) delete next[field]
  return next
}

export function clientPayloadHasNoApiKey(body) {
  const text = JSON.stringify(stripClientSecrets(body))
  return !/api[_-]?key/i.test(text) && !/\bsk-[a-z0-9]/i.test(text)
}

/** Keep title, snippet and a link. Do not fetch the source page. */
export function sanitizeSearchResults(data) {
  const results = (data?.results || [])
    .map((item) => ({
      title: String(item?.title || ''),
      url: String(item?.url || ''),
      snippet: String(item?.snippet || ''),
      source: String(item?.source || (String(item?.url || '').includes('wikipedia.org') ? 'Wikipedia' : 'Web')),
    }))
    .filter((item) => item.title || item.url)
  return { ...(data || {}), results }
}
