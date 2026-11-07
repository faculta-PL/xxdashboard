/** Safe image/PDF URLs in notes. Never innerHTML / javascript: URLs. */

const IMAGE_EXT = /\.(jpg|jpeg|png|gif|webp)(?:$|[?#])/i
const URL_RE = /https?:\/\/[^\s<>"']+/gi

export function safeHttpUrl(raw) {
  const text = String(raw || '').trim()
  if (!text) return ''
  try {
    const u = new URL(text)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return ''
    if (u.username || u.password) return ''
    return u.href
  } catch {
    return ''
  }
}

export function isImageUrl(raw) {
  const href = safeHttpUrl(raw)
  if (!href) return false
  if (IMAGE_EXT.test(href)) return true
  try {
    const u = new URL(href)
    if (/image/i.test(u.pathname) || /\/img\//i.test(u.pathname)) return true
  } catch {
    return false
  }
  return false
}

export function extractMediaUrls(content) {
  const text = String(content || '')
  const found = text.match(URL_RE) || []
  const images = []
  const links = []
  const seen = new Set()
  for (const raw of found) {
    const href = safeHttpUrl(raw.replace(/[.,);]+$/, ''))
    if (!href || seen.has(href)) continue
    seen.add(href)
    if (isImageUrl(href)) images.push(href)
    else links.push(href)
  }
  return { images, links }
}

export function splitContentMedia(content) {
  const text = String(content || '')
  if (!text) return []
  const parts = []
  const re = /https?:\/\/[^\s<>"']+/gi
  let last = 0
  let match
  while ((match = re.exec(text))) {
    if (match.index > last) {
      parts.push({ type: 'text', text: text.slice(last, match.index) })
    }
    const href = safeHttpUrl(String(match[0]).replace(/[.,);]+$/, ''))
    if (href && isImageUrl(href)) parts.push({ type: 'image', url: href })
    else if (href) parts.push({ type: 'link', url: href })
    else parts.push({ type: 'text', text: match[0] })
    last = match.index + match[0].length
  }
  if (last < text.length) parts.push({ type: 'text', text: text.slice(last) })
  return parts
}
