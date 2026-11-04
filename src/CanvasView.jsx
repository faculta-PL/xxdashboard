import { useEffect, useMemo, useRef, useState } from 'react'
import {
  BoxSelect,
  CalendarDays,
  FileText,
  FolderKanban,
  Lightbulb,
  Plus,
  Search,
  ShieldAlert,
  StickyNote,
  Upload,
  Wallet,
  X,
} from 'lucide-react'
import { saveCanvasLayout, saveNote, getBackendMode } from './lib/store'
import { canWriteRole, entityKey } from './lib/rbac'
import { formatFileSize } from './lib/files'

const inputClass =
  'w-full min-h-11 rounded-xl border border-sage-300 bg-white px-3 py-2.5 text-sage-900 outline-none ring-sage-400 placeholder:text-sage-400 focus:ring-2'
const btnPrimary =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-sage-700 px-4 py-2.5 text-sm font-semibold text-sage-50 transition hover:bg-sage-800 disabled:opacity-50'
const btnGhost =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-sage-300 bg-white/70 px-3 py-2 text-sm font-medium text-sage-800 transition hover:bg-sage-100'

const CARD_W = 220
const CARD_H = 96
const TYPES = [
  { id: 'project', label: 'Projets', icon: FolderKanban },
  { id: 'note', label: 'Notes', icon: StickyNote },
  { id: 'idea', label: 'Idées', icon: Lightbulb },
  { id: 'file', label: 'Fichiers', icon: FileText },
  { id: 'budget', label: 'Budgets', icon: Wallet },
  { id: 'risk', label: 'Risques', icon: ShieldAlert },
  { id: 'event', label: 'Événements', icon: CalendarDays },
]

function LocalBanner() {
  if (getBackendMode() !== 'local') return null
  return (
    <div className="rounded-xl border border-warn/30 bg-warn/10 px-4 py-3 text-sm text-sage-800">
      Mode local — positions et liens non synchronisés entre appareils
    </div>
  )
}

function defaultPos(index) {
  const cols = 3
  return {
    x: 24 + (index % cols) * (CARD_W + 28),
    y: 24 + Math.floor(index / cols) * (CARD_H + 28),
  }
}

function budgetSnippet(budget, lines) {
  const planned = Number(budget.plannedTotal || 0)
  const paid = (lines || [])
    .filter((l) => l.budgetId === budget.id && l.kind === 'actual' && l.status === 'paid')
    .reduce((s, l) => s + Number(l.amount || 0), 0)
  const pct = planned > 0 ? Math.round((paid / planned) * 100) : 0
  return `${pct} % consommé`
}

export default function CanvasView({
  user,
  projects,
  notes,
  ideas,
  files,
  events,
  budgets,
  budgetLines,
  risks,
  links,
  layout,
  flash,
  onImport,
  onOpenModule,
}) {
  const [projectId, setProjectId] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [query, setQuery] = useState('')
  const [positions, setPositions] = useState(layout?.positions || {})
  const [peek, setPeek] = useState(null)
  const [noteOpen, setNoteOpen] = useState(false)
  const [noteForm, setNoteForm] = useState({ title: '', content: '' })
  const boardRef = useRef(null)
  const dragRef = useRef(null)
  const positionsRef = useRef(positions)
  const canEdit = canWriteRole(user)

  useEffect(() => {
    setPositions(layout?.positions || {})
  }, [layout])

  useEffect(() => {
    positionsRef.current = positions
  }, [positions])

  const cards = useMemo(() => {
    const q = query.trim().toLowerCase()
    const match = (...vals) => !q || vals.some((v) => String(v || '').toLowerCase().includes(q))
    const inProject = (entity) => {
      if (!projectId) return true
      if (entity.projectId === projectId) return true
      return (links || []).some((l) => {
        const a = l.fromType === 'project' && l.fromId === projectId && l.toId === entity.id
        const b = l.toType === 'project' && l.toId === projectId && l.fromId === entity.id
        return a || b
      })
    }
    const list = []
    if (!typeFilter || typeFilter === 'project') {
      for (const p of projects) {
        if (projectId && p.id !== projectId) continue
        if (!match(p.title, p.description)) continue
        list.push({
          type: 'project',
          id: p.id,
          title: p.title,
          subtitle: p.status,
          view: 'projects',
          entity: p,
        })
      }
    }
    if (!typeFilter || typeFilter === 'note') {
      for (const n of notes) {
        if (!inProject(n) || !match(n.title, n.content)) continue
        list.push({
          type: 'note',
          id: n.id,
          title: n.title,
          subtitle: n.parentId ? 'Sous-note' : n.category,
          view: 'notes',
          entity: n,
        })
      }
    }
    if (!typeFilter || typeFilter === 'idea') {
      for (const i of ideas) {
        if (!inProject(i) || !match(i.title, i.description)) continue
        list.push({
          type: 'idea',
          id: i.id,
          title: i.title,
          subtitle: i.status,
          view: 'ideas',
          entity: i,
        })
      }
    }
    if (!typeFilter || typeFilter === 'file') {
      for (const f of files) {
        if (!inProject(f) || !match(f.name, f.description)) continue
        list.push({
          type: 'file',
          id: f.id,
          title: f.name,
          subtitle: `${(f.ext || '').toUpperCase()} · ${formatFileSize(f.size)}`,
          view: 'files',
          entity: f,
        })
      }
    }
    if (!typeFilter || typeFilter === 'budget') {
      for (const b of budgets) {
        if (!inProject(b) || !match(b.name)) continue
        list.push({
          type: 'budget',
          id: b.id,
          title: b.name,
          subtitle: budgetSnippet(b, budgetLines),
          view: 'budget',
          entity: b,
        })
      }
    }
    if (!typeFilter || typeFilter === 'risk') {
      for (const r of risks) {
        if (!inProject(r) || !match(r.title, r.description)) continue
        list.push({
          type: 'risk',
          id: r.id,
          title: r.title,
          subtitle: r.priority || r.status,
          view: 'risks',
          entity: r,
        })
      }
    }
    if (!typeFilter || typeFilter === 'event') {
      for (const e of events) {
        if (!inProject(e) || !match(e.title, e.description)) continue
        list.push({
          type: 'event',
          id: e.id,
          title: e.title,
          subtitle: `${e.date || ''} ${e.time || ''}`.trim(),
          view: 'calendar',
          entity: e,
        })
      }
    }
    return list
  }, [projects, notes, ideas, files, events, budgets, budgetLines, risks, links, projectId, typeFilter, query])

  const placed = cards.map((card, index) => {
    const key = entityKey(card.type, card.id)
    const pos = positions[key] || defaultPos(index)
    return { ...card, key, x: pos.x, y: pos.y }
  })

  const visibleKeys = new Set(placed.map((c) => c.key))
  const lines = (links || [])
    .map((link) => {
      const from = entityKey(link.fromType, link.fromId)
      const to = entityKey(link.toType, link.toId)
      if (!visibleKeys.has(from) || !visibleKeys.has(to)) return null
      const a = placed.find((c) => c.key === from)
      const b = placed.find((c) => c.key === to)
      if (!a || !b) return null
      return {
        id: link.id,
        x1: a.x + CARD_W / 2,
        y1: a.y + CARD_H / 2,
        x2: b.x + CARD_W / 2,
        y2: b.y + CARD_H / 2,
      }
    })
    .filter(Boolean)

  const boardW = Math.max(960, ...placed.map((c) => c.x + CARD_W + 48), 24)
  const boardH = Math.max(640, ...placed.map((c) => c.y + CARD_H + 48), 24)

  const persist = async (next) => {
    setPositions(next)
    try {
      await saveCanvasLayout(next, user)
    } catch (err) {
      flash(err.message || 'Positions non enregistrées.', 'err')
    }
  }

  const onPointerDown = (e, card) => {
    if (e.button != null && e.button !== 0) return
    const board = boardRef.current
    if (!board) return
    const rect = board.getBoundingClientRect()
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = {
      key: card.key,
      grabX: e.clientX - rect.left + board.scrollLeft - card.x,
      grabY: e.clientY - rect.top + board.scrollTop - card.y,
      moved: false,
      card,
    }
  }

  const onPointerMove = (e) => {
    const drag = dragRef.current
    if (!drag || !canEdit) return
    const board = boardRef.current
    if (!board) return
    const rect = board.getBoundingClientRect()
    const x = Math.max(8, e.clientX - rect.left + board.scrollLeft - drag.grabX)
    const y = Math.max(8, e.clientY - rect.top + board.scrollTop - drag.grabY)
    if (Math.abs(x - (positions[drag.key]?.x ?? drag.card.x)) > 4 || Math.abs(y - (positions[drag.key]?.y ?? drag.card.y)) > 4) {
      drag.moved = true
    }
    setPositions((prev) => {
      const next = { ...prev, [drag.key]: { x, y } }
      positionsRef.current = next
      return next
    })
  }

  const onPointerUp = async () => {
    const drag = dragRef.current
    dragRef.current = null
    if (!drag) return
    if (!drag.moved) {
      setPeek(drag.card)
      return
    }
    if (canEdit) await persist(positionsRef.current)
  }

  const createNote = async (e) => {
    e.preventDefault()
    try {
      await saveNote(
        {
          title: noteForm.title.trim(),
          content: noteForm.content.trim(),
          category: 'Général',
          tags: [],
          visibility: 'Privée',
          shares: [],
          projectId: projectId || null,
          parentId: null,
        },
        user,
      )
      flash('Note créée.')
      setNoteOpen(false)
      setNoteForm({ title: '', content: '' })
    } catch (err) {
      flash(err.message, 'err')
    }
  }

  return (
    <div className="space-y-4 animate-fade-up">
      <LocalBanner />
      <div className="flex flex-wrap items-center gap-2">
        {canEdit && (
          <>
            <button type="button" className={btnPrimary} onClick={() => setNoteOpen(true)}>
              <Plus size={16} /> Nouvelle note
            </button>
            <button type="button" className={btnGhost} onClick={onImport}>
              <Upload size={16} /> Importer
            </button>
          </>
        )}
        <select className={inputClass + ' max-w-full md:!w-auto'} value={projectId} onChange={(e) => setProjectId(e.target.value)}>
          <option value="">Tous les projets</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>
        <select className={inputClass + ' max-w-full md:!w-auto'} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="">Tous les types</option>
          {TYPES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
        <div className="relative min-w-0 flex-1 basis-full sm:basis-48">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sage-400" size={16} />
          <input
            className={inputClass + ' pl-9'}
            placeholder="Filtrer le canvas…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>
      <p className="text-xs text-sage-500">
        Carte du workspace — les modules restent inchangés. {canEdit ? 'Glissez pour ranger (souris et tactile).' : 'Lecture seule.'}
      </p>

      {placed.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-sage-300 bg-white/50 px-6 py-14 text-center">
          <BoxSelect className="mx-auto text-sage-400" size={28} />
          <p className="mt-3 font-display text-xl text-sage-800">Espace visuel vide</p>
          <p className="mt-2 text-sm text-sage-600">Ajoutez une note ou importez un fichier, ou créez des contenus dans les modules.</p>
        </div>
      ) : (
        <div
          ref={boardRef}
          className="relative max-h-[70vh] overflow-auto rounded-2xl border border-sage-200 bg-sage-100/40 xx-scroll"
        >
          <div className="relative" style={{ width: boardW, height: boardH }}>
            <svg className="pointer-events-none absolute inset-0 h-full w-full" width={boardW} height={boardH}>
              {lines.map((l) => (
                <line
                  key={l.id}
                  x1={l.x1}
                  y1={l.y1}
                  x2={l.x2}
                  y2={l.y2}
                  stroke="#8a9a7b"
                  strokeWidth="2"
                  strokeDasharray="6 4"
                />
              ))}
            </svg>
            {placed.map((card) => {
              const meta = TYPES.find((t) => t.id === card.type)
              const Icon = meta?.icon || FileText
              return (
                <button
                  key={card.key}
                  type="button"
                  className="absolute touch-none rounded-2xl border border-sage-200 bg-white/95 p-3 text-left shadow-sm hover:border-sage-400"
                  style={{ left: card.x, top: card.y, width: CARD_W, height: CARD_H }}
                  onPointerDown={(e) => onPointerDown(e, card)}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  onPointerCancel={onPointerUp}
                >
                  <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-sage-500">
                    <Icon size={14} /> {meta?.label || card.type}
                  </p>
                  <p className="mt-1 line-clamp-2 font-medium text-sage-900">{card.title}</p>
                  <p className="mt-0.5 truncate text-xs text-sage-500">{card.subtitle}</p>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {peek && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-3">
          <button type="button" className="absolute inset-0" aria-label="Fermer" onClick={() => setPeek(null)} />
          <div className="relative z-10 w-full max-w-lg rounded-t-2xl bg-sage-50 p-5 shadow-xl sm:rounded-2xl">
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-semibold uppercase text-sage-500">{peek.type}</p>
                <h3 className="font-display text-xl text-sage-900">{peek.title}</h3>
              </div>
              <button type="button" className="rounded-lg p-2 hover:bg-sage-200" onClick={() => setPeek(null)}>
                <X size={16} />
              </button>
            </div>
            <p className="whitespace-pre-wrap text-sm text-sage-700">
              {peek.entity.content || peek.entity.description || peek.subtitle || '—'}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                className={btnPrimary}
                onClick={() => {
                  onOpenModule?.(peek.view)
                  setPeek(null)
                }}
              >
                Ouvrir le module
              </button>
              <button type="button" className={btnGhost} onClick={() => setPeek(null)}>
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {noteOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-3">
          <button type="button" className="absolute inset-0" aria-label="Fermer" onClick={() => setNoteOpen(false)} />
          <form
            onSubmit={createNote}
            className="relative z-10 w-full max-w-lg rounded-t-2xl bg-sage-50 p-5 shadow-xl sm:rounded-2xl"
          >
            <h3 className="mb-3 font-display text-xl text-sage-900">Nouvelle note</h3>
            <label className="mb-3 block text-sm">
              <span className="mb-1 block font-medium text-sage-800">Titre</span>
              <input
                className={inputClass}
                value={noteForm.title}
                onChange={(e) => setNoteForm({ ...noteForm, title: e.target.value })}
                required
              />
            </label>
            <label className="mb-3 block text-sm">
              <span className="mb-1 block font-medium text-sage-800">Contenu</span>
              <textarea
                className={inputClass + ' min-h-24'}
                value={noteForm.content}
                onChange={(e) => setNoteForm({ ...noteForm, content: e.target.value })}
              />
            </label>
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <button type="button" className={btnGhost} onClick={() => setNoteOpen(false)}>
                Annuler
              </button>
              <button type="submit" className={btnPrimary}>
                Enregistrer
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
