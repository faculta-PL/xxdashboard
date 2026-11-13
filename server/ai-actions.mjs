/** Strip JSON / function-call action blobs from assistant text.
 * Parse them into confirm-button actions. Never execute. */

export const ACTION_KINDS = [
  'create_note',
  'update_note',
  'create_subnote',
  'create_idea',
  'create_risk',
  'create_budget_line',
  'update_budget_line',
  'create_task',
  'update_task',
  'create_event',
  'update_event',
  'create_project',
  'update_project',
  'draft_message',
]

export const ACTION_LABELS = {
  create_note: 'Créer une note',
  update_note: 'Mettre à jour une note',
  create_subnote: 'Créer une sous-note',
  create_idea: 'Créer une idée',
  create_risk: 'Créer un risque',
  create_budget_line: 'Créer une ligne budgétaire',
  update_budget_line: 'Mettre à jour une ligne',
  create_task: 'Créer une tâche',
  update_task: 'Mettre à jour une tâche',
  create_event: 'Créer un événement',
  update_event: 'Mettre à jour un événement',
  create_project: 'Créer un projet',
  update_project: 'Mettre à jour un projet',
  draft_message: 'Brouillon de message',
}

const KIND_RE = ACTION_KINDS.join('|')
const ACTION_HINT_RE = new RegExp(
  `"kind"\\s*:\\s*"(${KIND_RE})"|` +
    `"name"\\s*:\\s*"(${KIND_RE})"|` +
    `"function"\\s*:\\s*"(${KIND_RE})"`,
  'i',
)

const EMPTY_ACTION_FALLBACK =
  'Proposition prête. Confirmez via le bouton ci-dessous si vous souhaitez l’appliquer.'

function parseMaybeJson(value) {
  if (value == null) return value
  if (typeof value === 'object') return value
  if (typeof value !== 'string') return value
  const trimmed = value.trim()
  if (!trimmed) return {}
  try {
    return JSON.parse(trimmed)
  } catch {
    return { body: trimmed }
  }
}

function isActionPayload(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false
  if (ACTION_KINDS.includes(obj.kind)) return true
  if (ACTION_KINDS.includes(obj.name) && (obj.arguments != null || obj.parameters != null || obj.draft != null)) {
    return true
  }
  const fc = obj.function_call || obj.functionCall
  if (fc && ACTION_KINDS.includes(fc.name)) return true
  if (obj.type === 'function' && ACTION_KINDS.includes(obj.function?.name || obj.name)) return true
  if (Array.isArray(obj.actions) && obj.actions.some(isActionPayload)) return true
  return false
}

function looksLikeActionBlob(text) {
  const src = String(text || '')
  if (ACTION_HINT_RE.test(src)) return true
  if (/function_call|functionCall/i.test(src) && ACTION_HINT_RE.test(src)) return true
  return false
}

function collectPayloads(value, into) {
  if (!value) return
  if (Array.isArray(value)) {
    for (const item of value) collectPayloads(item, into)
    return
  }
  if (Array.isArray(value.actions)) {
    for (const item of value.actions) collectPayloads(item, into)
    return
  }
  if (isActionPayload(value)) into.push(value)
}

function tryParseActionBlob(text) {
  const src = String(text || '').trim()
  if (!src) return { hit: false, payloads: [] }
  try {
    const parsed = JSON.parse(src)
    const payloads = []
    collectPayloads(parsed, payloads)
    if (payloads.length) return { hit: true, payloads }
  } catch {
    /* ignore */
  }
  return { hit: looksLikeActionBlob(src), payloads: [] }
}

function normalizeAction(item) {
  if (!item || typeof item !== 'object') return null
  let kind = item.kind
  let draft = item.draft
  let label = item.label
  if (!ACTION_KINDS.includes(kind)) {
    const fc = item.function_call || item.functionCall || item.function || null
    kind = item.name || fc?.name || item.function?.name
    const args = item.arguments ?? item.parameters ?? fc?.arguments ?? item.function?.arguments
    draft = item.draft ?? parseMaybeJson(args)
  } else if (draft == null) {
    const { kind: _k, label: _l, ...rest } = item
    draft = rest
  }
  if (!ACTION_KINDS.includes(kind)) return null
  if (draft && typeof draft === 'object' && draft.kind && ACTION_KINDS.includes(draft.kind) && draft.kind !== kind) {
    /* keep */
  }
  if (draft && typeof draft === 'object') {
    const { kind: draftKind, ...rest } = draft
    if (draftKind === kind) draft = rest
  }
  return {
    kind,
    label: label || ACTION_LABELS[kind] || kind,
    draft: draft && typeof draft === 'object' ? draft : {},
  }
}

function pushNormalized(actions, payloads) {
  for (const payload of payloads) {
    const normalized = normalizeAction(payload)
    if (normalized) actions.push(normalized)
  }
}

function extractBalanced(text, start, open, close) {
  if (text[start] !== open) return null
  let depth = 0
  let inStr = false
  let escape = false
  for (let i = start; i < text.length; i++) {
    const c = text[i]
    if (inStr) {
      if (escape) {
        escape = false
        continue
      }
      if (c === '\\') {
        escape = true
        continue
      }
      if (c === '"') inStr = false
      continue
    }
    if (c === '"') {
      inStr = true
      continue
    }
    if (c === open) depth += 1
    else if (c === close) {
      depth -= 1
      if (depth === 0) {
        return { end: i + 1, value: text.slice(start, i + 1) }
      }
    }
  }
  return null
}

function overlaps(spans, start, end) {
  for (const span of spans) {
    if (start < span.end && end > span.start) return true
  }
  return false
}

function spliceOut(src, spans) {
  if (!spans.length) return src
  const ordered = [...spans].sort((a, b) => a.start - b.start)
  let out = ''
  let cursor = 0
  for (const span of ordered) {
    if (span.start < cursor) continue
    out += src.slice(cursor, span.start)
    cursor = span.end
  }
  out += src.slice(cursor)
  return out
}

function tidy(text) {
  return String(text || '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function couldBeActionJson(partial) {
  const s = String(partial || '').trimStart()
  if (!s.startsWith('{') && !s.startsWith('[')) return false
  const head = s.slice(0, 160)
  if (head === '{' || head === '[') return true
  if (head.startsWith('{"') || head.startsWith('{ "') || head.startsWith('["') || head.startsWith('[ "')) return true
  return ACTION_HINT_RE.test(head) || /function_call|functionCall/i.test(head)
}

function incompleteHoldIndex(text) {
  const src = String(text || '')
  const fence = src.lastIndexOf('```')
  if (fence !== -1) {
    const after = src.slice(fence + 3)
    if (!after.includes('```')) return fence
  }

  let depth = 0
  let inStr = false
  let escape = false
  let lastOpen = -1
  let openChar = ''
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (inStr) {
      if (escape) {
        escape = false
        continue
      }
      if (c === '\\') {
        escape = true
        continue
      }
      if (c === '"') inStr = false
      continue
    }
    if (c === '"') {
      inStr = true
      continue
    }
    if (c === '{' || c === '[') {
      if (depth === 0) {
        lastOpen = i
        openChar = c
      }
      depth += 1
    } else if (c === '}' || c === ']') {
      depth = Math.max(0, depth - 1)
      if (depth === 0) {
        lastOpen = -1
        openChar = ''
      }
    }
  }
  if (lastOpen !== -1 && couldBeActionJson(src.slice(lastOpen))) {
    if (openChar === '{' || openChar === '[') return lastOpen
  }
  return -1
}

export function mergeAiActions(...lists) {
  const byKind = new Map()
  for (const list of lists) {
    for (const raw of list || []) {
      const action = normalizeAction(raw)
      if (!action) continue
      const prev = byKind.get(action.kind)
      if (!prev) {
        byKind.set(action.kind, action)
        continue
      }
      const prevFilled = Object.values(prev.draft || {}).filter((v) => v !== '' && v != null).length
      const nextFilled = Object.values(action.draft || {}).filter((v) => v !== '' && v != null).length
      if (nextFilled >= prevFilled) byKind.set(action.kind, action)
    }
  }
  return [...byKind.values()]
}

export function splitDisplayAndActions(raw, { holdIncomplete = false } = {}) {
  const src = String(raw || '')
  const actions = []
  const remove = []

  const fenceRe = /```(?:json|jsonc)?[ \t]*\r?\n?([\s\S]*?)```/gi
  for (const match of src.matchAll(fenceRe)) {
    const inner = match[1] || ''
    const parsed = tryParseActionBlob(inner)
    if (parsed.hit) {
      pushNormalized(actions, parsed.payloads)
      remove.push({ start: match.index, end: match.index + match[0].length })
    }
  }

  const scan = (open, close) => {
    let i = 0
    while (i < src.length) {
      const ch = src[i]
      if (ch === open) {
        const extracted = extractBalanced(src, i, open, close)
        if (!extracted) {
          i += 1
          continue
        }
        if (!overlaps(remove, i, extracted.end)) {
          const parsed = tryParseActionBlob(extracted.value)
          if (parsed.hit) {
            pushNormalized(actions, parsed.payloads)
            remove.push({ start: i, end: extracted.end })
          }
        }
        i = extracted.end
        continue
      }
      i += 1
    }
  }
  scan('[', ']')
  scan('{', '}')

  let content = spliceOut(src, remove)
  if (holdIncomplete) {
    const cut = incompleteHoldIndex(content)
    if (cut !== -1) content = content.slice(0, cut)
  }
  content = tidy(content)
  if (!holdIncomplete && !content && actions.length) content = EMPTY_ACTION_FALLBACK

  return { content, actions: mergeAiActions(actions) }
}

export function displayAiContent(text) {
  return splitDisplayAndActions(text, { holdIncomplete: false }).content
}

export function visibleStreamContent(text) {
  return splitDisplayAndActions(text, { holdIncomplete: true }).content
}

export function extractJsonActions(text) {
  return splitDisplayAndActions(text).actions
}

export function createActionStreamStripper() {
  let raw = ''
  return {
    push(delta) {
      raw += String(delta || '')
      return {
        raw,
        visible: visibleStreamContent(raw),
      }
    },
    finish() {
      const split = splitDisplayAndActions(raw, { holdIncomplete: false })
      return { raw, ...split }
    },
  }
}
