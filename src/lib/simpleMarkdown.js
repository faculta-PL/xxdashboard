/** Safe, no-HTML simple markdown for notes and canvas viewers. */

const CALC_KEEP = /[\d\s.,x×*/+\-=$€£%()]/g

export function looksLikeCalc(raw) {
  const t = String(raw || '').trim()
  if (!t || t.length > 240) return false
  const nums = t.match(/\d+(?:[.,]\d+)?/g) || []
  if (/=/.test(t) && nums.length >= 2) return true
  const stripped = t.replace(CALC_KEEP, '')
  return stripped.length <= Math.max(2, t.length * 0.12) && nums.length >= 2 && /[+\-×x*/=]/.test(t)
}

export function plainPreview(raw) {
  return String(raw || '')
    .replace(/\r\n/g, '\n')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[-*]\s+/gm, '• ')
    .replace(/^\s*\d+[.)]\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^\s*>\s?/gm, '')
    .trim()
}

export function splitInline(text) {
  const src = String(text || '')
  const parts = []
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g
  let last = 0
  let match
  while ((match = re.exec(src))) {
    if (match.index > last) parts.push({ type: 'text', text: src.slice(last, match.index) })
    const tok = match[0]
    if (tok.startsWith('**')) parts.push({ type: 'strong', text: tok.slice(2, -2) })
    else if (tok.startsWith('`')) parts.push({ type: 'code', text: tok.slice(1, -1) })
    else parts.push({ type: 'em', text: tok.slice(1, -1) })
    last = match.index + tok.length
  }
  if (last < src.length) parts.push({ type: 'text', text: src.slice(last) })
  return parts.length ? parts : [{ type: 'text', text: src }]
}

function isBlockStart(trimmed) {
  return (
    /^#{1,3}\s+/.test(trimmed) ||
    /^[-*]\s+/.test(trimmed) ||
    /^\d+[.)]\s+/.test(trimmed) ||
    /^>\s?/.test(trimmed) ||
    /^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)
  )
}

export function parseSimpleBlocks(raw) {
  const text = String(raw || '').replace(/\r\n/g, '\n')
  if (!text.trim()) return []
  const lines = text.split('\n')
  const blocks = []
  let i = 0
  while (i < lines.length) {
    const trimmed = lines[i].trim()
    if (!trimmed) {
      i += 1
      continue
    }
    const heading = trimmed.match(/^(#{1,3})\s+(.+)$/)
    if (heading) {
      blocks.push({ type: `h${heading[1].length}`, text: heading[2].trim() })
      i += 1
      continue
    }
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      blocks.push({ type: 'hr' })
      i += 1
      continue
    }
    if (/^>\s?/.test(trimmed)) {
      const quote = []
      while (i < lines.length && /^>\s?/.test(lines[i].trim())) {
        quote.push(lines[i].trim().replace(/^>\s?/, ''))
        i += 1
      }
      blocks.push({ type: 'quote', text: quote.join('\n') })
      continue
    }
    const ordered = /^\d+[.)]\s+/.test(trimmed)
    const bullet = /^[-*]\s+/.test(trimmed)
    if (ordered || bullet) {
      const items = []
      while (i < lines.length) {
        const t = lines[i].trim()
        if (ordered && /^\d+[.)]\s+/.test(t)) items.push(t.replace(/^\d+[.)]\s+/, ''))
        else if (bullet && /^[-*]\s+/.test(t)) items.push(t.replace(/^[-*]\s+/, ''))
        else if (!t) {
          i += 1
          break
        } else break
        i += 1
      }
      blocks.push({ type: ordered ? 'ol' : 'ul', items })
      continue
    }
    const para = []
    while (i < lines.length) {
      const rawLine = lines[i]
      const t = rawLine.trim()
      if (!t) {
        i += 1
        break
      }
      if (para.length && isBlockStart(t)) break
      para.push(rawLine)
      i += 1
    }
    const joined = para.join('\n')
    blocks.push({ type: looksLikeCalc(joined) ? 'calc' : 'p', text: joined })
  }
  return blocks
}
