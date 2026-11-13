import { useEffect, useMemo, useRef, useState } from 'react'
import { MessageSquarePlus, ThumbsUp, Upload } from 'lucide-react'
import { EmptyState, btnGhost, btnPrimary, inputClass } from '../components/ui'
import { dateLocale, useI18n } from '../i18n'
import { subscribeStore } from '../lib/store'
import { useFormDraft } from '../lib/formDraft'
import { importFeedbackItems, setFeedbackStatus, submitFeedback, voteFeedbackOnce } from './api.js'
import { feedbackT } from './i18n.js'
import {
  FEEDBACK_MODULE_IDS,
  FEEDBACK_STATUSES,
  authorOf,
  detailOf,
  feedbackVisible,
  isLegacyFeedback,
  parseFeedbackTxt,
  sourceOf,
  statusOf,
  voteCount,
  voterIds,
} from './model.js'
import { isOrgAdmin, isOrgMember, readActiveOrgId } from './org.js'

const ERROR_KEYS = {
  vote_once: 'voteOnce',
  need_fields: 'needFields',
  forbidden: 'adminOnly',
  admin_only: 'adminOnly',
  not_member: 'notMember',
  missing: 'missing',
  bad_status: 'badStatus',
  import_empty: 'importEmpty',
}

function Field({ label, children }) {
  return (
    <label className="mb-3 block text-sm">
      <span className="mb-1 block font-medium text-sage-800">{label}</span>
      {children}
    </label>
  )
}

function statusTone(status) {
  if (status === 'accepted') return 'bg-ok/15 text-ok'
  if (status === 'in_progress') return 'bg-warn/15 text-warn'
  if (status === 'done') return 'bg-sage-200 text-sage-800'
  if (status === 'declined') return 'bg-danger/10 text-danger'
  return 'bg-sage-100 text-sage-800'
}

export function FeedbackBoard({ user, users = [], flash }) {
  const { lang, t } = useI18n()
  const tf = (key, vars) => feedbackT(lang, key, vars)
  const [items, setItems] = useState([])
  const [orgId, setOrgId] = useState(() => readActiveOrgId())
  const dbRef = useRef(null)
  const fileRef = useRef(null)
  const [title, setTitle] = useState('')
  const [detail, setDetail] = useState('')
  const [moduleId, setModuleId] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [moduleFilter, setModuleFilter] = useState('all')
  const [preview, setPreview] = useState(null)
  const [busy, setBusy] = useState(false)
  const feedbackDraft = useFormDraft(
    'feedback',
    orgId,
    title || detail ? JSON.stringify({ title, detail, moduleId }) : '',
    (data) => {
      if (!data) return
      setTitle(data.title || '')
      setDetail(data.detail || '')
      setModuleId(data.moduleId || '')
    },
  )

  useEffect(() => subscribeStore((db) => {
    dbRef.current = db
    setItems(Object.values(db?.xx_feedback || {}))
    if (db?.activeOrgId) setOrgId(db.activeOrgId)
  }), [])

  useEffect(() => {
    const sync = () => setOrgId(readActiveOrgId())
    window.addEventListener('storage', sync)
    window.addEventListener('focus', sync)
    return () => {
      window.removeEventListener('storage', sync)
      window.removeEventListener('focus', sync)
    }
  }, [])

  const admin = isOrgAdmin(user, orgId, dbRef.current)
  const canSeeLegacy = admin

  const moduleLabel = (id) => {
    if (!id) return tf('moduleNone')
    const known = tf(`modules.${id}`)
    if (known !== `modules.${id}`) return known
    return id
  }

  const visible = useMemo(() => {
    return items
      .filter((item) => feedbackVisible(item, user, orgId, canSeeLegacy))
      .filter((item) => isLegacyFeedback(item) || isOrgMember(user, item.orgId || '', dbRef.current))
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
  }, [items, user, orgId, canSeeLegacy])

  const moduleOptions = useMemo(() => {
    const extra = visible
      .map((item) => String(item.module || '').trim())
      .filter((id) => id && !FEEDBACK_MODULE_IDS.includes(id))
    return [...FEEDBACK_MODULE_IDS, ...new Set(extra)]
  }, [visible])

  const listed = visible.filter((item) => {
    if (statusFilter !== 'all' && statusOf(item) !== statusFilter) return false
    if (moduleFilter !== 'all' && String(item.module || '') !== moduleFilter) return false
    return true
  })

  const nameOf = (item) => {
    const written = authorOf(item)
    if (written) return written
    const id = item.authorId || item.userId
    const account = users.find((entry) => entry.id === id)
    return account?.fullName || account?.email || '—'
  }

  const fail = (err) => {
    const key = ERROR_KEYS[err?.code]
    flash(key ? tf(key) : err?.message || tf('missing'), 'err')
  }

  const send = async (event) => {
    event.preventDefault()
    if (!title.trim() || !detail.trim()) {
      flash(tf('needFields'), 'err')
      return
    }
    setBusy(true)
    try {
      await submitFeedback({ title, detail, module: moduleId }, user, orgId)
      setTitle('')
      setDetail('')
      setModuleId('')
      feedbackDraft.clear()
      flash(tf('sent'))
    } catch (err) {
      fail(err)
    } finally {
      setBusy(false)
    }
  }

  const onFile = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      const text = await file.text()
      const parsed = parseFeedbackTxt(text)
      if (!parsed.length) {
        setPreview(null)
        flash(tf('importEmpty'), 'err')
        return
      }
      setPreview(parsed)
    } catch (err) {
      fail(err)
    }
  }

  const confirmImport = async () => {
    if (!preview?.length) return
    setBusy(true)
    try {
      const created = await importFeedbackItems(preview, user, readActiveOrgId())
      setPreview(null)
      flash(tf('importDone', { n: created.length }))
    } catch (err) {
      fail(err)
    } finally {
      setBusy(false)
    }
  }

  const vote = async (id) => {
    setBusy(true)
    try {
      await voteFeedbackOnce(id, user)
      flash(tf('voteSaved'))
    } catch (err) {
      fail(err)
    } finally {
      setBusy(false)
    }
  }

  const changeStatus = async (id, status) => {
    setBusy(true)
    try {
      await setFeedbackStatus(id, status, user)
      flash(tf('statusSaved'))
    } catch (err) {
      fail(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6 animate-fade-up">
      <section className="rounded-2xl border border-sage-200 bg-white/80 p-5">
        <h2 className="flex items-center gap-2 font-display text-lg text-sage-900">
          <MessageSquarePlus size={18} className="text-sage-700" aria-hidden="true" />
          {tf('heading')}
        </h2>
        <p className="mt-1 text-sm text-sage-600">{tf('hint')}</p>
        <p className="mt-1 text-xs text-sage-500">
          {orgId ? tf('orgActive', { id: orgId }) : tf('orgMissing')}
          {' · '}
          {tf('kept')}
        </p>
        <form className="mt-4" onSubmit={send}>
          <Field label={tf('fieldTitle')}>
            <input
              className={inputClass}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={200}
              required
              placeholder={tf('placeholderTitle')}
            />
          </Field>
          <Field label={tf('fieldDetail')}>
            <textarea
              className={inputClass + ' min-h-32'}
              value={detail}
              onChange={(event) => setDetail(event.target.value)}
              required
              maxLength={8000}
              placeholder={tf('placeholderDetail')}
            />
            {feedbackDraft.hasDraft ? (
              <button type="button" className="mt-1 text-xs font-semibold text-sage-700 underline" onClick={feedbackDraft.clear}>
                {t('draft.clear')}
              </button>
            ) : null}
          </Field>
          <Field label={tf('fieldModule')}>
            <select className={inputClass} value={moduleId} onChange={(event) => setModuleId(event.target.value)}>
              <option value="">{tf('moduleNone')}</option>
              {FEEDBACK_MODULE_IDS.map((id) => (
                <option key={id} value={id}>
                  {moduleLabel(id)}
                </option>
              ))}
            </select>
          </Field>
          <div className="flex flex-wrap gap-2">
            <button type="submit" className={btnPrimary} disabled={busy}>
              {tf('submit')}
            </button>
            <button type="button" className={btnGhost} onClick={() => fileRef.current?.click()} disabled={busy}>
              <Upload size={16} aria-hidden="true" />
              {tf('import')}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".txt,text/plain"
              className="sr-only"
              onChange={onFile}
            />
          </div>
          <p className="mt-2 text-xs text-sage-500">{tf('importHelp')}</p>
        </form>
        {preview ? (
          <div className="mt-4 rounded-xl border border-sage-300 bg-sage-50 p-3">
            <p className="text-sm font-medium text-sage-900">{tf('importPreview', { n: preview.length })}</p>
            <ul className="mt-2 space-y-1 text-xs text-sage-600">
              {preview.slice(0, 5).map((item, index) => (
                <li key={`${item.title}-${index}`} className="truncate">
                  {item.title}
                  {item.module ? ` · ${item.module}` : ''}
                </li>
              ))}
            </ul>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" className={btnPrimary} onClick={confirmImport} disabled={busy}>
                {tf('importConfirm')}
              </button>
              <button type="button" className={btnGhost} onClick={() => setPreview(null)} disabled={busy}>
                {tf('importCancel')}
              </button>
            </div>
          </div>
        ) : null}
      </section>

      <section>
        <div className="mb-3 flex flex-col gap-2 sm:flex-row">
          <label className="block min-w-0 flex-1 text-sm">
            <span className="mb-1 block text-xs font-medium text-sage-600">{tf('filterStatus')}</span>
            <select
              className={inputClass}
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              aria-label={tf('filterStatus')}
            >
              <option value="all">{tf('statusAny')}</option>
              {FEEDBACK_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {tf(`status_${status}`)}
                </option>
              ))}
            </select>
          </label>
          <label className="block min-w-0 flex-1 text-sm">
            <span className="mb-1 block text-xs font-medium text-sage-600">{tf('filterModule')}</span>
            <select
              className={inputClass}
              value={moduleFilter}
              onChange={(event) => setModuleFilter(event.target.value)}
              aria-label={tf('filterModule')}
            >
              <option value="all">{tf('moduleAny')}</option>
              {moduleOptions.map((id) => (
                <option key={id} value={id}>
                  {moduleLabel(id)}
                </option>
              ))}
            </select>
          </label>
        </div>
        {listed.length === 0 ? (
          <EmptyState icon={MessageSquarePlus} title={tf('empty')} hint={tf('emptyHint')} />
        ) : (
          <ul className="space-y-3">
            {listed.map((item) => {
              const status = statusOf(item)
              const voted = voterIds(item).includes(user?.id)
              const legacy = isLegacyFeedback(item)
              const source = sourceOf(item)
              return (
                <li key={item.id} className="rounded-2xl border border-sage-200 bg-white/80 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-display text-lg text-sage-900">{item.title}</h3>
                      <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-sage-500">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 font-semibold ${statusTone(status)}`}>
                          {tf(`status_${status}`)}
                        </span>
                        {item.module ? <span>{moduleLabel(item.module)}</span> : null}
                        <span>{tf('byAuthor', { name: nameOf(item) })}</span>
                        <span>{legacy ? tf('legacy') : tf(`source_${source}`)}</span>
                        <span>
                          {item.createdAt ? new Date(item.createdAt).toLocaleString(dateLocale(lang)) : ''}
                        </span>
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {isOrgAdmin(user, isLegacyFeedback(item) ? '' : String(item.orgId || ''), dbRef.current) ? (
                        <label className="text-xs text-sage-600">
                          <span className="sr-only">{tf('changeStatus')}</span>
                          <select
                            className={inputClass + ' !min-h-9 !py-1 text-xs'}
                            value={status}
                            onChange={(event) => changeStatus(item.id, event.target.value)}
                            disabled={busy}
                            aria-label={tf('changeStatus')}
                          >
                            {FEEDBACK_STATUSES.map((value) => (
                              <option key={value} value={value}>
                                {tf(`status_${value}`)}
                              </option>
                            ))}
                          </select>
                        </label>
                      ) : null}
                      <button
                        type="button"
                        className={btnGhost + (voted ? ' !border-sage-400 !bg-sage-100' : '')}
                        onClick={() => vote(item.id)}
                        disabled={busy || voted}
                      >
                        <ThumbsUp size={16} aria-hidden="true" />
                        {voted ? tf('voted') : tf('vote')}
                        <span className="text-sage-500">{tf('voteCount', { n: voteCount(item) })}</span>
                      </button>
                    </div>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm text-sage-700">{detailOf(item)}</p>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
