/** Pure feedback shapes, filters, and .txt import. No React, no storage. */

export const FEEDBACK_STATUSES = ['new', 'accepted', 'in_progress', 'done', 'declined']

export const FEEDBACK_MODULE_IDS = [
  'dashboard',
  'projects',
  'notes',
  'ideas',
  'calendar',
  'todos',
  'files',
  'budget',
  'risks',
  'canvas',
  'team',
  'chat',
  'assistant',
  'create',
  'games',
  'autre',
]

const LEGACY_STATUS = {
  nouveau: 'new',
  new: 'new',
  accepted: 'accepted',
  accepte: 'accepted',
  accepté: 'accepted',
  in_progress: 'in_progress',
  'en cours': 'in_progress',
  done: 'done',
  termine: 'done',
  terminé: 'done',
  declined: 'declined',
  decline: 'declined',
  refusé: 'declined',
  refuse: 'declined',
  écarté: 'declined',
  ecarte: 'declined',
}

const FIELD_RE = /^(titre|module|d[ée]tail|detail)\s*:\s*(.*)$/i

function foldKey(key) {
  return String(key || '')
    .toLowerCase()
    .replace(/[éèêë]/g, 'e')
}

export function isLegacyFeedback(item) {
  return !item || item.orgId == null
}

export function statusOf(item) {
  const raw = String(item?.status || '').trim()
  if (FEEDBACK_STATUSES.includes(raw)) return raw
  const folded = foldKey(raw)
  return LEGACY_STATUS[raw] || LEGACY_STATUS[folded] || 'new'
}

export function voterIds(item) {
  if (Array.isArray(item?.votes)) return item.votes.map((id) => String(id || '')).filter(Boolean)
  if (Array.isArray(item?.voterIds)) return item.voterIds.map((id) => String(id || '')).filter(Boolean)
  return []
}

export function voteCount(item) {
  if (Array.isArray(item?.votes)) return voterIds(item).length
  if (typeof item?.votes === 'number' && Number.isFinite(item.votes)) return item.votes
  return voterIds(item).length
}

export function detailOf(item) {
  return String(item?.detail || item?.body || '').trim()
}

export function authorOf(item) {
  if (typeof item?.author === 'string' && item.author.trim()) return item.author.trim()
  if (item?.author && typeof item.author === 'object') {
    return String(item.author.name || item.author.fullName || item.author.email || '').trim()
  }
  return String(item?.authorName || '').trim()
}

export function sourceOf(item) {
  return item?.source === 'import' ? 'import' : 'app'
}

/**
 * Split a .txt on blank lines.
 * Optional lines: Titre: / Module: / Détail:
 * A block without those labels uses its text as the feedback.
 */
export function parseFeedbackTxt(raw) {
  const text = String(raw || '')
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
  const blocks = text
    .split(/\n[ \t]*\n+/)
    .map((block) => block.trim())
    .filter(Boolean)
  const items = []
  for (const block of blocks) {
    const lines = block.split('\n')
    let title = ''
    let moduleName = ''
    const detailParts = []
    let sawField = false
    for (const line of lines) {
      const match = line.match(FIELD_RE)
      if (match) {
        sawField = true
        const key = foldKey(match[1])
        const value = String(match[2] || '').trim()
        if (key === 'titre') title = value
        else if (key === 'module') moduleName = value
        else detailParts.push(value)
        continue
      }
      detailParts.push(line.trimEnd())
    }
    let detail = detailParts.join('\n').trim()
    if (!sawField) {
      const content = lines.map((line) => line.trim()).filter(Boolean)
      title = content[0] || ''
      detail = content.join('\n').trim()
    }
    if (!title) title = (detail.split('\n')[0] || '').trim()
    title = title.replace(/\s+/g, ' ').trim().slice(0, 200)
    detail = detail.trim().slice(0, 8000)
    if (!detail) detail = title
    if (!title && !detail) continue
    items.push({
      title,
      detail,
      module: moduleName.replace(/\s+/g, ' ').trim().slice(0, 80),
    })
  }
  return items
}

export function feedbackVisible(item, user, orgId, canSeeAllLegacy) {
  if (!item || !user) return false
  if (isLegacyFeedback(item)) {
    return Boolean(canSeeAllLegacy || item.userId === user.id || item.ownerId === user.id || item.authorId === user.id)
  }
  const active = String(orgId || '')
  return String(item.orgId || '') === active
}
