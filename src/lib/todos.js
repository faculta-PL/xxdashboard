/** Tâches — parsing, regroupement, constantes. Pas d’I/O. */

export const LIST_COLORS = [
  '#3f6b54',
  '#2f6f8f',
  '#8a5a2b',
  '#7a3e4a',
  '#5c4d8a',
  '#3d6b4f',
  '#8a6a2f',
  '#4d5c63',
]

export const TODO_PRIORITIES = ['low', 'medium', 'high', 'urgent']
export const TODO_STATUSES = ['todo', 'doing', 'done']

const PRIORITY_ALIASES = {
  low: 'low',
  faible: 'low',
  basse: 'low',
  bas: 'low',
  medium: 'medium',
  med: 'medium',
  moyenne: 'medium',
  moyen: 'medium',
  high: 'high',
  haute: 'high',
  haut: 'high',
  elevee: 'high',
  urgent: 'urgent',
  urgente: 'urgent',
}

const PRIORITY_RANK = { urgent: 0, high: 1, medium: 2, low: 3 }

export function todayIso(now = new Date()) {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function addDaysIso(iso, days) {
  const [y, m, d] = String(iso || '').split('-').map(Number)
  if (!y || !m || !d) return ''
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + days)
  return todayIso(dt)
}

function foldWord(word) {
  return String(word || '')
    .toLowerCase()
    .replace(/[’']/g, '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
}

function stripEdgePunct(token) {
  return String(token || '').replace(/^[^\p{L}\p{N}!#]+|[^\p{L}\p{N}]+$/gu, '')
}

export function parseQuickAdd(raw, { today } = {}) {
  const base = today || todayIso()
  const tags = []
  let priority = ''
  let dueDate = ''
  const titleTokens = []
  const tokens = String(raw || '').trim().split(/\s+/).filter(Boolean)
  for (const original of tokens) {
    const token = stripEdgePunct(original)
    if (!token) continue
    if (token.startsWith('!') && token.length > 1) {
      const key = foldWord(token.slice(1))
      const mapped = PRIORITY_ALIASES[key]
      if (mapped) {
        priority = mapped
        continue
      }
    }
    if (token.startsWith('#') && token.length > 1) {
      const tag = token
        .slice(1)
        .toLowerCase()
        .replace(/[^\p{L}\p{N}_-]/gu, '')
      if (tag) tags.push(tag)
      continue
    }
    const word = foldWord(token)
    if (word === 'demain' || word === 'tomorrow') {
      dueDate = addDaysIso(base, 1)
      continue
    }
    if (word === 'aujourdhui' || word === 'today') {
      dueDate = base
      continue
    }
    titleTokens.push(original.replace(/[.,;:]+$/g, ''))
  }
  return {
    title: titleTokens.join(' ').replace(/\s+/g, ' ').trim(),
    priority: priority || 'medium',
    tags: [...new Set(tags)].slice(0, 12),
    dueDate,
  }
}

export function taskBucket(task, today = todayIso()) {
  if (task?.status === 'done') return 'done'
  const due = String(task?.dueDate || '')
  if (!due) return 'none'
  if (due < today) return 'overdue'
  if (due === today) return 'today'
  return 'upcoming'
}

export function isMineTask(task, user) {
  if (!task || !user) return false
  if (task.assigneeId) return task.assigneeId === user.id
  return task.ownerId === user.id
}

export function matchesTodoFilter(task, filter, user, today = todayIso()) {
  if (!filter || filter === 'all') return true
  if (filter === 'mine') return isMineTask(task, user)
  if (filter === 'today') return task?.status !== 'done' && task?.dueDate === today
  if (filter === 'overdue') return task?.status !== 'done' && Boolean(task?.dueDate) && task.dueDate < today
  if (filter === 'high') {
    return task?.status !== 'done' && (task?.priority === 'high' || task?.priority === 'urgent')
  }
  return true
}

export function matchesTodoSearch(task, query) {
  const q = String(query || '').trim().toLowerCase()
  if (!q) return true
  const tags = Array.isArray(task?.tags) ? task.tags.join(' ') : ''
  const hay = `${task?.title || ''} ${task?.description || ''} ${tags}`.toLowerCase()
  return hay.includes(q)
}

export function subtaskProgress(task) {
  const subs = Array.isArray(task?.subtasks) ? task.subtasks : []
  if (!subs.length) return task?.status === 'done' ? 100 : 0
  const done = subs.filter((s) => s.done).length
  return Math.round((done / subs.length) * 100)
}

export function priorityLabelKey(priority) {
  if (priority === 'low') return 'todos.priorityLow'
  if (priority === 'high') return 'todos.priorityHigh'
  if (priority === 'urgent') return 'todos.priorityUrgent'
  return 'todos.priorityMedium'
}

export function statusLabelKey(status) {
  if (status === 'doing') return 'todos.statusDoing'
  if (status === 'done') return 'todos.statusDone'
  return 'todos.statusTodo'
}

export const BUCKET_ORDER = ['today', 'upcoming', 'overdue', 'none', 'done']

const BUCKET_KEYS = {
  today: 'todos.groupToday',
  upcoming: 'todos.groupUpcoming',
  overdue: 'todos.groupOverdue',
  none: 'todos.groupNoDate',
  done: 'todos.groupDone',
}

export function bucketLabelKey(bucket) {
  return BUCKET_KEYS[bucket] || 'todos.groupNoDate'
}

export function sortTasks(tasks) {
  return [...tasks].sort((a, b) => {
    const pr = (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9)
    if (pr) return pr
    const ad = String(a.dueDate || '9999-99-99')
    const bd = String(b.dueDate || '9999-99-99')
    if (ad !== bd) return ad < bd ? -1 : 1
    return String(a.title || '').localeCompare(String(b.title || ''), undefined, { sensitivity: 'base' })
  })
}

export function groupTasks(tasks, today = todayIso()) {
  const groups = { today: [], upcoming: [], overdue: [], none: [], done: [] }
  for (const task of tasks) {
    const bucket = taskBucket(task, today)
    groups[bucket].push(task)
  }
  for (const key of BUCKET_ORDER) groups[key] = sortTasks(groups[key])
  return groups
}
