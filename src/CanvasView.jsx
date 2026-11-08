import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
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
import { useI18n, valueLabel, formatDateTime, formatDate, dateLocale } from './i18n'
import { DocumentBody } from './NoteMedia'
import { EmptyState, StatusBadge, VisibilityBadge, formatMoney, inputClass, btnPrimary, btnGhost } from './components/ui'

const CARD_W = 220
const CARD_H = 104

const TYPE_META = [
  { id: 'project', icon: FolderKanban, labelKey: 'canvas.typeProject' },
  { id: 'note', icon: StickyNote, labelKey: 'canvas.typeNote' },
  { id: 'idea', icon: Lightbulb, labelKey: 'canvas.typeIdea' },
  { id: 'file', icon: FileText, labelKey: 'canvas.typeFile' },
  { id: 'budget', icon: Wallet, labelKey: 'canvas.typeBudget' },
  { id: 'risk', icon: ShieldAlert, labelKey: 'canvas.typeRisk' },
  { id: 'event', icon: CalendarDays, labelKey: 'canvas.typeEvent' },
]

function LocalBanner({ t }) {
  if (getBackendMode() !== 'local') return null
  return (
    <div className="rounded-xl border border-warn/30 bg-warn/10 px-4 py-3 text-sm text-sage-800">
      {t('canvas.localBanner')}
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

function budgetFigures(budget, lines) {
  const planned = Number(budget.plannedTotal || 0)
  const paid = (lines || [])
    .filter((l) => l.budgetId === budget.id && l.kind === 'actual' && l.status === 'paid')
    .reduce((s, l) => s + Number(l.amount || 0), 0)
  const remaining = planned - paid
  const pct = planned > 0 ? Math.round((paid / planned) * 100) : 0
  return { planned, paid, remaining, pct }
}

function entityWhen(entity) {
  return entity?.updatedAt || entity?.createdAt || entity?.date || entity?.uploadedAt || ''
}

function entityOwner(entity, users) {
  const id = entity?.ownerId || entity?.uploadedBy || entity?.leadId
  if (!id) return entity?.ownerEmail || ''
  const u = users?.find((x) => x.id === id)
  return u?.fullName || entity?.ownerEmail || ''
}

function MetaGrid({ rows }) {
  const visible = rows.filter((r) => r.value !== '' && r.value != null)
  if (!visible.length) return null
  return (
    <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {visible.map((row) => (
        <div key={row.label} className="rounded-xl bg-white/80 px-3 py-2">
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-sage-500">{row.label}</dt>
          <dd className="mt-0.5 break-words text-sm font-medium text-sage-900">{row.value}</dd>
        </div>
      ))}
    </dl>
  )
}

function PeekBody({ peek, budgetLines, users, folders = [], t, lang }) {
  const entity = peek.entity || {}
  const locale = dateLocale(lang)
  if (peek.type === 'note') {
    return <DocumentBody content={entity.content} imageUrl={entity.imageUrl} />
  }
  if (peek.type === 'project') {
    return (
      <div className="space-y-3">
        <MetaGrid
          rows={[
            { label: t('canvas.fieldStatus'), value: <StatusBadge value={valueLabel(lang, entity.status)} /> },
            { label: t('canvas.fieldProgress'), value: `${Number(entity.progress || 0)} %` },
            { label: t('canvas.fieldLead'), value: entityOwner(entity, users) },
            { label: t('canvas.fieldDate'), value: [formatDate(lang, entity.startDate), formatDate(lang, entity.dueDate)].filter(Boolean).join(' → ') },
          ]}
        />
        <DocumentBody content={entity.description} />
      </div>
    )
  }
  if (peek.type === 'budget') {
    const fig = budgetFigures(entity, budgetLines)
    return (
      <div className="space-y-3">
        <MetaGrid
          rows={[
            { label: t('canvas.fieldPlanned'), value: formatMoney(fig.planned, entity.currency, locale) },
            { label: t('canvas.fieldPaid'), value: formatMoney(fig.paid, entity.currency, locale) },
            { label: t('canvas.fieldRemaining'), value: formatMoney(fig.remaining, entity.currency, locale) },
            { label: t('canvas.fieldStatus'), value: t('canvas.consumed', { n: fig.pct }) },
          ]}
        />
      </div>
    )
  }
  if (peek.type === 'idea') {
    return (
      <div className="space-y-3">
        <MetaGrid rows={[{ label: t('canvas.fieldStatus'), value: <StatusBadge value={valueLabel(lang, entity.status)} /> }]} />
        <DocumentBody content={entity.description} />
      </div>
    )
  }
  if (peek.type === 'risk') {
    return (
      <div className="space-y-3">
        <MetaGrid
          rows={[
            { label: t('canvas.fieldPriority'), value: valueLabel(lang, entity.priority) },
            { label: t('canvas.fieldStatus'), value: valueLabel(lang, entity.status) },
            { label: t('canvas.fieldDate'), value: formatDate(lang, entity.dueDate) },
          ]}
        />
        <DocumentBody content={entity.description} />
      </div>
    )
  }
  if (peek.type === 'file') {
    return (
      <div className="space-y-3">
        <MetaGrid
          rows={[
            { label: t('canvas.fieldSize'), value: `${(entity.ext || '').toUpperCase()} · ${formatFileSize(entity.size)}` },
            {
              label: t('canvas.fieldFolder'),
              value: entity.folderId
                ? folders.find((f) => f.id === entity.folderId)?.name || t('filesUi.root')
                : t('filesUi.root'),
            },
          ]}
        />
        <DocumentBody content={entity.description} />
      </div>
    )
  }
  if (peek.type === 'event') {
    return (
      <div className="space-y-3">
        <MetaGrid
          rows={[
            { label: t('canvas.fieldDate'), value: formatDate(lang, entity.date) },
            { label: t('canvas.fieldTime'), value: entity.time || '' },
          ]}
        />
        <DocumentBody content={entity.description} />
      </div>
    )
  }
  return <DocumentBody content={entity.content || entity.description || peek.subtitle} />
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
  users = [],
  folders = [],
}) {
  const { t, lang } = useI18n()
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
  const peekBodyRef = useRef(null)
  const noteBodyRef = useRef(null)
  const canEdit = canWriteRole(user)

  useEffect(() => {
    setPositions(layout?.positions || {})
  }, [layout])

  useEffect(() => {
    positionsRef.current = positions
  }, [positions])

  useEffect(() => {
    if (!peek) return undefined
    const frame = window.requestAnimationFrame(() => {
      if (peekBodyRef.current) peekBodyRef.current.scrollTop = 0
    })
    return () => window.cancelAnimationFrame(frame)
  }, [peek])

  useEffect(() => {
    if (!noteOpen) return undefined
    const frame = window.requestAnimationFrame(() => {
      if (noteBodyRef.current) noteBodyRef.current.scrollTop = 0
    })
    return () => window.cancelAnimationFrame(frame)
  }, [noteOpen])

  const typeLabel = (id) => {
    const meta = TYPE_META.find((x) => x.id === id)
    return meta ? t(meta.labelKey) : id
  }

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
          subtitle: valueLabel(lang, p.status),
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
          subtitle: n.parentId ? t('canvas.subnote') : valueLabel(lang, n.category),
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
          subtitle: valueLabel(lang, i.status),
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
        const fig = budgetFigures(b, budgetLines)
        list.push({
          type: 'budget',
          id: b.id,
          title: b.name,
          subtitle: t('canvas.consumed', { n: fig.pct }),
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
          subtitle: valueLabel(lang, r.priority || r.status),
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
          subtitle: `${formatDate(lang, e.date)} ${e.time || ''}`.trim(),
          view: 'calendar',
          entity: e,
        })
      }
    }
    return list
  }, [projects, notes, ideas, files, events, budgets, budgetLines, risks, links, projectId, typeFilter, query, lang, t])

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
      flash(err.message || t('common.localBanner'), 'err')
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
          content: noteForm.content.trimEnd(),
          category: 'Général',
          tags: [],
          visibility: 'Privée',
          shares: [],
          projectId: projectId || null,
          parentId: null,
        },
        user,
      )
      flash(t('notes.created'))
      setNoteOpen(false)
      setNoteForm({ title: '', content: '' })
    } catch (err) {
      flash(err.message, 'err')
    }
  }

  const peekMeta = peek ? TYPE_META.find((x) => x.id === peek.type) : null
  const PeekIcon = peekMeta?.icon || FileText
  const peekOwner = peek ? entityOwner(peek.entity, users) : ''
  const peekWhen = peek ? entityWhen(peek.entity) : ''

  return (
    <div className="space-y-4 animate-fade-up">
      <LocalBanner t={t} />
      <div className="flex flex-wrap items-center gap-2">
        {canEdit && (
          <>
            <button type="button" className={btnPrimary} onClick={() => setNoteOpen(true)}>
              <Plus size={16} /> {t('canvas.newNote')}
            </button>
            <button type="button" className={btnGhost} onClick={onImport}>
              <Upload size={16} /> {t('canvas.import')}
            </button>
          </>
        )}
        <select className={inputClass + ' max-w-full md:!w-auto'} value={projectId} onChange={(e) => setProjectId(e.target.value)}>
          <option value="">{t('canvas.allProjects')}</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>
        <select className={inputClass + ' max-w-full md:!w-auto'} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="">{t('canvas.allTypes')}</option>
          {TYPE_META.map((row) => (
            <option key={row.id} value={row.id}>
              {t(row.labelKey)}
            </option>
          ))}
        </select>
        <div className="relative min-w-0 flex-1 basis-full sm:basis-48">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sage-400" size={16} />
          <input
            className={inputClass + ' pl-9'}
            placeholder={t('canvas.filter')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>
      <p className="text-xs text-sage-500">{canEdit ? t('canvas.hintEdit') : t('canvas.hintRead')}</p>

      {placed.length === 0 ? (
        <EmptyState
          icon={BoxSelect}
          title={t('canvas.empty')}
          hint={t('canvas.emptyHint')}
          action={
            canEdit ? (
              <button type="button" className={btnPrimary + ' mt-4'} onClick={() => setNoteOpen(true)}>
                <Plus size={16} /> {t('canvas.newNote')}
              </button>
            ) : null
          }
        />
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
              const meta = TYPE_META.find((row) => row.id === card.type)
              const Icon = meta?.icon || FileText
              return (
                <button
                  key={card.key}
                  type="button"
                  className="absolute touch-none overflow-hidden rounded-2xl border border-sage-200 bg-white/95 p-3 text-left shadow-sm hover:border-sage-400"
                  style={{ left: card.x, top: card.y, width: CARD_W, height: CARD_H }}
                  onPointerDown={(e) => onPointerDown(e, card)}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  onPointerCancel={onPointerUp}
                >
                  <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-sage-500">
                    <Icon size={13} /> {typeLabel(card.type)}
                  </p>
                  <p className="mt-1 line-clamp-2 break-words font-medium leading-snug text-sage-900">{card.title}</p>
                  <p className="mt-0.5 truncate text-xs text-sage-500">{card.subtitle}</p>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {peek &&
        createPortal(
          <div
            className="fixed inset-0 z-[80] flex items-end justify-center bg-ink/45 p-0 sm:items-center sm:p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="nazix-canvas-peek-title"
          >
            <button type="button" className="absolute inset-0" aria-label={t('common.close')} onClick={() => setPeek(null)} />
            <div className="relative z-10 flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-sage-50 shadow-2xl sm:rounded-2xl">
              <div className="sticky top-0 z-20 shrink-0 border-b border-sage-200 bg-sage-50 px-5 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="inline-flex items-center gap-1.5 rounded-full bg-sage-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-sage-700">
                      <PeekIcon size={12} /> {typeLabel(peek.type)}
                    </p>
                    <h3 id="nazix-canvas-peek-title" className="mt-1.5 break-words font-display text-xl leading-snug text-sage-900">
                      {peek.title}
                    </h3>
                    <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-sage-500">
                      {peek.entity?.visibility ? <VisibilityBadge value={peek.entity.visibility} /> : null}
                      {peekOwner ? <span>{peekOwner}</span> : null}
                      {peekWhen ? <span>{formatDateTime(lang, peekWhen)}</span> : null}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg p-2 text-sage-600 hover:bg-sage-200"
                    onClick={() => setPeek(null)}
                    aria-label={t('common.close')}
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
              <div ref={peekBodyRef} className="min-h-0 flex-1 overflow-y-auto px-5 py-4 xx-scroll">
                <PeekBody peek={peek} budgetLines={budgetLines} users={users} folders={folders} t={t} lang={lang} />
              </div>
              <div className="sticky bottom-0 z-20 flex shrink-0 flex-col-reverse gap-2 border-t border-sage-200 bg-sage-50 px-5 py-3 sm:flex-row sm:justify-end pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                <button type="button" className={btnGhost + ' w-full sm:w-auto'} onClick={() => setPeek(null)}>
                  {t('common.close')}
                </button>
                <button
                  type="button"
                  className={btnPrimary + ' w-full sm:w-auto'}
                  onClick={() => {
                    onOpenModule?.(peek.view)
                    setPeek(null)
                  }}
                >
                  {t('canvas.openModule')}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {noteOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[80] flex items-end justify-center bg-ink/45 p-0 sm:items-center sm:p-4"
            role="dialog"
            aria-modal="true"
          >
            <button type="button" className="absolute inset-0" aria-label={t('common.close')} onClick={() => setNoteOpen(false)} />
            <form
              onSubmit={createNote}
              className="relative z-10 flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-sage-50 shadow-2xl sm:rounded-2xl"
            >
              <div className="sticky top-0 shrink-0 border-b border-sage-200 px-5 py-3">
                <h3 className="font-display text-xl text-sage-900">{t('notes.new')}</h3>
              </div>
              <div ref={noteBodyRef} className="min-h-0 flex-1 overflow-y-auto px-5 py-4 xx-scroll">
                <label className="mb-3 block text-sm">
                  <span className="mb-1 block font-medium text-sage-800">{t('notes.title')}</span>
                  <input
                    className={inputClass}
                    value={noteForm.title}
                    onChange={(e) => setNoteForm({ ...noteForm, title: e.target.value })}
                    required
                  />
                </label>
                <label className="mb-3 block text-sm">
                  <span className="mb-1 block font-medium text-sage-800">{t('notes.content')}</span>
                  <textarea
                    className={inputClass + ' min-h-36 whitespace-pre-wrap'}
                    value={noteForm.content}
                    onChange={(e) => setNoteForm({ ...noteForm, content: e.target.value })}
                  />
                </label>
              </div>
              <div className="sticky bottom-0 flex shrink-0 flex-col-reverse gap-2 border-t border-sage-200 bg-sage-50 px-5 py-3 sm:flex-row sm:justify-end pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                <button type="button" className={btnGhost} onClick={() => setNoteOpen(false)}>
                  {t('common.cancel')}
                </button>
                <button type="submit" className={btnPrimary}>
                  {t('common.save')}
                </button>
              </div>
            </form>
          </div>,
          document.body,
        )}
    </div>
  )
}
