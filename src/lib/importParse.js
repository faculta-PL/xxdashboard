/** Parseur d’import Nazix — txt/md/csv/xlsx ; pdf/docx extraits si possible. */
import * as XLSX from 'xlsx'
import { MAX_FILE_BYTES, maxFileSizeLabel, fileExt, BLOCKED_FILE_EXTS } from './files.js'
import { BUDGET_CATEGORIES, RISK_PROBABILITIES, RISK_IMPACTS } from './rbac.js'

export const IMPORT_EXTS = ['txt', 'md', 'docx', 'pdf', 'xlsx', 'csv']
export const IMPORT_TABLE_EXTS = ['csv', 'xlsx']
export const IMPORT_TEXT_EXTS = ['txt', 'md']
export const IMPORT_BINARY_EXTS = ['pdf', 'docx']
export const MAX_IMPORT_CHARS = 50_000

export const IMPORT_DESTINATIONS = [
  { id: 'notes', label: 'Notes' },
  { id: 'note_raw', label: 'Note (texte brut)' },
  { id: 'projects', label: 'Projets' },
  { id: 'files', label: 'Fichiers' },
  { id: 'budget', label: 'Budget' },
  { id: 'risks', label: 'Risques' },
]

const NAME_ALIASES = ['nom', 'name', 'libellé', 'libelle', 'intitulé', 'intitule', 'désignation', 'designation', 'title', 'titre']
const CAT_ALIASES = ['catégorie', 'categorie', 'category', 'cat']
const AMOUNT_ALIASES = ['montant', 'amount', 'somme', 'prix', 'total', 'prévu', 'prevu']
const DATE_ALIASES = ['date', 'jour', 'échéance', 'echeance']
const TITLE_ALIASES = ['titre', 'title', 'nom', 'name', 'risque', 'risk']
const DESC_ALIASES = ['description', 'détail', 'detail', 'details', 'commentaire', 'notes']
const PROBA_ALIASES = ['probabilité', 'probabilite', 'probability', 'proba']
const IMPACT_ALIASES = ['impact']
const DUE_ALIASES = ['échéance', 'echeance', 'due', 'duedate', 'date']

export function basename(name) {
  const base = String(name || 'import').replace(/\.[^.]+$/, '').trim()
  return base || 'Import'
}

export function clipImportText(value) {
  const text = String(value ?? '')
  if (text.length <= MAX_IMPORT_CHARS) return text
  return text.slice(0, MAX_IMPORT_CHARS)
}

/** Titre = premier titre markdown/HTML, sinon nom de fichier ; corps = le reste (ou tout le fichier). */
export function splitTitleAndBody(text, filename) {
  const fullText = clipImportText(text)
  const fileTitle = basename(filename)
  if (!fullText.trim()) {
    return { title: fileTitle, body: '', fullText }
  }
  const lines = fullText.split(/\r?\n/)
  let i = 0
  while (i < lines.length && !String(lines[i]).trim()) i++
  if (i >= lines.length) {
    return { title: fileTitle, body: '', fullText }
  }
  const first = String(lines[i])
  const next = i + 1 < lines.length ? String(lines[i + 1]) : ''
  let heading = ''
  let consumed = 1
  const atx = first.match(/^\s{0,3}#{1,6}\s+(.+?)\s*$/)
  if (atx) heading = atx[1].replace(/\s+#+\s*$/, '').trim()
  const html = first.match(/^\s*<h[1-6][^>]*>(.*?)<\/h[1-6]>\s*$/i)
  if (!heading && html) heading = html[1].replace(/<[^>]+>/g, '').trim()
  if (!heading && next && /^\s{0,3}(=+|-+)\s*$/.test(next) && first.trim()) {
    heading = first.trim()
    consumed = 2
  }
  if (heading) {
    const rest = lines.slice(i + consumed).join('\n').replace(/^\s*\n/, '')
    return { title: heading || fileTitle, body: clipImportText(rest), fullText }
  }
  return { title: fileTitle, body: fullText, fullText }
}

function guessHeader(headers, aliases) {
  const lower = headers.map((h) => String(h || '').toLowerCase().trim())
  for (const alias of aliases) {
    const i = lower.findIndex((h) => h === alias || h.includes(alias))
    if (i >= 0) return headers[i]
  }
  return ''
}

function parseAmountCell(value) {
  if (value == null || value === '') return 0
  if (typeof value === 'number' && Number.isFinite(value)) return Math.abs(value)
  const cleaned = String(value)
    .replace(/\s/g, '')
    .replace(/€|\$/g, '')
    .replace(/\s/g, '')
    .replace(',', '.')
  const n = Number(cleaned)
  return Number.isFinite(n) ? Math.abs(n) : 0
}

function parseDateCell(value) {
  if (!value && value !== 0) return ''
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10)
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    try {
      const d = XLSX.SSF.parse_date_code(value)
      if (d?.y) {
        return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`
      }
    } catch {
      /* ignore */
    }
  }
  const s = String(value).trim()
  const iso = s.match(/^(\d{4}-\d{2}-\d{2})/)
  if (iso) return iso[1]
  const fr = s.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})/)
  if (fr) return `${fr[3]}-${fr[2].padStart(2, '0')}-${fr[1].padStart(2, '0')}`
  return s.slice(0, 10)
}

function matchCategory(value) {
  const s = String(value || '').toLowerCase()
  if (!s) return BUDGET_CATEGORIES[BUDGET_CATEGORIES.length - 1]
  const hit = BUDGET_CATEGORIES.find((c) => c.toLowerCase() === s || s.includes(c.toLowerCase().slice(0, 8)))
  return hit || 'Autres'
}

function mapRiskLevel(value, kind) {
  const s = String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
  const high = ['eleve', 'elevee', 'high', '3', 'fort', 'forte', 'haut', 'haute']
  const mid = ['moyen', 'moyenne', 'medium', '2', 'modere', 'moderee']
  if (high.includes(s)) return kind === 'impact' ? 'élevé' : 'élevée'
  if (mid.includes(s)) return kind === 'impact' ? 'moyen' : 'moyenne'
  if (kind === 'impact') return RISK_IMPACTS.includes(value) ? value : 'faible'
  return RISK_PROBABILITIES.includes(value) ? value : 'faible'
}

function escapeMdCell(value) {
  return String(value ?? '')
    .replace(/\r?\n/g, ' ')
    .replace(/\|/g, '\\|')
}

export function rowsToText(rows, headers) {
  if (!rows.length) return ''
  const cols = headers.length ? headers : Object.keys(rows[0] || {})
  const lines = [cols.join('\t')]
  for (const row of rows) {
    lines.push(cols.map((c) => String(row[c] ?? '')).join('\t'))
  }
  return lines.join('\n')
}

export function rowsToMarkdown(rows, headers) {
  if (!rows.length) return ''
  const cols = headers.length ? headers : Object.keys(rows[0] || {})
  if (!cols.length) return ''
  const header = `| ${cols.map(escapeMdCell).join(' | ')} |`
  const sep = `| ${cols.map(() => '---').join(' | ')} |`
  const body = rows.map((row) => `| ${cols.map((c) => escapeMdCell(row[c])).join(' | ')} |`)
  return [header, sep, ...body].join('\n')
}

export function tableDumpText(rows, headers) {
  const md = rowsToMarkdown(rows, headers)
  return clipImportText(md || rowsToText(rows, headers))
}

function u16(view, offset) {
  return view.getUint16(offset, true)
}
function u32(view, offset) {
  return view.getUint32(offset, true)
}

async function inflateRaw(compressed) {
  if (typeof DecompressionStream !== 'function') {
    throw new Error('Décompression ZIP indisponible')
  }
  const ds = new DecompressionStream('deflate-raw')
  const stream = new Blob([compressed]).stream().pipeThrough(ds)
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

async function zipReadFile(buffer, targetName) {
  const view = new DataView(buffer)
  const bytes = new Uint8Array(buffer)
  let eocd = -1
  const min = Math.max(0, bytes.length - 65557)
  for (let i = bytes.length - 22; i >= min; i--) {
    if (u32(view, i) === 0x06054b50) {
      eocd = i
      break
    }
  }
  if (eocd < 0) return null
  const cdCount = u16(view, eocd + 8)
  let p = u32(view, eocd + 16)
  const wanted = String(targetName).replace(/^\/+/, '')
  for (let i = 0; i < cdCount; i++) {
    if (p + 46 > bytes.length || u32(view, p) !== 0x02014b50) break
    const method = u16(view, p + 10)
    const compSize = u32(view, p + 20)
    const nameLen = u16(view, p + 28)
    const extraLen = u16(view, p + 30)
    const commentLen = u16(view, p + 32)
    const localOff = u32(view, p + 42)
    const name = new TextDecoder().decode(bytes.subarray(p + 46, p + 46 + nameLen))
    if (name === wanted || name.endsWith('/' + wanted)) {
      if (localOff + 30 > bytes.length || u32(view, localOff) !== 0x04034b50) return null
      const lNameLen = u16(view, localOff + 26)
      const lExtra = u16(view, localOff + 28)
      const dataStart = localOff + 30 + lNameLen + lExtra
      const compressed = bytes.subarray(dataStart, dataStart + compSize)
      if (method === 0) return compressed
      if (method === 8) return inflateRaw(compressed)
      return null
    }
    p += 46 + nameLen + extraLen + commentLen
  }
  return null
}

function xmlToText(xml) {
  return String(xml || '')
    .replace(/<w:tab\b[^/]*\/>/g, '\t')
    .replace(/<w:br\b[^/]*\/>/g, '\n')
    .replace(/<\/w:p>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

async function extractDocxText(buffer) {
  const xmlBytes = await zipReadFile(buffer, 'word/document.xml')
  if (!xmlBytes || !xmlBytes.length) return ''
  const xml = new TextDecoder('utf-8', { fatal: false }).decode(xmlBytes)
  return xmlToText(xml)
}

function unescapePdfString(s) {
  return String(s || '')
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\\(/g, '(')
    .replace(/\\\)/g, ')')
    .replace(/\\\\/g, '\\')
    .replace(/\\([0-7]{1,3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)))
}

function printableRatio(text) {
  if (!text) return 0
  let ok = 0
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i)
    if (c === 9 || c === 10 || c === 13 || (c >= 32 && c !== 127)) ok++
  }
  return ok / text.length
}

export function extractPdfText(buffer) {
  let raw = ''
  try {
    raw = new TextDecoder('latin1').decode(buffer instanceof ArrayBuffer ? buffer : new Uint8Array(buffer))
  } catch {
    return ''
  }
  const chunks = []
  const tj = /\((?:\\.|[^\\)])*\)\s*Tj/g
  let m
  while ((m = tj.exec(raw))) {
    const inner = m[0].slice(1, m[0].lastIndexOf(')'))
    chunks.push(unescapePdfString(inner))
  }
  const tjArr = /\[(?:[^\]]*)\]\s*TJ/g
  while ((m = tjArr.exec(raw))) {
    const parts = m[0].match(/\((?:\\.|[^\\)])*\)/g) || []
    chunks.push(parts.map((p) => unescapePdfString(p.slice(1, -1))).join(''))
  }
  const joined = chunks.join('\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
  if (joined && printableRatio(joined) >= 0.7) return joined
  return ''
}

export function validateImportFile(file) {
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
  return { ext, size }
}

function withSplit(meta, rawText) {
  const split = splitTitleAndBody(rawText, meta.name)
  return {
    ...meta,
    ...split,
    text: split.fullText,
    extractable: Boolean(split.fullText.trim()),
  }
}

export function previewBodyForDestination(parsed, destination) {
  if (!parsed) return ''
  if (destination === 'note_raw') return parsed.fullText || parsed.text || ''
  return parsed.body || parsed.fullText || parsed.text || ''
}

export async function parseImportFile(file) {
  const { ext, size } = validateImportFile(file)
  const meta = { name: file.name, ext, size, title: basename(file.name) }

  if (IMPORT_TEXT_EXTS.includes(ext)) {
    const text = await file.text()
    return { kind: 'text', rows: [], headers: [], ...withSplit(meta, text) }
  }

  if (IMPORT_TABLE_EXTS.includes(ext)) {
    const buf = await file.arrayBuffer()
    const wb = XLSX.read(buf, { type: 'array', cellDates: true })
    const sheetName = wb.SheetNames[0]
    if (!sheetName) {
      return {
        kind: 'table',
        text: '',
        fullText: '',
        body: '',
        rows: [],
        headers: [],
        extractable: false,
        ...meta,
      }
    }
    const sheet = wb.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' })
    const headers = rows.length ? Object.keys(rows[0]) : []
    const dump = tableDumpText(rows, headers)
    return {
      kind: 'table',
      rows,
      headers,
      extractable: Boolean(dump.trim()),
      text: dump,
      fullText: dump,
      body: dump,
      ...meta,
    }
  }

  if (ext === 'docx') {
    try {
      const buf = await file.arrayBuffer()
      const text = await extractDocxText(buf)
      if (text.trim()) {
        return { kind: 'text', rows: [], headers: [], ...withSplit(meta, text) }
      }
    } catch {
      /* collage */
    }
  }

  if (ext === 'pdf') {
    try {
      const buf = await file.arrayBuffer()
      const text = extractPdfText(buf)
      if (text.trim()) {
        return { kind: 'text', rows: [], headers: [], ...withSplit(meta, text) }
      }
    } catch {
      /* collage */
    }
  }

  return {
    kind: 'binary',
    text: '',
    fullText: '',
    body: '',
    rows: [],
    headers: [],
    extractable: false,
    pasteHint:
      'Extraction automatique indisponible pour ce format. Collez le texte ci-dessous : il remplira le contenu avant confirmation.',
    ...meta,
  }
}

export function guessBudgetColumns(headers) {
  return {
    name: guessHeader(headers, NAME_ALIASES) || headers[0] || '',
    category: guessHeader(headers, CAT_ALIASES),
    amount: guessHeader(headers, AMOUNT_ALIASES) || headers[1] || '',
    date: guessHeader(headers, DATE_ALIASES),
  }
}

export function guessRiskColumns(headers) {
  return {
    title: guessHeader(headers, TITLE_ALIASES) || headers[0] || '',
    description: guessHeader(headers, DESC_ALIASES),
    probability: guessHeader(headers, PROBA_ALIASES),
    impact: guessHeader(headers, IMPACT_ALIASES),
    dueDate: guessHeader(headers, DUE_ALIASES),
  }
}

export function mapBudgetRows(rows, columns) {
  return rows.map((row, index) => {
    const name = String(row[columns.name] ?? '').trim() || `Ligne ${index + 1}`
    return {
      key: `b${index}`,
      included: true,
      name,
      category: matchCategory(row[columns.category]),
      amount: parseAmountCell(row[columns.amount]),
      date: parseDateCell(row[columns.date]),
    }
  })
}

export function mapRiskRows(rows, columns) {
  return rows.map((row, index) => {
    const title = String(row[columns.title] ?? '').trim() || `Risque ${index + 1}`
    return {
      key: `r${index}`,
      included: true,
      title,
      description: String(row[columns.description] ?? '').trim(),
      probability: mapRiskLevel(row[columns.probability], 'probability'),
      impact: mapRiskLevel(row[columns.impact], 'impact'),
      dueDate: parseDateCell(row[columns.dueDate]),
    }
  })
}
