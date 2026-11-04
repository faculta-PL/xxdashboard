/** Assistant Nazix — client : OpenAI via /api/ai (serveur). Repli extractif local si la clé manque. */

const STOP = new Set(
  `le la les un une des de du et ou à a au aux en ce cet cette ces je tu il elle on nous vous ils elles
   mon ma mes ton ta tes son sa ses qui que quoi dont où dans pour par sur avec sans plus moins très pas ne ni
   car mais donc or si comme comment quand quel quelle quels quelles est sont être avoir fait faire cela ça
   d l n s y ai as avons avez ont été être suis es êtes suis été être
   moi toi lui elle nous vous leur leurs dont afin afinque
   note notes idée idées projet projets fichier fichiers budget budgets risque risques
   événement evenement evenements calendrier assistant nazix svp stp merci bonjour salut hello hi ok
   the a an of to for in on with`.split(/\s+/).filter(Boolean),
)

const SNIPPET = 280
const AI_EXTERNAL_KEY = 'nazix_ai_external'
const AI_WEB_KEY = 'nazix_ai_web'

export const FAB_VIEWS = [
  'dashboard',
  'notes',
  'ideas',
  'projects',
  'calendar',
  'files',
  'budget',
  'risks',
  'canvas',
]

export function readLocalFlag(key, fallback = false) {
  try {
    const raw = localStorage.getItem(key)
    if (raw == null) return fallback
    return raw === '1' || raw === 'true'
  } catch {
    return fallback
  }
}

export function writeLocalFlag(key, value) {
  try {
    localStorage.setItem(key, value ? '1' : '0')
  } catch {
    /* ignore */
  }
}

export function readExternalPref() {
  return readLocalFlag(AI_EXTERNAL_KEY, false)
}

export function writeExternalPref(value) {
  writeLocalFlag(AI_EXTERNAL_KEY, value)
}

export function readWebPref() {
  return readLocalFlag(AI_WEB_KEY, false)
}

export function writeWebPref(value) {
  writeLocalFlag(AI_WEB_KEY, value)
}

function clip(text, n = SNIPPET) {
  const s = String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
  if (s.length <= n) return s
  return `${s.slice(0, n - 1)}…`
}

function tokens(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[^a-z0-9]+/i)
    .filter((t) => t.length >= 2 && !STOP.has(t))
}

function overlapScore(queryTokens, itemText, titleBoost = 1) {
  if (!queryTokens.length) return 0
  const bag = new Set(tokens(itemText))
  let hits = 0
  for (const t of queryTokens) {
    if (bag.has(t)) hits += 1
  }
  return hits * titleBoost
}

function money(n, currency = 'EUR') {
  const value = Number(n)
  if (!Number.isFinite(value)) return '—'
  try {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(value)
  } catch {
    return `${value.toFixed(2)} ${currency}`
  }
}

function fmtDay(iso) {
  if (!iso) return '—'
  const day = String(iso).slice(0, 10)
  const d = new Date(`${day}T12:00:00`)
  if (Number.isNaN(d.getTime())) return day
  return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
}

function isOverdue(dateStr) {
  if (!dateStr) return false
  const due = new Date(`${String(dateStr).slice(0, 10)}T23:59:59`)
  if (Number.isNaN(due.getTime())) return false
  return due < new Date()
}

const OPEN_RISK = new Set(['nouveau', "à l'étude", 'en cours'])

export function budgetMath(budget, lines = []) {
  if (!budget) return null
  const related = lines.filter((l) => l.budgetId === budget.id)
  const plannedLines = related
    .filter((l) => l.kind === 'planned')
    .reduce((s, l) => s + Number(l.amount || 0), 0)
  const actualOpen = related.filter((l) => l.kind === 'actual' && l.status !== 'cancelled')
  const actualSum = actualOpen.reduce((s, l) => s + Number(l.amount || 0), 0)
  const paid = actualOpen
    .filter((l) => l.status === 'paid')
    .reduce((s, l) => s + Number(l.amount || 0), 0)
  const plannedTotal = Number(budget.plannedTotal || 0)
  const remaining = plannedTotal - paid
  const pct = plannedTotal > 0 ? Math.round((paid / plannedTotal) * 100) : 0
  return {
    id: budget.id,
    name: budget.name,
    currency: budget.currency || 'EUR',
    plannedTotal,
    plannedLines,
    actualSum,
    paid,
    remaining,
    pct,
    variance: plannedLines - actualSum,
  }
}

function slimNote(n) {
  return {
    id: n.id,
    title: n.title || 'Sans titre',
    snippet: clip(n.content),
    category: n.category || '',
    parentId: n.parentId || null,
    projectId: n.projectId || null,
    updatedAt: n.updatedAt || n.createdAt || '',
  }
}

function slimIdea(i) {
  return {
    id: i.id,
    title: i.title || 'Sans titre',
    snippet: clip(i.description),
    status: i.status || '',
    updatedAt: i.updatedAt || '',
  }
}

function slimProject(p) {
  return {
    id: p.id,
    title: p.title || 'Sans titre',
    snippet: clip(p.description),
    status: p.status || '',
    progress: Number(p.progress || 0),
    dueDate: p.dueDate || '',
  }
}

function slimEvent(e) {
  return {
    id: e.id,
    title: e.title || 'Sans titre',
    snippet: clip(e.description),
    date: e.date || '',
    time: e.time || '',
  }
}

function slimFile(f) {
  return {
    id: f.id,
    title: f.name || 'Fichier',
    name: f.name || 'Fichier',
    ext: f.ext || '',
    projectId: f.projectId || null,
  }
}

function slimRisk(r) {
  return {
    id: r.id,
    title: r.title || 'Sans titre',
    snippet: clip(r.description),
    status: r.status || '',
    priority: r.priority || '',
    dueDate: r.dueDate || '',
    projectId: r.projectId || null,
    open: OPEN_RISK.has(r.status),
    overdue: OPEN_RISK.has(r.status) && isOverdue(r.dueDate),
  }
}

function slimBudget(b, lines) {
  const math = budgetMath(b, lines)
  return {
    id: b.id,
    title: b.name || 'Budget',
    name: b.name || 'Budget',
    projectId: b.projectId || null,
    currency: b.currency || 'EUR',
    ...math,
  }
}

/**
 * Construit un payload de contexte à partir d’entités déjà filtrées (canReadEntity).
 * ids + titres + extraits — pas le contenu privé d’autrui.
 */
export function buildContextPayload({
  section = 'dashboard',
  notes = [],
  ideas = [],
  projects = [],
  events = [],
  files = [],
  budgets = [],
  budgetLines = [],
  risks = [],
  selectedNoteIds = [],
  currentProjectId = '',
  currentBudgetId = '',
} = {}) {
  const noteMap = new Map(notes.map((n) => [n.id, n]))
  const selected = (selectedNoteIds || []).map((id) => noteMap.get(id)).filter(Boolean)
  const recentNotes = [...notes]
    .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))
    .slice(0, 8)
  const sectionNotes =
    section === 'notes' ? (selected.length ? selected : recentNotes) : selected.length ? selected : recentNotes.slice(0, 3)

  const currentProject =
    projects.find((p) => p.id === currentProjectId) ||
    (section === 'projects' && projects.length === 1 ? projects[0] : null)

  const focusBudget =
    budgets.find((b) => b.id === currentBudgetId) ||
    (currentProject ? budgets.find((b) => b.projectId === currentProject.id) : null) ||
    budgets[0] ||
    null

  const upcoming = [...events]
    .filter((e) => e.date)
    .sort((a, b) => `${a.date}${a.time || ''}`.localeCompare(`${b.date}${b.time || ''}`))
    .filter((e) => new Date(`${e.date}T${e.time || '23:59'}`) >= new Date(Date.now() - 3600 * 1000))
    .slice(0, 6)

  const openRisks = risks.filter((r) => OPEN_RISK.has(r.status))
  const overdueRisks = openRisks.filter((r) => isOverdue(r.dueDate))

  const payload = {
    section,
    generatedAt: new Date().toISOString(),
    notes: sectionNotes.map(slimNote),
    ideas: (section === 'ideas' ? ideas : ideas.slice(0, 8)).map(slimIdea),
    projects: (currentProject ? [currentProject] : projects.slice(0, 8)).map(slimProject),
    events: (section === 'calendar' ? events.slice(0, 10) : upcoming).map(slimEvent),
    files: files.slice(0, 12).map(slimFile),
    budgets: (focusBudget ? [focusBudget, ...budgets.filter((b) => b.id !== focusBudget.id)] : budgets)
      .slice(0, 6)
      .map((b) => slimBudget(b, budgetLines)),
    risks: (section === 'risks' ? risks : openRisks).slice(0, 10).map(slimRisk),
    currentProject: currentProject ? slimProject(currentProject) : null,
    currentBudget: focusBudget ? slimBudget(focusBudget, budgetLines) : null,
    counts: {
      notes: notes.length,
      ideas: ideas.length,
      projects: projects.length,
      files: files.length,
      events: events.length,
      budgets: budgets.length,
      risksOpen: openRisks.length,
      risksOverdue: overdueRisks.length,
    },
  }
  payload.contextLabel = contextLabel(payload)
  return payload
}

/** Ex. « Contexte : Notes (3) · Projet X » */
export function contextLabel(ctx) {
  if (!ctx) return 'Contexte : —'
  const bits = []
  if (ctx.notes?.length) bits.push(`Notes (${ctx.notes.length})`)
  if (ctx.currentProject?.title) bits.push(`Projet ${ctx.currentProject.title}`)
  else if (ctx.projects?.length === 1) bits.push(`Projet ${ctx.projects[0].title}`)
  else if (ctx.projects?.length) bits.push(`Projets (${ctx.projects.length})`)
  if (ctx.currentBudget?.name) bits.push(`Budget ${ctx.currentBudget.name}`)
  else if (ctx.budgets?.length) bits.push(`Budgets (${ctx.budgets.length})`)
  if (ctx.risks?.length) bits.push(`Risques (${ctx.risks.length})`)
  if (ctx.files?.length && ctx.section === 'files') bits.push(`Fichiers (${ctx.files.length})`)
  if (ctx.events?.length && (ctx.section === 'calendar' || ctx.section === 'dashboard')) {
    bits.push(`Événements (${ctx.events.length})`)
  }
  if (ctx.ideas?.length && ctx.section === 'ideas') bits.push(`Idées (${ctx.ideas.length})`)
  return bits.length ? `Contexte : ${bits.join(' · ')}` : 'Contexte : (vide)'
}

function cite(items) {
  const titles = [...new Set(items.map((i) => i.title).filter(Boolean))]
  if (!titles.length) return ''
  return `\n\nSources Nazix : ${titles.map((t) => `« ${t} »`).join(', ')}.`
}

function retrieve(query, ctx, limit = 6) {
  const qTokens = tokens(query)
  const pool = []
  const push = (kind, item, extra = '') => {
    const title = item.title || item.name || ''
    const blob = `${title} ${item.snippet || ''} ${extra}`
    const score = qTokens.length
      ? overlapScore(qTokens, title, 3) + overlapScore(qTokens, blob, 1)
      : 0.2
    if (score > 0) pool.push({ kind, ...item, title, score })
  }
  for (const n of ctx.notes || []) push('note', n, n.category)
  for (const i of ctx.ideas || []) push('idée', i, i.status)
  for (const p of ctx.projects || []) push('projet', p, p.status)
  for (const e of ctx.events || []) push('événement', e, `${e.date} ${e.time}`)
  for (const f of ctx.files || []) push('fichier', f, f.ext)
  for (const b of ctx.budgets || []) push('budget', b, b.name)
  for (const r of ctx.risks || []) push('risque', r, `${r.status} ${r.priority}`)
  pool.sort((a, b) => b.score - a.score)
  return pool.slice(0, limit)
}

function sectionBudget(ctx) {
  const rows = ctx.budgets || []
  if (!rows.length) return { text: 'Aucun budget lisible dans le contexte.', items: [] }
  const lines = rows.map((b) => {
    const cur = b.currency || 'EUR'
    return `« ${b.name} » — prévu ${money(b.plannedTotal, cur)}, payé ${money(b.paid, cur)}, restant ${money(b.remaining, cur)} (${b.pct} % consommé).`
  })
  return {
    text: `**Budget**\n${lines.map((l) => `- ${l}`).join('\n')}`,
    items: rows,
  }
}

function sectionRisks(ctx) {
  const overdue = (ctx.risks || []).filter((r) => r.overdue)
  const open = (ctx.risks || []).filter((r) => r.open)
  if (!open.length) return { text: 'Aucun risque ouvert dans le contexte.', items: [] }
  const lines = (overdue.length ? overdue : open).map((r) => {
    const due = r.dueDate ? ` — échéance ${fmtDay(r.dueDate)}` : ''
    const late = r.overdue ? ' (en retard)' : ''
    return `« ${r.title} »${due}${late} · priorité ${r.priority || '—'} · ${r.status}`
  })
  const head = overdue.length ? `**Risques en retard** (${overdue.length})` : `**Risques ouverts** (${open.length})`
  return { text: `${head}\n${lines.map((l) => `- ${l}`).join('\n')}`, items: overdue.length ? overdue : open }
}

function sectionEvents(ctx) {
  const upcoming = ctx.events || []
  if (!upcoming.length) return { text: 'Aucun événement à venir dans le contexte.', items: [] }
  const lines = upcoming.map((e) => `- ${fmtDay(e.date)}${e.time ? ` ${e.time}` : ''} — « ${e.title} »`)
  return { text: `**Prochains événements**\n${lines.join('\n')}`, items: upcoming }
}

function sectionNotes(ctx) {
  const notes = ctx.notes || []
  if (!notes.length) return { text: 'Aucune note sélectionnée dans le contexte.', items: [] }
  const lines = notes.map((n) => `- **« ${n.title} »**${n.snippet ? ` — ${n.snippet}` : ''}`)
  return { text: `**Notes** (${notes.length})\n${lines.join('\n')}`, items: notes }
}

function briefing(ctx) {
  const c = ctx.counts || {}
  const parts = [
    `Vous avez accès à ${c.notes || 0} note(s), ${c.ideas || 0} idée(s), ${c.projects || 0} projet(s), ${c.files || 0} fichier(s).`,
    `${c.risksOpen || 0} risque(s) ouvert(s)${c.risksOverdue ? `, dont ${c.risksOverdue} en retard` : ''}.`,
  ]
  const budget = sectionBudget(ctx)
  const risks = sectionRisks(ctx)
  const events = sectionEvents(ctx)
  const notes = sectionNotes(ctx)
  return [parts.join(' '), notes.text, budget.text, risks.text, events.text].join('\n\n')
}

function detectIntent(query) {
  const q = String(query || '').toLowerCase()
  if (/plus court|raccourci|en bref/.test(q)) return 'short'
  if (/plus d[ée]taill|d[ée]veloppe|approfond/.test(q)) return 'detailed'
  if (/^liste\b|sous forme de liste|en liste/.test(q)) return 'list'
  if (/r[ée]sum|synth[eè]se|r[ée]capi/.test(q)) return 'summarize'
  if (/budget|restant|reste|consomm[ée]|d[ée]pense|salaire/.test(q)) return 'budget'
  if (/retard|risque|alerte|priorit/.test(q)) return 'risks'
  if (/\b[ée]v[ée]nement|calendrier|r[ée]union|prochain/.test(q)) return 'events'
  if (/fichier|document|pdf/.test(q)) return 'files'
  if (/bonjour|salut|hello|hi\b|aide-moi|que peux/.test(q)) return 'briefing'
  return 'retrieve'
}

export function wantsWebSearch(query, webToggle) {
  if (webToggle) return true
  return /cherche en ligne|recherche web|sur le web|google|duckduckgo/i.test(String(query || ''))
}

export function webQueryFrom(query) {
  return String(query || '')
    .replace(/cherche en ligne|recherche web|sur le web|en ligne/gi, '')
    .trim() || String(query || '').trim()
}

function applyStyle(text, style) {
  if (style === 'short') {
    const lines = text
      .split('\n')
      .map((l) => l.replace(/^[-*]\s*/, '').replace(/^\*\*.*\*\*\s*/, '').trim())
      .filter((l) => l && !l.startsWith('Sources'))
      .slice(0, 4)
    return lines.length ? lines.map((l) => `- ${clip(l, 140)}`).join('\n') : clip(text, 280)
  }
  if (style === 'list') {
    const lines = text
      .split(/\n+/)
      .map((l) => l.replace(/^#+\s*/, '').replace(/^\*\*(.+)\*\*/, '$1').replace(/^[-*]\s*/, '').trim())
      .filter((l) => l && !/^sources/i.test(l))
    const items = lines.slice(0, 10)
    return items.map((l, i) => `${i + 1}. ${l}`).join('\n')
  }
  return text
}

/**
 * Réponse extractive locale, en français, avec citations de titres.
 * `style`: '', 'short', 'detailed', 'list'
 */
export function localAnswer(query, ctx, style = '') {
  const intent = style || detectIntent(query)
  const context = ctx || { notes: [], ideas: [], projects: [], events: [], files: [], budgets: [], risks: [], counts: {} }
  let text = ''
  let items = []

  if (intent === 'briefing') {
    text = briefing(context)
    items = [...(context.notes || []), ...(context.budgets || []), ...(context.risks || []), ...(context.events || [])]
  } else if (intent === 'summarize') {
    const notes = sectionNotes(context)
    if (!notes.items.length) {
      text = 'Je n’ai pas trouvé de notes à résumer dans le contexte auquel vous avez accès.'
    } else {
      text = `**Synthèse** (${notes.items.length} note${notes.items.length > 1 ? 's' : ''})\n${notes.items
        .map((n) => `- « ${n.title} » — ${n.snippet || '(pas d’extrait)'}`)
        .join('\n')}`
      items = notes.items
    }
  } else if (intent === 'budget') {
    const b = sectionBudget(context)
    text = b.text
    items = b.items
  } else if (intent === 'risks') {
    const r = sectionRisks(context)
    text = r.text
    items = r.items
  } else if (intent === 'events') {
    const e = sectionEvents(context)
    text = e.text
    items = e.items
  } else if (intent === 'files') {
    const files = context.files || []
    if (!files.length) text = 'Je n’ai pas trouvé de fichiers dans le contexte.'
    else {
      text = `**Fichiers** (${files.length})\n${files.map((f) => `- ${f.name || f.title}`).join('\n')}`
      items = files
    }
  } else if (intent === 'short' || intent === 'list' || intent === 'detailed') {
    const found = retrieve(query, context)
    if (!found.length) {
      text = briefing(context)
      items = context.notes || []
    } else {
      text =
        intent === 'detailed'
          ? found.map((f) => `- **« ${f.title} »** (${f.kind})${f.snippet ? `\n  ${f.snippet}` : ''}`).join('\n')
          : found.map((f) => `- « ${f.title} » (${f.kind})`).join('\n')
      items = found
    }
    text = applyStyle(text, intent === 'detailed' ? '' : intent)
  } else {
    const found = retrieve(query, context)
    if (!found.length) {
      const q = String(query || '').trim()
      if (!q || tokens(q).length === 0) {
        text = briefing(context)
        items = context.notes || []
      } else {
        text = `Je n’ai pas trouvé d’élément correspondant à « ${clip(q, 80)} » dans le contexte auquel vous avez accès (notes, projets, budgets, risques, fichiers, événements lisibles).`
      }
    } else {
      text = `Voici ce que je trouve dans Nazix :\n${found
        .map((f) => `- **« ${f.title} »** (${f.kind})${f.snippet ? ` — ${f.snippet}` : ''}`)
        .join('\n')}`
      items = found
    }
  }

  if (style === 'short' || style === 'list') text = applyStyle(text, style)
  if (items.length) text += cite(items)
  return { text: text.trim(), sources: items.map((i) => ({ id: i.id, title: i.title, kind: i.kind || i.category || '' })) }
}

const ACTION_KINDS = ['create_note', 'create_subnote', 'create_idea', 'create_risk', 'create_budget_line', 'draft_message']
const LAST_N = 20

function extractJsonActions(text) {
  const actions = []
  const push = (parsed) => {
    if (!parsed || typeof parsed !== 'object') return
    const list = Array.isArray(parsed) ? parsed : [parsed]
    for (const item of list) {
      if (item && ACTION_KINDS.includes(item.kind)) {
        actions.push({
          kind: item.kind,
          label: item.label || item.kind,
          draft: item.draft || item,
        })
      }
    }
  }
  const src = String(text || '')
  for (const m of src.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)) {
    try {
      push(JSON.parse(m[1].trim()))
    } catch {
      /* ignore */
    }
  }
  const loose = src.match(
    /\{[^{}]*"kind"\s*:\s*"(create_note|create_subnote|create_idea|create_risk|create_budget_line|draft_message)"[^{}]*\}/g,
  )
  if (loose) {
    for (const raw of loose) {
      try {
        push(JSON.parse(raw))
      } catch {
        /* ignore */
      }
    }
  }
  return actions
}

export function openAiUnavailable(reason) {
  const r = String(reason || 'erreur inconnue').trim() || 'erreur inconnue'
  return `OpenAI indisponible: ${r}`
}

function quotedTitle(query) {
  const m = String(query || '').match(/[«"]([^»"]+)[»"]/)
  if (m) return m[1].trim()
  const after = String(query || '').match(
    /(?:note|sous-note|id[ée]e|risque|ligne|d[ée]pense|message)\s+(?:intitul[ée]e?\s+|sur\s+|:\s*)(.+)$/i,
  )
  if (after) return clip(after[1].replace(/[.?!]$/, ''), 80)
  return ''
}

/** Heuristiques d’actions — jamais exécutées silencieusement. */
export function parseActions(query, ctx = {}) {
  const q = String(query || '')
  const low = q.toLowerCase()
  const actions = []
  const title = quotedTitle(q)
  const parent = (ctx.notes || [])[0]
  const project = ctx.currentProject || (ctx.projects || [])[0]
  const budget = ctx.currentBudget || (ctx.budgets || [])[0]

  if (/sous-note|sous note/.test(low) && /cr[ée]e|ajoute|nouvelle/.test(low)) {
    actions.push({
      kind: 'create_subnote',
      label: 'Créer une sous-note',
      draft: {
        title: title || 'Sous-note',
        content: '',
        parentId: parent?.id || '',
        parentTitle: parent?.title || '',
      },
    })
  } else if (/\bnote\b/.test(low) && /cr[ée]e|ajoute|nouvelle/.test(low)) {
    actions.push({
      kind: 'create_note',
      label: 'Créer une note',
      draft: { title: title || clip(q.replace(/cr[ée]e(r)? (une )?note( intitul[ée]e?)?/i, ''), 80) || 'Nouvelle note', content: '' },
    })
  }
  if (/id[ée]e/.test(low) && /cr[ée]e|ajoute|nouvelle/.test(low)) {
    actions.push({
      kind: 'create_idea',
      label: 'Créer une idée',
      draft: { title: title || 'Nouvelle idée', description: '' },
    })
  }
  if (/risque/.test(low) && /cr[ée]e|ajoute|nouveau/.test(low)) {
    actions.push({
      kind: 'create_risk',
      label: 'Créer un risque',
      draft: {
        title: title || 'Nouveau risque',
        description: '',
        projectId: project?.id || '',
        projectTitle: project?.title || '',
        category: 'autre',
        probability: 'moyenne',
        impact: 'moyen',
      },
    })
  }
  if (/(ligne (budg[ée]taire)?|d[ée]pense|budget)/.test(low) && /cr[ée]e|ajoute|nouvelle/.test(low)) {
    actions.push({
      kind: 'create_budget_line',
      label: 'Créer une ligne budgétaire',
      draft: {
        name: title || 'Nouvelle ligne',
        amount: 0,
        kind: 'planned',
        budgetId: budget?.id || '',
        budgetName: budget?.name || '',
        category: 'Autres',
      },
    })
  }
  if (/message|pr[ée]venir|écrire à|envoi(er)? un message/.test(low) && !/e-?mail de v[ée]rification/.test(low)) {
    actions.push({
      kind: 'draft_message',
      label: 'Brouillon de message',
      draft: { userId: '', body: title || clip(q, 200) },
    })
  }

  for (const a of extractJsonActions(q)) actions.push(a)
  const seen = new Set()
  return actions.filter((a) => {
    if (seen.has(a.kind)) return false
    seen.add(a.kind)
    return true
  })
}

export function parseActionsFromAssistant(text, ctx) {
  const fromText = extractJsonActions(text)
  const heuristic = parseActions(String(text || ''), ctx)
  const seen = new Set()
  return [...fromText, ...heuristic].filter((a) => {
    if (seen.has(a.kind)) return false
    seen.add(a.kind)
    return true
  })
}

export function stripExternalContext(ctx) {
  if (!ctx) return ctx
  const slim = (list) =>
    (list || []).map((item) => ({
      id: item.id,
      title: item.title || item.name,
      kind: item.kind,
    }))
  return {
    section: ctx.section,
    contextLabel: ctx.contextLabel,
    counts: ctx.counts,
    notes: slim(ctx.notes),
    ideas: slim(ctx.ideas),
    projects: slim(ctx.projects),
    events: slim(ctx.events),
    files: slim(ctx.files),
    budgets: (ctx.budgets || []).map((b) => ({
      id: b.id,
      title: b.name || b.title,
      remaining: b.remaining,
      pct: b.pct,
    })),
    risks: (ctx.risks || []).map((r) => ({
      id: r.id,
      title: r.title,
      status: r.status,
      overdue: r.overdue,
    })),
  }
}

export async function fetchAiStatus() {
  try {
    const res = await fetch('/api/ai', { method: 'GET' })
    if (!res.ok) return { mode: 'local', ok: false, hasKey: false, error: `HTTP ${res.status}` }
    return await res.json()
  } catch {
    return { mode: 'local', ok: false, hasKey: false, error: 'serveur IA injoignable' }
  }
}

function slimMessages(messages) {
  return (messages || [])
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && m.content)
    .slice(-LAST_N)
    .map((m) => ({ role: m.role, content: m.content }))
}

export async function askExternal({ messages, context, web, signal }) {
  const res = await fetch('/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: slimMessages(messages),
      context,
      web: web || undefined,
    }),
    signal,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
  if (!data.ok) throw new Error(data.error || 'OPENAI_API_KEY manquante')
  return data
}

function parseSseBuffer(buffer, onEvent) {
  const parts = buffer.split('\n\n')
  const rest = parts.pop() || ''
  for (const part of parts) {
    const line = part.split('\n').find((l) => l.startsWith('data:'))
    if (!line) continue
    const raw = line.slice(5).trim()
    if (!raw || raw === '[DONE]') continue
    try {
      onEvent(JSON.parse(raw))
    } catch {
      /* ignore malformed chunk */
    }
  }
  return rest
}

export async function askExternalStream({ messages, context, web, signal, onDelta }) {
  const res = await fetch('/api/ai/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify({
      messages: slimMessages(messages),
      context,
      web: web || undefined,
    }),
    signal,
  })
  const ct = res.headers.get('content-type') || ''
  if (!ct.includes('text/event-stream')) {
    const data = await res.json().catch(() => ({}))
    if (!res.ok || !data.ok) throw new Error(data.error || `HTTP ${res.status}`)
    if (data.text && onDelta) onDelta(data.text, data.text)
    return data
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || `HTTP ${res.status}`)
  }
  if (!res.body) throw new Error('flux vide')
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let full = ''
  let provider = 'openai'
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    buffer = parseSseBuffer(buffer, (evt) => {
      if (evt.error) throw new Error(evt.error)
      if (evt.provider) provider = evt.provider
      if (evt.delta) {
        full += evt.delta
        if (onDelta) onDelta(evt.delta, full)
      }
      if (evt.done && evt.text && !full) {
        full = evt.text
        if (onDelta) onDelta(evt.text, full)
      }
    })
  }
  if (buffer.trim()) {
    parseSseBuffer(`${buffer}\n\n`, (evt) => {
      if (evt.error) throw new Error(evt.error)
      if (evt.delta) {
        full += evt.delta
        if (onDelta) onDelta(evt.delta, full)
      }
      if (evt.done && evt.text && !full) full = evt.text
    })
  }
  if (!full) throw new Error('Réponse OpenAI vide.')
  return { ok: true, text: full, provider, mode: 'external' }
}

export async function searchWeb(query) {
  const res = await fetch('/api/ai-search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: query }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
  return data
}

export function formatWebBlock(search) {
  if (!search) return ''
  const when = search.searchedAt
    ? new Date(search.searchedAt).toLocaleString('fr-FR')
    : new Date().toLocaleString('fr-FR')
  const results = search.results || []
  if (!results.length) {
    return `\n\n---\n**Web** (DuckDuckGo, ${when}) — aucun résultat instantané.`
  }
  const lines = results.map((r) => {
    const link = r.url ? ` · ${r.url}` : ''
    return `- ${r.title}${r.snippet ? ` — ${r.snippet}` : ''}${link}`
  })
  return `\n\n---\n**Web** (sources externes, ${when}) — ce ne sont pas des faits Nazix.\n${lines.join('\n')}`
}
