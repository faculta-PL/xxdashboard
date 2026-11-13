/** Retours d’amélioration — Lecteur peut envoyer ; admin seule suppression. */
import { useMemo, useState } from 'react'
import { MessageSquarePlus, Sparkles, Trash2, Send } from 'lucide-react'
import { askExternal } from './lib/assistant'
import { parseFeedbackRewrite } from './lib/feedback'
import { isAdmin } from './lib/rbac'
import { ConfirmDialog, EmptyState, StatusBadge, btnGhost, btnPrimary, inputClass } from './components/ui'
import { dateLocale, useI18n } from './i18n'

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
  'autre',
]

function Field({ label, hint, children }) {
  return (
    <label className="mb-3 block text-sm">
      <span className="mb-1 block font-medium text-sage-800">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-sage-500">{hint}</span> : null}
    </label>
  )
}

export default function FeedbackView({ user, users = [], items = [], flash, onSubmit, onDelete }) {
  const { t, lang } = useI18n()
  const admin = isAdmin(user)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [moduleId, setModuleId] = useState('')
  const [busy, setBusy] = useState(false)
  const [rewrite, setRewrite] = useState(null)
  const [confirmSend, setConfirmSend] = useState(false)
  const [deleteId, setDeleteId] = useState(null)

  const nameOf = (id) => users.find((u) => u.id === id)?.fullName || users.find((u) => u.id === id)?.email || '—'
  const moduleLabel = (id) => {
    if (!id) return t('feedback.fieldModule')
    if (id === 'autre') return t('feedback.other')
    const key = `nav.${id}`
    const label = t(key)
    return label === key ? id : label
  }

  const listed = useMemo(
    () =>
      [...items].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)),
    [items],
  )

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

  return (
    <div className="space-y-6 animate-fade-up">
      <section className="rounded-2xl border border-sage-200 bg-white/80 p-5">
        <h2 className="flex items-center gap-2 font-display text-lg text-sage-900">
          <MessageSquarePlus size={18} className="text-sage-700" aria-hidden="true" />
          {t('feedback.propose')}
        </h2>
        <p className="mt-1 text-sm text-sage-600">{t('feedback.hint')}</p>
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
            <input
              className={inputClass}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              required
              placeholder={t('feedback.placeholderTitle')}
            />
          </Field>
          <Field label={t('feedback.fieldMessage')}>
            <textarea
              className={inputClass + ' min-h-32'}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              required
              maxLength={8000}
              placeholder={t('feedback.placeholderBody')}
            />
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
            <button type="submit" className={btnPrimary} disabled={busy}>
              <Send size={16} aria-hidden="true" />
              {t('feedback.send')}
            </button>
          </div>
        </form>
      </section>

      <section>
        <h2 className="mb-3 font-display text-lg text-sage-900">
          {admin ? t('feedback.all') : t('feedback.yours')}
        </h2>
        {listed.length === 0 ? (
          <EmptyState
            icon={MessageSquarePlus}
            title={t('feedback.empty')}
            hint={t('feedback.emptyHint')}
          />
        ) : (
          <ul className="space-y-3">
            {listed.map((item) => (
              <li key={item.id} className="rounded-2xl border border-sage-200 bg-white/80 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-display text-lg text-sage-900">{item.title}</h3>
                    <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-sage-500">
                      <StatusBadge value={item.status || 'nouveau'} />
                      {item.module ? <span>{moduleLabel(item.module)}</span> : null}
                      {admin ? <span>{nameOf(item.userId)}</span> : null}
                      <span>
                        {item.createdAt
                          ? new Date(item.createdAt).toLocaleString(dateLocale(lang))
                          : ''}
                      </span>
                    </p>
                  </div>
                  {admin && (
                    <button
                      type="button"
                      className={btnGhost + ' !text-danger'}
                      onClick={() => setDeleteId(item.id)}
                      aria-label={t('feedback.confirmDelete')}
                    >
                      <Trash2 size={16} />
                      {t('common.delete')}
                    </button>
                  )}
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm text-sage-700">{item.body}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ConfirmDialog
        open={Boolean(rewrite)}
        title={t('feedback.confirmRewrite')}
        body={
          rewrite
            ? `${t('feedback.fieldTitle')} : ${rewrite.title}\n\n${rewrite.body}`
            : ''
        }
        confirmLabel={t('feedback.useText')}
        cancelLabel={t('feedback.keepMine')}
        onConfirm={applyRewrite}
        onClose={() => setRewrite(null)}
        busy={busy}
      />
      <ConfirmDialog
        open={confirmSend}
        title={t('feedback.confirmSend')}
        body={t('feedback.confirmSendHint')}
        confirmLabel={t('feedback.send')}
        onConfirm={send}
        onClose={() => setConfirmSend(false)}
        busy={busy}
      />
      <ConfirmDialog
        open={Boolean(deleteId)}
        title={t('feedback.confirmDelete')}
        body={t('feedback.confirmDeleteHint')}
        confirmLabel={t('common.delete')}
        danger
        onConfirm={remove}
        onClose={() => setDeleteId(null)}
        busy={busy}
      />
    </div>
  )
}
