/** Retours d’amélioration — Lecteur peut envoyer ; admin seule suppression. */
import { useMemo, useState } from 'react'
import { MessageSquarePlus, Sparkles, Trash2, Send } from 'lucide-react'
import { askExternal } from './lib/assistant'
import { parseFeedbackRewrite } from './lib/feedback'
import { isAdmin } from './lib/rbac'
import { ConfirmDialog, EmptyState, StatusBadge, btnGhost, btnPrimary, inputClass } from './components/ui'

const FEEDBACK_MODULES = [
  { id: '', label: '— (optionnel)' },
  { id: 'dashboard', label: 'Tableau de bord' },
  { id: 'projects', label: 'Projets' },
  { id: 'notes', label: 'Notes' },
  { id: 'ideas', label: 'Kanban' },
  { id: 'calendar', label: 'Calendrier' },
  { id: 'files', label: 'Fichiers' },
  { id: 'budget', label: 'Budget' },
  { id: 'risks', label: 'Risques' },
  { id: 'canvas', label: 'Espace visuel' },
  { id: 'team', label: 'Équipe' },
  { id: 'chat', label: 'Chat' },
  { id: 'assistant', label: 'Assistant IA' },
  { id: 'create', label: 'Création' },
  { id: 'games', label: 'Jeux' },
  { id: 'autre', label: 'Autre' },
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
  const admin = isAdmin(user)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [moduleId, setModuleId] = useState('')
  const [busy, setBusy] = useState(false)
  const [rewrite, setRewrite] = useState(null)
  const [confirmSend, setConfirmSend] = useState(false)
  const [deleteId, setDeleteId] = useState(null)

  const nameOf = (id) => users.find((u) => u.id === id)?.fullName || users.find((u) => u.id === id)?.email || '—'
  const moduleLabel = (id) => FEEDBACK_MODULES.find((m) => m.id === id)?.label || id || '—'

  const listed = useMemo(
    () =>
      [...items].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)),
    [items],
  )

  const helpFormulate = async () => {
    const draftTitle = title.trim()
    const draftBody = body.trim()
    if (!draftTitle && !draftBody) {
      flash('Saisissez un titre ou un message à clarifier.', 'err')
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
      if (!parsed.body && !parsed.title) throw new Error('Réécriture vide.')
      setRewrite({
        title: parsed.title || draftTitle,
        body: parsed.body || draftBody,
      })
    } catch (err) {
      flash(err.message || 'Reformulation impossible.', 'err')
    } finally {
      setBusy(false)
    }
  }

  const applyRewrite = () => {
    if (!rewrite) return
    setTitle(rewrite.title)
    setBody(rewrite.body)
    setRewrite(null)
    flash('Texte clarifié — relisez puis envoyez.')
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
      flash('Retour envoyé. Merci.')
    } catch (err) {
      flash(err.message || 'Envoi impossible.', 'err')
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
      flash('Retour supprimé.')
    } catch (err) {
      flash(err.message || 'Suppression impossible.', 'err')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6 animate-fade-up">
      <section className="rounded-2xl border border-sage-200 bg-white/80 p-5">
        <h2 className="flex items-center gap-2 font-display text-lg text-sage-900">
          <MessageSquarePlus size={18} className="text-sage-700" aria-hidden="true" />
          Proposer une amélioration
        </h2>
        <p className="mt-1 text-sm text-sage-600">
          Une idée, un manque, un module à inventer. L’équipe admin est notifiée. Aucun secret dans ce formulaire.
        </p>
        <form
          className="mt-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (!title.trim() || !body.trim()) {
              flash('Titre et message sont requis.', 'err')
              return
            }
            setConfirmSend(true)
          }}
        >
          <Field label="Titre">
            <input
              className={inputClass}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              required
              placeholder="Ex. Export PDF des notes liées"
            />
          </Field>
          <Field label="Message">
            <textarea
              className={inputClass + ' min-h-32'}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              required
              maxLength={8000}
              placeholder="Décrivez le besoin, le module concerné, et ce que cela changerait."
            />
          </Field>
          <Field label="Module (optionnel)">
            <select className={inputClass} value={moduleId} onChange={(e) => setModuleId(e.target.value)}>
              {FEEDBACK_MODULES.map((m) => (
                <option key={m.id || 'none'} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </Field>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btnGhost} onClick={helpFormulate} disabled={busy}>
              <Sparkles size={16} aria-hidden="true" />
              Aider-moi à formuler
            </button>
            <button type="submit" className={btnPrimary} disabled={busy}>
              <Send size={16} aria-hidden="true" />
              Envoyer
            </button>
          </div>
        </form>
      </section>

      <section>
        <h2 className="mb-3 font-display text-lg text-sage-900">
          {admin ? 'Tous les retours' : 'Vos retours'}
        </h2>
        {listed.length === 0 ? (
          <EmptyState
            icon={MessageSquarePlus}
            title="Aucun retour pour l’instant"
            hint="Une idée d’amélioration ? Écrivez-la ci-dessus — même une phrase suffit."
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
                          ? new Date(item.createdAt).toLocaleString('fr-FR')
                          : ''}
                      </span>
                    </p>
                  </div>
                  {admin && (
                    <button
                      type="button"
                      className={btnGhost + ' !text-danger'}
                      onClick={() => setDeleteId(item.id)}
                      aria-label="Supprimer ce retour"
                    >
                      <Trash2 size={16} />
                      Supprimer
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
        title="Appliquer la reformulation ?"
        body={
          rewrite
            ? `Titre : ${rewrite.title}\n\n${rewrite.body}`
            : ''
        }
        confirmLabel="Utiliser ce texte"
        cancelLabel="Garder le mien"
        onConfirm={applyRewrite}
        onClose={() => setRewrite(null)}
        busy={busy}
      />
      <ConfirmDialog
        open={confirmSend}
        title="Envoyer ce retour ?"
        body="Un administrateur sera notifié. Vérifiez qu’il n’y a aucun mot de passe ni clé."
        confirmLabel="Envoyer"
        onConfirm={send}
        onClose={() => setConfirmSend(false)}
        busy={busy}
      />
      <ConfirmDialog
        open={Boolean(deleteId)}
        title="Supprimer ce retour ?"
        body="Cette action est définitive."
        confirmLabel="Supprimer"
        danger
        onConfirm={remove}
        onClose={() => setDeleteId(null)}
        busy={busy}
      />
    </div>
  )
}
