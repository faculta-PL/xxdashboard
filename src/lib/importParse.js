/** Parseur d’import Nazix — txt/md/csv/xlsx ; pdf/docx en fichier + collage. */
import * as XLSX from 'xlsx'
import { MAX_FILE_BYTES, maxFileSizeLabel, fileExt, BLOCKED_FILE_EXTS } from './files'
import { BUDGET_CATEGORIES, RISK_PROBABILITIES, RISK_IMPACTS } from './rbac'

export const IMPORT_EXTS = ['txt', 'md', 'docx', 'pdf', 'xlsx', 'csv']
export const IMPORT_TABLE_EXTS = ['csv', 'xlsx']
export const IMPORT_TEXT_EXTS = ['txt', 'md']
export const IMPORT_BINARY_EXTS = ['pdf', 'docx']

export const IMPORT_DESTINATIONS = [
  { id: 'notes', label: 'Notes' },
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

function basename(name) {
  const base = String(name || 'import').replace(/\.[^.]+$/, '').trim()
  return base || 'Import'
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

function rowsToText(rows, headers) {
  if (!rows.length) return ''
  const cols = headers.length ? headers : Object.keys(rows[0] || {})
  const lines = [cols.join('\t')]
  for (const row of rows) {
    lines.push(cols.map((c) => String(row[c] ?? '')).join('\t'))
  }
  return lines.join('\n')
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

export async function parseImportFile(file) {
  const { ext, size } = validateImportFile(file)
  const title = basename(file.name)
  const meta = { name: file.name, ext, size, title }

  if (IMPORT_TEXT_EXTS.includes(ext)) {
    const text = await file.text()
    return { kind: 'text', text, rows: [], headers: [], extractable: true, ...meta }
  }

  if (IMPORT_TABLE_EXTS.includes(ext)) {
    const buf = await file.arrayBuffer()
    const wb = XLSX.read(buf, { type: 'array', cellDates: true })
    const sheetName = wb.SheetNames[0]
    if (!sheetName) {
      return { kind: 'table', text: '', rows: [], headers: [], extractable: true, ...meta }
    }
    const sheet = wb.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' })
    const headers = rows.length ? Object.keys(rows[0]) : []
    return {
      kind: 'table',
      text: rowsToText(rows, headers),
      rows,
      headers,
      extractable: true,
      ...meta,
    }
  }

  return {
    kind: 'binary',
    text: '',
    rows: [],
    headers: [],
    extractable: false,
    pasteHint: 'Extraction automatique indisponible pour ce format. Collez le texte ci-dessous si besoin, le fichier original sera conservé.',
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
