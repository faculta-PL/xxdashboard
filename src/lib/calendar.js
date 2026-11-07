/** Grille calendrier Nazix — mois / semaine, dates ISO, libellés FR. */

export const WEEKDAYS_FR = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

export const MONTHS_FR = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
]

export function pad2(n) {
  return String(n).padStart(2, '0')
}

export function toIsoDate(value) {
  if (!value && value !== 0) return ''
  if (typeof value === 'string') {
    const m = value.trim().match(/^(\d{4}-\d{2}-\d{2})/)
    if (m) return m[1]
  }
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

export function parseIsoDate(iso) {
  const s = toIsoDate(iso)
  if (!s) return null
  const [y, m, d] = s.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  if (Number.isNaN(date.getTime())) return null
  return date
}

export function addMonths(year, month, delta) {
  const d = new Date(year, month + delta, 1)
  return { year: d.getFullYear(), month: d.getMonth() }
}

export function startOfWeek(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const dow = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - dow)
  return d
}

export function weekDates(anchor) {
  const start = startOfWeek(anchor instanceof Date ? anchor : parseIsoDate(anchor) || new Date())
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return toIsoDate(d)
  })
}

export function monthCells(year, month) {
  const first = new Date(year, month, 1)
  const startDow = (first.getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells = []
  for (let i = 0; i < startDow; i++) {
    const d = new Date(year, month, 1 - (startDow - i))
    cells.push({ iso: toIsoDate(d), day: d.getDate(), inMonth: false })
  }
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ iso: `${year}-${pad2(month + 1)}-${pad2(day)}`, day, inMonth: true })
  }
  while (cells.length % 7) {
    const last = parseIsoDate(cells[cells.length - 1].iso)
    const d = new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1)
    cells.push({ iso: toIsoDate(d), day: d.getDate(), inMonth: false })
  }
  return cells
}

export const MONTHS_EN = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

export const WEEKDAYS_EN = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function formatMonthTitle(year, month, lang = 'fr') {
  const months = String(lang).startsWith('en') ? MONTHS_EN : MONTHS_FR
  return `${months[month] || ''} ${year}`.trim()
}

export function formatDayLong(iso, lang = 'fr') {
  const d = parseIsoDate(iso)
  if (!d) return iso || ''
  const weekdays =
    String(lang).startsWith('en')
      ? ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
      : ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']
  const months = String(lang).startsWith('en') ? MONTHS_EN : MONTHS_FR
  const weekday = weekdays[d.getDay()]
  return `${weekday} ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`
}

export function eventDateKey(event) {
  return toIsoDate(event?.date || '')
}

export function eventsOnDate(events, iso) {
  const key = toIsoDate(iso)
  if (!key) return []
  return (events || [])
    .filter((ev) => eventDateKey(ev) === key)
    .sort((a, b) => String(a.time || '').localeCompare(String(b.time || '')))
}

export function groupEventsByDate(events) {
  const map = {}
  for (const ev of events || []) {
    const key = eventDateKey(ev)
    if (!key) continue
    ;(map[key] ||= []).push(ev)
  }
  for (const key of Object.keys(map)) {
    map[key].sort((a, b) => String(a.time || '').localeCompare(String(b.time || '')))
  }
  return map
}
