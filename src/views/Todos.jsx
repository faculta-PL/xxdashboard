/** Module Tâches — listes, filtres, ajout rapide, détail. */
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Archive, ArchiveRestore, Check, ListTodo, Pencil, Plus, Trash2, X } from 'lucide-react'
import {
  ConfirmDialog,
  EmptyState,
  ProgressBar,
  btnGhost,
  btnPrimary,
  inputClass,
} from '../components/ui'
import { formatDate, useI18n } from '../i18n'
import { useAutosave, useFormDraft } from '../lib/formDraft'
import { getActiveOrgId } from '../lib/store'
import { canWriteRole } from '../lib/rbac'
import {
  BUCKET_ORDER,
  LIST_COLORS,
  TODO_PRIORITIES,
  TODO_STATUSES,
  bucketLabelKey,
  groupTasks,
  matchesTodoFilter,
  matchesTodoSearch,
  parseQuickAdd,
  priorityLabelKey,
  statusLabelKey,
  subtaskProgress,
  todayIso,
} from '../lib/todos'

function newId(prefix) {
  const rand = crypto.randomUUID().replace(/-/g, '').slice(0, 12)
  return `${prefix}_${rand}`
}

function Sheet({ open, title, resetKey, onClose, children, footer }) {
  const { t } = useI18n()
  const bodyRef = useRef(null)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!open) return undefined
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e) => {
      if (e.key === 'Escape') onCloseRef.current?.()
    }
    window.addEventListener('keydown', onKey)
    const frame = window.requestAnimationFrame(() => {
      if (bodyRef.current) bodyRef.current.scrollTop = 0
    })
    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, resetKey, title])

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-ink/45 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="todo-sheet-title"
    >
      <button type="button" className="absolute inset-0 cursor-default" aria-label={t('common.close')} onClick={onClose} />
      <div className="relative z-10 flex max-h-[100dvh] w-full max-w-full flex-col overflow-hidden rounded-t-2xl bg-sage-50 shadow-2xl animate-fade-up sm:max-h-[90vh] sm:max-w-lg sm:rounded-2xl">
        <div className="sticky top-0 z-20 flex shrink-0 items-start justify-between gap-3 border-b border-sage-200 bg-sage-50 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-5">
          <h3 id="todo-sheet-title" className="min-w-0 break-words font-display text-xl text-sage-900">
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg text-sage-600 hover:bg-sage-200"
            aria-label={t('common.close')}
          >
            <X size={18} />
          </button>
        </div>
        <div ref={bodyRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4 xx-scroll sm:px-5">
          {children}
        </div>
        {footer ? (
          <div className="sticky bottom-0 z-20 flex shrink-0 flex-col-reverse gap-2 border-t border-sage-200 bg-sage-50 px-4 py-3 sm:flex-row sm:justify-end sm:px-5 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  )
}

function UndoToast({ message, actionLabel, onAction, onDismiss }) {
  const { t } = useI18n()
  if (typeof document === 'undefined') return null
  return createPortal(
    <div
      className="pointer-events-auto fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 z-[100] flex w-[min(28rem,calc(100%-1.5rem))] -translate-x-1/2 items-center gap-2 rounded-xl bg-sage-900 px-3 py-2 text-sm font-medium text-sage-50 shadow-lg"
      role="status"
    >
      <span className="min-w-0 flex-1">{message}</span>
      <button
        type="button"
        className="inline-flex min-h-11 shrink-0 items-center rounded-lg bg-cream-green px-3 font-semibold text-sage-900"
        onClick={onAction}
      >
        {actionLabel}
      </button>
      <button
        type="button"
        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-sage-100 hover:bg-sage-800"
        onClick={onDismiss}
        aria-label={t('common.close')}
      >
        <X size={16} />
      </button>
    </div>,
    document.body,
  )
}

const seededUsers = new Set()

const FILTERS = [
  ['all', 'todos.filterAll'],
  ['mine', 'todos.filterMine'],
  ['today', 'todos.filterToday'],
  ['overdue', 'todos.filterOverdue'],
  ['high', 'todos.filterHigh'],
]

function priorityTone(priority) {
  if (priority === 'urgent') return 'bg-danger/15 text-danger'
  if (priority === 'high') return 'bg-warn/20 text-warn'
  if (priority === 'low') return 'bg-sage-100 text-sage-600'
  return 'bg-sage-200 text-sage-800'
}

function blankTask(listId) {
  return {
    id: '',
    listId: listId || '',
    title: '',
    description: '',
    priority: 'medium',
    dueDate: '',
    tags: [],
    status: 'todo',
    subtasks: [],
    assigneeId: '',
  }
}

export default function TodosView({ user, users = [], lists = [], tasks = [], flash, onSaveList, onDeleteList, onSaveTask, onDeleteTask }) {
  const { t, lang } = useI18n()
  const canWrite = canWriteRole(user)
  const today = todayIso()
  const [selectedListId, setSelectedListId] = useState('all')
  const [showArchived, setShowArchived] = useState(false)
  const [filter, setFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [quick, setQuick] = useState('')
  const [busy, setBusy] = useState(false)
  const [listDialog, setListDialog] = useState(null)
  const [listName, setListName] = useState('')
  const [listColor, setListColor] = useState(LIST_COLORS[0])
  const [detail, setDetail] = useState(null)
  const [draft, setDraft] = useState(null)
  const draftRef = useRef(draft)
  draftRef.current = draft
  const todoDraft = useFormDraft(
    'todos',
    getActiveOrgId(),
    draft ? JSON.stringify(draft) : '',
    (data) => {
      if (!data || !data.title) return
      setDraft(data)
      setDetail(data.id ? data : { id: 'new', ...data })
    },
  )
  const todoAuto = useAutosave({
    text: draft?.description || '',
    enabled: Boolean(draft?.title && draft?.listId),
    storageKey: `todo:${getActiveOrgId()}:${draft?.id || 'new'}`,
    onSave: async (text) => {
      const current = draftRef.current
      if (!current?.title?.trim() || !current.listId) return
      const saved = await onSaveTask({
        ...current,
        description: text,
        id: current.id && current.id !== 'new' ? current.id : undefined,
      })
      if (saved?.id) {
        setDraft((cur) => (cur ? { ...cur, id: saved.id, description: text } : cur))
        setDetail((cur) => (cur ? { ...cur, id: saved.id } : cur))
      }
    },
  })
  const [subtaskDraft, setSubtaskDraft] = useState('')
  const [confirm, setConfirm] = useState(null)
  const [undo, setUndo] = useState(null)
  const undoTimer = useRef(null)

  const clearUndo = () => {
    if (undoTimer.current) clearTimeout(undoTimer.current)
    undoTimer.current = null
    setUndo(null)
  }

  useEffect(() => () => {
    if (undoTimer.current) clearTimeout(undoTimer.current)
  }, [])

  useEffect(() => {
    if (!user || !canWrite) return
    if (lists.some((list) => list.ownerId === user.id)) {
      seededUsers.add(user.id)
      return
    }
    if (seededUsers.has(user.id)) return
    seededUsers.add(user.id)
    onSaveList({
      name: t('todos.defaultList'),
      color: LIST_COLORS[0],
      archived: false,
      visibility: 'Privée',
    }).catch((err) => {
      console.warn('todo seed', err)
    })
  }, [user, canWrite, lists, onSaveList, t])

  const visibleLists = useMemo(
    () => lists.filter((list) => showArchived || !list.archived),
    [lists, showArchived],
  )

  const activeLists = useMemo(() => lists.filter((list) => !list.archived), [lists])
  const currentListId =
    selectedListId !== 'all' && lists.some((list) => list.id === selectedListId) ? selectedListId : 'all'

  const listNameOf = (listId) => {
    const list = lists.find((item) => item.id === listId)
    if (!list) return t('todos.sharedList')
    return list.name || t('todos.sharedList')
  }

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (currentListId !== 'all' && task.listId !== currentListId) return false
      if (currentListId === 'all') {
        const list = lists.find((item) => item.id === task.listId)
        if (list?.archived && !showArchived) return false
      }
      if (!matchesTodoFilter(task, filter, user, today)) return false
      if (!matchesTodoSearch(task, query)) return false
      return true
    })
  }, [tasks, currentListId, lists, showArchived, filter, user, today, query])

  const groups = useMemo(() => groupTasks(filteredTasks, today), [filteredTasks, today])

  const targetListId = () => {
    if (currentListId !== 'all') {
      const selected = lists.find((list) => list.id === currentListId)
      if (selected && !selected.archived) return selected.id
    }
    const owned = activeLists.find((list) => list.ownerId === user?.id)
    return (owned || activeLists[0])?.id || ''
  }

  const fail = () => flash(t('todos.saveFailed'), 'error')

  const openListDialog = (mode, list) => {
    setListDialog(mode === 'rename' ? { mode, id: list.id } : { mode: 'create' })
    setListName(mode === 'rename' ? list.name || '' : '')
    setListColor(mode === 'rename' ? list.color || LIST_COLORS[0] : LIST_COLORS[0])
  }

  const submitList = async () => {
    const name = listName.trim()
    if (!name) {
      flash(t('todos.needListName'), 'error')
      return
    }
    setBusy(true)
    try {
      if (listDialog?.mode === 'rename') {
        const existing = lists.find((list) => list.id === listDialog.id)
        await onSaveList({ ...existing, name, color: listColor })
        flash(t('todos.listRenamed'))
      } else {
        await onSaveList({ name, color: listColor, archived: false, visibility: 'Privée' })
        flash(t('todos.listCreated'))
      }
      setListDialog(null)
    } catch (err) {
      console.warn('todo list', err)
      fail()
    } finally {
      setBusy(false)
    }
  }

  const toggleArchive = async (list) => {
    setBusy(true)
    try {
      await onSaveList({ ...list, archived: !list.archived })
      flash(list.archived ? t('todos.listUnarchived') : t('todos.listArchived'))
    } catch (err) {
      console.warn('todo archive', err)
      fail()
    } finally {
      setBusy(false)
    }
  }

  const submitQuick = async (event) => {
    event.preventDefault()
    if (!canWrite) {
      flash(t('todos.readerBlocked'), 'error')
      return
    }
    const parsed = parseQuickAdd(quick, { today })
    if (!parsed.title) {
      flash(t('todos.needTitle'), 'error')
      return
    }
    const listId = targetListId()
    if (!listId) {
      flash(t('todos.needListName'), 'error')
      return
    }
    setBusy(true)
    try {
      await onSaveTask({
        ...blankTask(listId),
        title: parsed.title,
        priority: parsed.priority,
        tags: parsed.tags,
        dueDate: parsed.dueDate,
        status: 'todo',
      })
      setQuick('')
      flash(t('todos.saved'))
    } catch (err) {
      console.warn('todo quick', err)
      fail()
    } finally {
      setBusy(false)
    }
  }

  const openDetail = (task) => {
    setDetail({ id: task.id })
    setDraft({
      ...task,
      tags: [...(task.tags || [])],
      subtasks: (task.subtasks || []).map((sub) => ({ ...sub })),
    })
    setSubtaskDraft('')
  }

  const openNew = () => {
    if (!canWrite) {
      flash(t('todos.readerBlocked'), 'error')
      return
    }
    const listId = targetListId()
    if (!listId) {
      flash(t('todos.createFirst'), 'error')
      return
    }
    setDetail({ id: 'new' })
    setDraft(blankTask(listId))
    setSubtaskDraft('')
  }

  const saveDraft = async () => {
    if (!draft) return
    if (!String(draft.title || '').trim()) {
      flash(t('todos.needTitle'), 'error')
      return
    }
    setBusy(true)
    try {
      const tags = String(draft.tagsText != null ? draft.tagsText : (draft.tags || []).join(' '))
        .split(/[\s,]+/)
        .map((tag) => tag.replace(/^#/, '').trim().toLowerCase())
        .filter(Boolean)
      const rest = { ...draft }
      delete rest.tagsText
      await onSaveTask({
        ...rest,
        title: rest.title.trim(),
        tags,
        subtasks: rest.subtasks || [],
      })
      flash(t('todos.saved'))
      setDetail(null)
      setDraft(null)
    } catch (err) {
      console.warn('todo save', err)
      fail()
    } finally {
      setBusy(false)
    }
  }

  const completeTask = async (task) => {
    if (!canWrite && task.ownerId !== user?.id) {
      flash(t('todos.readerBlocked'), 'error')
      return
    }
    const snapshot = {
      ...task,
      tags: [...(task.tags || [])],
      subtasks: (task.subtasks || []).map((sub) => ({ ...sub })),
    }
    const nextStatus = task.status === 'done' ? 'todo' : 'done'
    setBusy(true)
    try {
      await onSaveTask({ ...snapshot, status: nextStatus })
      if (nextStatus === 'done') {
        if (undoTimer.current) clearTimeout(undoTimer.current)
        setUndo({ message: t('todos.completed'), snapshot })
        undoTimer.current = setTimeout(() => setUndo(null), 6000)
      } else {
        clearUndo()
        flash(t('todos.restored'))
      }
    } catch (err) {
      console.warn('todo complete', err)
      fail()
    } finally {
      setBusy(false)
    }
  }

  const undoComplete = async () => {
    const snapshot = undo?.snapshot
    clearUndo()
    if (!snapshot) return
    setBusy(true)
    try {
      await onSaveTask(snapshot)
      flash(t('todos.restored'))
    } catch (err) {
      console.warn('todo undo', err)
      fail()
    } finally {
      setBusy(false)
    }
  }

  const runConfirm = async () => {
    if (!confirm) return
    setBusy(true)
    try {
      if (confirm.type === 'list') {
        await onDeleteList(confirm.id)
        if (currentListId === confirm.id) setSelectedListId('all')
        flash(t('todos.listDeleted'))
      } else {
        await onDeleteTask(confirm.id)
        if (detail?.id === confirm.id) {
          setDetail(null)
          setDraft(null)
        }
        flash(t('todos.taskDeleted'))
      }
      setConfirm(null)
    } catch (err) {
      console.warn('todo delete', err)
      fail()
    } finally {
      setBusy(false)
    }
  }

  const addSubtask = () => {
    const title = subtaskDraft.trim()
    if (!title || !draft) return
    setDraft({
      ...draft,
      subtasks: [...(draft.subtasks || []), { id: newId('sub'), title, done: false }],
    })
    setSubtaskDraft('')
  }

  const selectedList = lists.find((list) => list.id === currentListId) || null
  const hasAny = filteredTasks.length > 0

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
        <aside className="min-w-0 lg:w-60 lg:shrink-0">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="font-display text-lg text-sage-900">{t('todos.lists')}</h2>
            <button
              type="button"
              className={btnGhost + ' !min-h-11 !px-3'}
              onClick={() => openListDialog('create')}
              disabled={!canWrite}
            >
              <Plus size={16} /> {t('todos.newList')}
            </button>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
            <button
              type="button"
              onClick={() => setSelectedListId('all')}
              aria-pressed={currentListId === 'all'}
              className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-3 text-left text-sm font-semibold ${
                currentListId === 'all' ? 'bg-sage-800 text-white' : 'bg-white text-sage-800 hover:bg-sage-100'
              }`}
            >
              <ListTodo size={16} /> {t('todos.allLists')}
            </button>
            {visibleLists.map((list) => (
              <button
                key={list.id}
                type="button"
                onClick={() => setSelectedListId(list.id)}
                aria-pressed={currentListId === list.id}
                className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-3 text-left text-sm font-semibold ${
                  currentListId === list.id ? 'bg-sage-800 text-white' : 'bg-white text-sage-800 hover:bg-sage-100'
                }`}
              >
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: list.color || LIST_COLORS[0] }} aria-hidden />
                <span className="max-w-[12rem] truncate">{list.name}</span>
                {list.archived ? <span className="text-[10px] uppercase tracking-wide opacity-80">{t('todos.archivedBadge')}</span> : null}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="mt-2 text-xs font-semibold text-sage-700 underline decoration-sage-300 underline-offset-2"
            onClick={() => setShowArchived((value) => !value)}
            aria-pressed={showArchived}
          >
            {showArchived ? t('todos.hideArchived') : t('todos.showArchived')}
          </button>
          {selectedList ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" className={btnGhost + ' !min-h-11'} onClick={() => openListDialog('rename', selectedList)} disabled={!canWrite}>
                <Pencil size={14} /> {t('todos.rename')}
              </button>
              <button type="button" className={btnGhost + ' !min-h-11'} onClick={() => toggleArchive(selectedList)} disabled={!canWrite || busy}>
                {selectedList.archived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
                {selectedList.archived ? t('todos.unarchive') : t('todos.archive')}
              </button>
              <button
                type="button"
                className={btnGhost + ' !min-h-11 !text-danger'}
                onClick={() => setConfirm({ type: 'list', id: selectedList.id, name: selectedList.name })}
                disabled={!canWrite}
              >
                <Trash2 size={14} /> {t('common.delete')}
              </button>
            </div>
          ) : null}
        </aside>

        <section className="min-w-0 flex-1 space-y-3">
          <form onSubmit={submitQuick} className="flex flex-col gap-2 sm:flex-row">
            <label className="min-w-0 flex-1 text-sm">
              <span className="mb-1 block font-medium text-sage-800">{t('todos.quickAdd')}</span>
              <input
                className={inputClass}
                value={quick}
                onChange={(e) => setQuick(e.target.value)}
                placeholder={t('todos.quickPlaceholder')}
                aria-label={t('todos.quickAdd')}
                disabled={!canWrite || busy}
              />
            </label>
            <div className="flex items-end gap-2">
              <button type="submit" className={btnPrimary} disabled={!canWrite || busy}>
                <Plus size={16} /> {t('todos.add')}
              </button>
              <button type="button" className={btnGhost} onClick={openNew} disabled={!canWrite}>
                {t('todos.newTask')}
              </button>
            </div>
          </form>
          <p className="text-xs text-sage-600">{t('todos.quickHint')}</p>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="min-w-0 flex-1 text-sm">
              <span className="sr-only">{t('todos.search')}</span>
              <input
                className={inputClass}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('todos.search')}
                aria-label={t('todos.search')}
              />
            </label>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label={t('todos.filters')}>
            {FILTERS.map(([id, key]) => (
              <button
                key={id}
                type="button"
                aria-pressed={filter === id}
                onClick={() => setFilter(id)}
                className={`inline-flex min-h-11 shrink-0 items-center rounded-full px-3 text-sm font-semibold ${
                  filter === id ? 'bg-sage-800 text-white' : 'bg-white text-sage-800 hover:bg-sage-100'
                }`}
              >
                {t(key)}
              </button>
            ))}
          </div>

          {!hasAny ? (
            <EmptyState title={t('todos.empty')} hint={t('todos.emptyHint')} icon={ListTodo} />
          ) : (
            <div className="space-y-5">
              {BUCKET_ORDER.map((bucket) => {
                const rows = groups[bucket]
                if (!rows?.length) return null
                return (
                  <section key={bucket}>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-sage-600">
                      {t(bucketLabelKey(bucket))} · {rows.length}
                    </h3>
                    <ul className="space-y-2">
                      {rows.map((task) => {
                        const progress = subtaskProgress(task)
                        const overdue = bucket === 'overdue'
                        return (
                          <li key={task.id} className="rounded-2xl border border-sage-200 bg-white/80 p-3">
                            <div className="flex items-start gap-2">
                              <button
                                type="button"
                                className={`mt-0.5 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${
                                  task.status === 'done'
                                    ? 'border-sage-700 bg-sage-700 text-white'
                                    : 'border-sage-300 bg-white text-transparent hover:border-sage-600'
                                }`}
                                aria-label={task.status === 'done' ? t('todos.markOpen') : t('todos.markDone')}
                                aria-pressed={task.status === 'done'}
                                onClick={() => completeTask(task)}
                                disabled={busy}
                              >
                                <Check size={16} />
                              </button>
                              <button type="button" className="min-w-0 flex-1 text-left" onClick={() => openDetail(task)}>
                                <span className={`block font-medium text-sage-900 ${task.status === 'done' ? 'line-through opacity-70' : ''}`}>
                                  {task.title}
                                </span>
                                <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-sage-600">
                                  <span className={`rounded-full px-2 py-0.5 font-semibold ${priorityTone(task.priority)}`}>
                                    {t(priorityLabelKey(task.priority))}
                                  </span>
                                  <span>{t(statusLabelKey(task.status))}</span>
                                  <span className={overdue ? 'font-semibold text-danger' : ''}>
                                    {task.dueDate ? formatDate(lang, task.dueDate) : t('todos.noDate')}
                                  </span>
                                  <span className="truncate">{listNameOf(task.listId)}</span>
                                </span>
                                {task.tags?.length ? (
                                  <span className="mt-1 flex flex-wrap gap-1">
                                    {task.tags.map((tag) => (
                                      <span key={tag} className="rounded-full bg-sage-100 px-2 py-0.5 text-[11px] font-semibold text-sage-700">
                                        #{tag}
                                      </span>
                                    ))}
                                  </span>
                                ) : null}
                                {task.subtasks?.length ? (
                                  <span className="mt-2 block">
                                    <ProgressBar value={progress} label={t('todos.subtaskCount', { done: task.subtasks.filter((s) => s.done).length, total: task.subtasks.length })} />
                                  </span>
                                ) : null}
                              </button>
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  </section>
                )
              })}
            </div>
          )}
        </section>
      </div>

      <Sheet
        open={Boolean(listDialog)}
        title={listDialog?.mode === 'rename' ? t('todos.rename') : t('todos.newList')}
        resetKey={listDialog?.id || listDialog?.mode || ''}
        onClose={() => setListDialog(null)}
        footer={
          <>
            <button type="button" className={btnGhost + ' w-full sm:w-auto'} onClick={() => setListDialog(null)} disabled={busy}>
              {t('common.cancel')}
            </button>
            <button type="button" className={btnPrimary + ' w-full sm:w-auto'} onClick={submitList} disabled={busy}>
              {t('common.save')}
            </button>
          </>
        }
      >
        <label className="mb-3 block text-sm">
          <span className="mb-1 block font-medium text-sage-800">{t('todos.listName')}</span>
          <input className={inputClass} value={listName} onChange={(e) => setListName(e.target.value)} autoFocus />
        </label>
        <p className="mb-2 text-sm font-medium text-sage-800">{t('todos.color')}</p>
        <div className="flex flex-wrap gap-2">
          {LIST_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              aria-label={t('todos.color')}
              aria-pressed={listColor === color}
              className={`h-11 w-11 rounded-full border-2 ${listColor === color ? 'border-sage-900' : 'border-white'}`}
              style={{ background: color }}
              onClick={() => setListColor(color)}
            />
          ))}
        </div>
      </Sheet>

      <Sheet
        open={Boolean(detail && draft)}
        title={detail?.id === 'new' ? t('todos.newTask') : t('todos.editTask')}
        resetKey={detail?.id || ''}
        onClose={() => {
          setDetail(null)
          setDraft(null)
        }}
        footer={
          <>
            {detail?.id && detail.id !== 'new' ? (
              <button
                type="button"
                className={btnGhost + ' w-full !text-danger sm:mr-auto sm:w-auto'}
                onClick={() => setConfirm({ type: 'task', id: draft.id, name: draft.title })}
                disabled={busy}
              >
                {t('common.delete')}
              </button>
            ) : null}
            <button
              type="button"
              className={btnGhost + ' w-full sm:w-auto'}
              onClick={() => {
                setDetail(null)
                setDraft(null)
              }}
              disabled={busy}
            >
              {t('common.cancel')}
            </button>
            <button type="button" className={btnPrimary + ' w-full sm:w-auto'} onClick={saveDraft} disabled={busy || !canWrite}>
              {t('common.save')}
            </button>
          </>
        }
      >
        {draft ? (
          <div>
            <label className="mb-3 block text-sm">
              <span className="mb-1 block font-medium text-sage-800">{t('todos.titleField')}</span>
              <input
                className={inputClass}
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              />
            </label>
            <label className="mb-3 block text-sm">
              <span className="mb-1 block font-medium text-sage-800">{t('todos.description')}</span>
              <textarea
                className={inputClass + ' min-h-24'}
                value={draft.description || ''}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              />
              <div className="mt-1 flex items-center justify-between text-xs text-sage-500">
                <span>
                  {todoAuto.status === 'saving'
                    ? t('autosave.saving')
                    : todoAuto.status === 'unsaved'
                      ? t('autosave.unsaved')
                      : todoAuto.status === 'saved'
                        ? t('autosave.saved')
                        : ''}
                </span>
                {todoDraft.hasDraft ? (
                  <button type="button" className="font-semibold text-sage-700 underline" onClick={todoDraft.clear}>
                    {t('draft.clear')}
                  </button>
                ) : null}
              </div>
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-sage-800">{t('todos.lists')}</span>
                <select
                  className={inputClass}
                  value={draft.listId}
                  onChange={(e) => setDraft({ ...draft, listId: e.target.value })}
                >
                  {lists.filter((list) => !list.archived || list.id === draft.listId).map((list) => (
                    <option key={list.id} value={list.id}>
                      {list.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-sage-800">{t('common.status')}</span>
                <select
                  className={inputClass}
                  value={draft.status}
                  onChange={(e) => setDraft({ ...draft, status: e.target.value })}
                >
                  {TODO_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {t(statusLabelKey(status))}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-sage-800">{t('todos.priority')}</span>
                <select
                  className={inputClass}
                  value={draft.priority}
                  onChange={(e) => setDraft({ ...draft, priority: e.target.value })}
                >
                  {TODO_PRIORITIES.map((priority) => (
                    <option key={priority} value={priority}>
                      {t(priorityLabelKey(priority))}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-sage-800">{t('todos.due')}</span>
                <input
                  type="date"
                  className={inputClass}
                  value={draft.dueDate || ''}
                  onChange={(e) => setDraft({ ...draft, dueDate: e.target.value })}
                />
              </label>
            </div>
            <label className="mb-3 mt-3 block text-sm">
              <span className="mb-1 block font-medium text-sage-800">{t('todos.tags')}</span>
              <input
                className={inputClass}
                value={draft.tagsText != null ? draft.tagsText : (draft.tags || []).join(' ')}
                onChange={(e) => setDraft({ ...draft, tagsText: e.target.value })}
                placeholder={t('todos.tagsHint')}
              />
            </label>
            {users.length > 0 ? (
              <label className="mb-3 block text-sm">
                <span className="mb-1 block font-medium text-sage-800">{t('todos.assignee')}</span>
                <select
                  className={inputClass}
                  value={draft.assigneeId || ''}
                  onChange={(e) => setDraft({ ...draft, assigneeId: e.target.value })}
                >
                  <option value="">{t('todos.unassigned')}</option>
                  {users.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.fullName || person.email}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <div className="mt-2">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-sage-800">{t('todos.subtasks')}</p>
                <span className="text-xs font-semibold text-sage-600">{subtaskProgress(draft)} %</span>
              </div>
              <ProgressBar value={subtaskProgress(draft)} label={t('todos.progress')} />
              <ul className="mt-2 space-y-2">
                {(draft.subtasks || []).map((sub) => (
                  <li key={sub.id} className="flex items-center gap-2">
                    <button
                      type="button"
                      className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${
                        sub.done ? 'border-sage-700 bg-sage-700 text-white' : 'border-sage-300 bg-white'
                      }`}
                      aria-pressed={sub.done}
                      aria-label={sub.done ? t('todos.markOpen') : t('todos.markDone')}
                      onClick={() =>
                        setDraft({
                          ...draft,
                          subtasks: draft.subtasks.map((item) => (item.id === sub.id ? { ...item, done: !item.done } : item)),
                        })
                      }
                    >
                      <Check size={14} className={sub.done ? '' : 'opacity-0'} />
                    </button>
                    <span className={`min-w-0 flex-1 text-sm ${sub.done ? 'text-sage-500 line-through' : 'text-sage-900'}`}>{sub.title}</span>
                    <button
                      type="button"
                      className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-sage-600 hover:bg-sage-100"
                      aria-label={t('common.delete')}
                      onClick={() => setDraft({ ...draft, subtasks: draft.subtasks.filter((item) => item.id !== sub.id) })}
                    >
                      <Trash2 size={14} />
                    </button>
                  </li>
                ))}
              </ul>
              <div className="mt-2 flex gap-2">
                <input
                  className={inputClass}
                  value={subtaskDraft}
                  onChange={(e) => setSubtaskDraft(e.target.value)}
                  placeholder={t('todos.subtaskPlaceholder')}
                  aria-label={t('todos.subtaskPlaceholder')}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addSubtask()
                    }
                  }}
                />
                <button type="button" className={btnGhost} onClick={addSubtask}>
                  {t('todos.addSubtask')}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </Sheet>

      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.type === 'list' ? t('todos.deleteList') : t('todos.deleteTask')}
        body={
          confirm?.type === 'list'
            ? t('todos.deleteListBody', { name: confirm?.name || '' })
            : t('todos.deleteTaskBody', { name: confirm?.name || '' })
        }
        confirmLabel={t('common.delete')}
        onConfirm={runConfirm}
        onClose={() => setConfirm(null)}
        busy={busy}
        danger
      />

      {undo ? (
        <UndoToast message={undo.message} actionLabel={t('todos.undo')} onAction={undoComplete} onDismiss={clearUndo} />
      ) : null}
    </div>
  )
}
