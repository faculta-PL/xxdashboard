/** Retours d’amélioration — membres proposent, admins d’organisation font avancer le statut. */
import { useMemo, useState } from 'react'
import { MessageSquarePlus, Sparkles, Trash2, Send, Upload, ThumbsUp } from 'lucide-react'
import { askExternal } from './lib/assistant'
import { parseFeedbackRewrite } from './lib/feedback'
import { parseFeedbackImport } from './lib/feedbackImport'
import { isAdmin } from './lib/rbac'
import { listOrganizations } from './lib/store'
import { ConfirmDialog, EmptyState, btnGhost, btnPrimary, inputClass } from './components/ui'
import { dateLocale, useI18n } from './i18n'
import { clearFormDraft, useFormDraft } from './lib/formDraft'

const FEEDBACK_MODULE_IDS = [
  '',
  'dashboard',
  'projects',
  'notes',
  'ideas',
  'calendar',
  'todos',
  'files',
  'budget',
  'risks',
  'canvas',
  'team',
  'chat',
  'assistant',
  'create',
  'games',
  'org',
  'autre',
]

const STATUSES = ['new', 'accepted', 'in_progress', 'done', 'declined']

function statusKey(status) {
  if (status === 'accepted') return 'feedback.statusAccepted'
  if (status === 'in_progress') return 'feedback.statusProgress'
  if (status === 'done') return 'feedback.statusDone'
  if (status === 'declined') return 'feedback.statusDeclined'
  return 'feedback.statusNew'
}

function Field({ label, hint, children }) {
  return (
    <label className="mb-3 block text-sm">
      <span className="mb-1 block font-medium text-sage-800">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-sage-500">{hint}</span> : null}
    </label>
  )
}

export default function FeedbackView({
  user,
  users = [],
  items = [],
  orgId = '',
  canModerate = false,
  flash,
  onSubmit,
  onDelete,
  onUpdate,
  onVote,
  onImport,
  onLoadInbox,
}) {
  const { t, lang } = useI18n()
  const admin = isAdmin(user)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [moduleId, setModuleId] = useState('')
  const [busy, setBusy] = useState(false)
  const [rewrite, setRewrite] = useState(null)
  const [confirmSend, setConfirmSend] = useState(false)
  const [deleteId, setDeleteId] = useState(null)
  const [statusFilter, setStatusFilter] = useState('')
  const [moduleFilter, setModuleFilter] = useState('')
  const [preview, setPreview] = useState(null)
  const [inbox, setInbox] = useState(false)
  const [inboxItems, setInboxItems] = useState(null)
  const [inboxError, setInboxError] = useState('')

  const draft = useFormDraft(
    'feedback',
    orgId,
    title || body || moduleId ? JSON.stringify({ title, body, moduleId }) : '',
    (snap) => {
      if (!snap) return
      setTitle(snap.title || '')
      setBody(snap.body || '')
      setModuleId(snap.moduleId || '')
    },
  )

  const nameOf = (id, item) =>
    item?.authorName || users.find((u) => u.id === id)?.fullName || users.find((u) => u.id === id)?.email || '—'
  const moduleLabel = (id) => {
    if (!id) return t('feedback.fieldModule')
    if (id === 'autre') return t('feedback.other')
    const key = `nav.${id}`
    const label = t(key)
    return label === key ? id : label
  }
  const orgName = (id) => listOrganizations().find((org) => org.id === id)?.name || id || '—'

  const sourceItems = inbox && inboxItems ? inboxItems : items
  const listed = useMemo(() => {
    return [...sourceItems]
      .filter((item) => !statusFilter || (item.status === 'nouveau' ? 'new' : item.status || 'new') === statusFilter)
      .filter((item) => !moduleFilter || item.module === moduleFilter)
      .sort((a, b) => (b.votes || 0) - (a.votes || 0) || new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
  }, [sourceItems, statusFilter, moduleFilter])

  const helpFormulate = async () => {
    const draftTitle = title.trim()
    const draftBody = body.trim()
    if (!draftTitle && !draftBody) {
      flash(t('feedback.needDraft'), 'err')
      return
    }
    setBusy(true)
    try {
      const result = await askExternal({
        messages: [
          {
            role: 'user',
            content: `Réécris clairement ce retour d’amélioration pour l’équipe Nazix. Ne rien inventer, ne pas ajouter de secrets. Français soigné, concis. Réponds uniquement avec :\nTITRE: ...\nMESSAGE: ...\n\nTitre: ${draftTitle || '(vide)'}\nMessage: ${draftBody || '(vide)'}\nModule: ${moduleLabel(moduleId)}`,
          },
        ],
        context: { label: 'Feedback' },
      })
      const parsed = parseFeedbackRewrite(result.content || result.text || '')
      if (!parsed.body && !parsed.title) throw new Error(t('feedback.rewriteEmpty'))
      setRewrite({
        title: parsed.title || draftTitle,
        body: parsed.body || draftBody,
      })
    } catch (err) {
      flash(err.message || t('feedback.rewriteFail'), 'err')
    } finally {
      setBusy(false)
    }
  }

  const applyRewrite = () => {
    if (!rewrite) return
    setTitle(rewrite.title)
    setBody(rewrite.body)
    setRewrite(null)
    flash(t('feedback.clarified'))
  }

  const send = async () => {
    setBusy(true)
    try {
      await onSubmit({
        title: title.trim(),
        body: body.trim(),
        module: moduleId || null,
      })
      draft.clear()
      setTitle('')
      setBody('')
      setModuleId('')
      setConfirmSend(false)
      flash(t('feedback.sent'))
    } catch (err) {
      flash(err.message || t('feedback.sendFail'), 'err')
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!deleteId) return
    setBusy(true)
    try {
      await onDelete(deleteId)
      setDeleteId(null)
      flash(t('feedback.deleted'))
    } catch (err) {
      flash(err.message || t('feedback.deleteFail'), 'err')
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
      const parsed = parseFeedbackImport(text)
      setPreview(parsed)
      if (!parsed.length) flash(t('feedback.previewEmpty'), 'err')
    } catch (err) {
      flash(err.message || t('feedback.importFail'), 'err')
    }
  }

  const runImport = async () => {
    if (!preview?.length) return
    setBusy(true)
    try {
      await onImport(preview)
      flash(t('feedback.imported', { n: preview.length }))
      setPreview(null)
    } catch (err) {
      flash(err.message || t('feedback.importFail'), 'err')
    } finally {
      setBusy(false)
    }
  }

  const openInbox = async () => {
    if (inbox) {
      setInbox(false)
      return
    }
    setBusy(true)
    setInboxError('')
    try {
      const rows = await onLoadInbox()
      setInboxItems(rows || [])
      setInbox(true)
    } catch (err) {
      setInboxError(err.message || t('feedback.importFail'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6 animate-fade-up">
      <section className="rounded-2xl border border-sage-200 bg-white/80 p-5">
        <h2 className="flex items-center gap-2 font-display text-lg text-sage-900">
          <MessageSquarePlus size={18} className="text-sage-700" aria-hidden="true" />
          {t('feedback.propose')}
        </h2>
        <p className="mt-1 text-sm text-sage-600">{t('feedback.hint')}</p>
        <p className="mt-1 text-xs text-sage-500">{t('feedback.membersSubmit')}</p>
        <form
          className="mt-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (!title.trim() || !body.trim()) {
              flash(t('feedback.needFields'), 'err')
              return
            }
            setConfirmSend(true)
          }}
        >
          <Field label={t('feedback.fieldTitle')}>
            <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} required placeholder={t('feedback.placeholderTitle')} />
          </Field>
          <Field label={t('feedback.fieldMessage')}>
            <textarea className={inputClass + ' min-h-32'} value={body} onChange={(e) => setBody(e.target.value)} required maxLength={8000} placeholder={t('feedback.placeholderBody')} />
          </Field>
          <Field label={t('feedback.fieldModule')}>
            <select className={inputClass} value={moduleId} onChange={(e) => setModuleId(e.target.value)}>
              {FEEDBACK_MODULE_IDS.map((id) => (
                <option key={id || 'none'} value={id}>
                  {moduleLabel(id)}
                </option>
              ))}
            </select>
          </Field>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btnGhost} onClick={helpFormulate} disabled={busy}>
              <Sparkles size={16} aria-hidden="true" />
              {t('feedback.helpWrite')}
            </button>
            <button type="button" className={btnGhost} onClick={draft.clear}>
              {t('draft.clear')}
            </button>
            <button type="submit" className={btnPrimary} disabled={busy}>
              <Send size={16} aria-hidden="true" />
              {t('feedback.send')}
            </button>
          </div>
        </form>
        <div className="mt-4 rounded-xl border border-dashed border-sage-300 p-3">
          <p className="text-sm font-medium text-sage-800">{t('feedback.import')}</p>
          <p className="mt-1 text-xs text-sage-500">{t('feedback.importHint')}</p>
          <label className={btnGhost + ' mt-2 cursor-pointer'}>
            <Upload size={16} /> {t('feedback.import')}
            <input type="file" accept=".txt,text/plain" className="sr-only" onChange={onFile} />
          </label>
          {preview ? (
            <div className="mt-3">
              <p className="text-sm text-sage-800">{preview.length ? t('feedback.preview', { n: preview.length }) : t('feedback.previewEmpty')}</p>
              {preview.length > 0 && (
                <button type="button" className={btnPrimary + ' mt-2'} disabled={busy} onClick={runImport}>
                  {t('feedback.confirmImport', { n: preview.length })}
                </button>
              )}
            </div>
          ) : null}
        </div>
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <h2 className="font-display text-lg text-sage-900">{inbox ? t('feedback.inbox') : admin || canModerate ? t('feedback.all') : t('feedback.yours')}</h2>
          {admin && (
            <button type="button" className={btnGhost} onClick={openInbox} disabled={busy}>
              {t('feedback.inbox')}
            </button>
          )}
        </div>
        {inbox ? <p className="mb-3 text-sm text-sage-600">{t('feedback.inboxHint')}</p> : null}
        {inboxError ? <p className="mb-3 text-sm text-danger">{inboxError}</p> : null}
        <div className="mb-3 grid gap-2 sm:grid-cols-2">
          <label className="text-sm font-medium text-sage-800">
            {t('feedback.filterStatus')}
            <select className={inputClass + ' mt-1'} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">{t('feedback.allStatuses')}</option>
              {STATUSES.map((status) => (
                <option key={status} value={status}>
                  {t(statusKey(status))}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-sage-800">
            {t('feedback.filterModule')}
            <select className={inputClass + ' mt-1'} value={moduleFilter} onChange={(e) => setModuleFilter(e.target.value)}>
              <option value="">{t('feedback.allModules')}</option>
              {FEEDBACK_MODULE_IDS.filter(Boolean).map((id) => (
                <option key={id} value={id}>
                  {moduleLabel(id)}
                </option>
              ))}
            </select>
          </label>
        </div>
        {listed.length === 0 ? (
          <EmptyState icon={MessageSquarePlus} title={t('feedback.empty')} hint={t('feedback.emptyHint')} />
        ) : (
          <ul className="space-y-3">
            {listed.map((item) => {
              const status = item.status === 'nouveau' ? 'new' : item.status || 'new'
              const voted = (item.voterIds || []).includes(user.id)
              return (
                <li key={item.id} className="rounded-2xl border border-sage-200 bg-white/80 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-display text-lg text-sage-900">{item.title}</h3>
                      <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-sage-500">
                        <span className="rounded-full bg-sage-100 px-2 py-0.5 font-semibold text-sage-800">{t(statusKey(status))}</span>
                        {item.module ? <span>{moduleLabel(item.module)}</span> : null}
                        <span>
                          {t('feedback.author')}: {nameOf(item.userId, item)}
                        </span>
                        <span>
                          {t('feedback.date')}: {item.createdAt ? new Date(item.createdAt).toLocaleString(dateLocale(lang)) : ''}
                        </span>
                        <span>{t('feedback.votes', { n: item.votes || 0 })}</span>
                        {item.source === 'import' ? <span>{t('feedback.sourceImport')}</span> : null}
                        {inbox ? (
                          <span>
                            {t('feedback.orgLabel')}: {orgName(item.orgId)}
                          </span>
                        ) : null}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" className={btnGhost} onClick={() => onVote(item.id)}>
                        <ThumbsUp size={16} /> {voted ? t('feedback.unvote') : t('feedback.vote')}
                      </button>
                      {admin && (
                        <button type="button" className={btnGhost + ' !text-danger'} onClick={() => setDeleteId(item.id)} aria-label={t('feedback.confirmDelete')}>
                          <Trash2 size={16} />
                          {t('common.delete')}
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm text-sage-700">{item.body}</p>
                  {canModerate && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <label className="text-xs font-medium text-sage-700">
                        {t('feedback.changeStatus')}
                        <select
                          className={inputClass + ' mt-1'}
                          value={status}
                          onChange={(e) => onUpdate(item.id, { status: e.target.value })}
                        >
                          {STATUSES.map((value) => (
                            <option key={value} value={value}>
                              {t(statusKey(value))}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="text-xs font-medium text-sage-700">
                        {t('feedback.priority')}
                        <select
                          className={inputClass + ' mt-1'}
                          value={item.priority || 'normal'}
                          onChange={(e) => onUpdate(item.id, { priority: e.target.value })}
                        >
                          <option value="low">{t('feedback.priorityLow')}</option>
                          <option value="normal">{t('feedback.priorityNormal')}</option>
                          <option value="high">{t('feedback.priorityHigh')}</option>
                        </select>
                      </label>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <ConfirmDialog open={Boolean(rewrite)} title={t('feedback.confirmRewrite')} body={rewrite ? `${t('feedback.fieldTitle')} : ${rewrite.title}\n\n${rewrite.body}` : ''} confirmLabel={t('feedback.useText')} cancelLabel={t('feedback.keepMine')} onConfirm={applyRewrite} onClose={() => setRewrite(null)} busy={busy} />
      <ConfirmDialog open={confirmSend} title={t('feedback.confirmSend')} body={t('feedback.confirmSendHint')} confirmLabel={t('feedback.send')} onConfirm={send} onClose={() => setConfirmSend(false)} busy={busy} />
      <ConfirmDialog open={Boolean(deleteId)} title={t('feedback.confirmDelete')} body={t('feedback.confirmDeleteHint')} confirmLabel={t('common.delete')} danger onConfirm={remove} onClose={() => setDeleteId(null)} busy={busy} />
    </div>
  )
}
