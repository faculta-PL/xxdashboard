import { useEffect, useRef, useState } from 'react'
import {
  Sparkles,
  X,
  Minus,
  Plus,
  Send,
  Copy,
  Trash2,
  ChevronRight,
  Loader2,
  Globe,
  Shield,
  List,
  AlignLeft,
  Rows3,
  Check,
} from 'lucide-react'
import {
  FAB_VIEWS,
  localAnswer,
  parseActions,
  parseActionsFromAssistant,
  wantsWebSearch,
  webQueryFrom,
  askExternal,
  searchWeb,
  formatWebBlock,
  fetchAiStatus,
  writeExternalPref,
  writeWebPref,
  stripExternalContext,
} from './lib/assistant'
import {
  saveAiThread,
  deleteAiThread,
  saveNote,
  saveIdea,
  saveRisk,
  saveBudgetLine,
  createNotification,
  sendMessage,
  ensureGeneralGroup,
  saveUserSettings,
  toUserMessage,
} from './lib/store'
import { canWriteRole } from './lib/rbac'

const inputClass =
  'w-full min-h-11 rounded-xl border border-sage-300 bg-white px-3 py-2.5 text-sage-900 outline-none ring-sage-400 placeholder:text-sage-400 focus:ring-2'
const btnPrimary =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-sage-700 px-4 py-2.5 text-sm font-semibold text-sage-50 transition hover:bg-sage-800 disabled:opacity-50'
const btnGhost =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-sage-300 bg-white/70 px-3 py-2 text-sm font-medium text-sage-800 transition hover:bg-sage-100'

function nowIso() {
  return new Date().toISOString()
}

export function AssistantFab({ view, open, onOpen }) {
  if (open || !FAB_VIEWS.includes(view)) return null
  return (
    <button
      type="button"
      onClick={onOpen}
      className="fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-[max(1rem,env(safe-area-inset-right))] z-30 inline-flex min-h-12 items-center gap-2 rounded-full bg-sage-700 px-4 py-3 text-sm font-semibold text-sage-50 shadow-lg hover:bg-sage-800"
      aria-label="Ouvrir l’assistant IA"
    >
      <Sparkles size={18} />
      <span className="hidden sm:inline">Assistant IA</span>
    </button>
  )
}

function LocalAiBanner({ hasKey, allowExternal }) {
  if (hasKey && allowExternal) return null
  return (
    <div className="rounded-xl border border-sage-300 bg-sage-100/80 px-3 py-2 text-xs text-sage-800">
      <p className="font-semibold">IA locale, pas de sync, pas d’envoi auto.</p>
      <p className="mt-0.5 text-sage-600">
        {hasKey
          ? 'Cochez « Autoriser l’envoi au service IA » pour utiliser la clé serveur.'
          : 'Aucune clé serveur — réponses extractives sur l’appareil.'}
      </p>
    </div>
  )
}

function Bubble({ msg, onCopy }) {
  const isAi = msg.role !== 'user'
  return (
    <div className={`flex ${isAi ? 'justify-start' : 'justify-end'}`}>
      <div
        className={`max-w-[92%] rounded-2xl border px-3 py-2 text-sm whitespace-pre-wrap ${
          isAi
            ? 'border-sage-300 bg-sage-100 text-sage-900'
            : 'border-sage-200 bg-white text-sage-800'
        }`}
      >
        <div className="mb-1 flex items-center justify-between gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-sage-500">
            {isAi ? 'Nazix IA' : 'Vous'}
            {msg.origin === 'web' ? ' · web' : ''}
          </span>
          {isAi && (
            <button
              type="button"
              className="rounded p-1 text-sage-500 hover:bg-sage-200 hover:text-sage-800"
              onClick={() => onCopy(msg.content)}
              aria-label="Copier la réponse"
            >
              <Copy size={12} />
            </button>
          )}
        </div>
        {msg.content}
        {msg.sources?.length > 0 && (
          <p className="mt-2 text-[11px] text-sage-600">
            Nazix : {msg.sources.map((s) => `« ${s.title} »`).join(', ')}
          </p>
        )}
        {msg.webSources?.length > 0 && (
          <ul className="mt-2 space-y-1 border-t border-sage-200 pt-2 text-[11px]">
            <li className="font-semibold text-sage-600">
              Web · {msg.webSearchedAt ? new Date(msg.webSearchedAt).toLocaleString('fr-FR') : ''}
            </li>
            {msg.webSources.map((s, i) => (
              <li key={`${s.url || s.title}-${i}`}>
                {s.url ? (
                  <a href={s.url} target="_blank" rel="noreferrer" className="text-sage-700 underline">
                    {s.title}
                  </a>
                ) : (
                  <span>{s.title}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function ActionButtons({ actions, canWrite, onPick }) {
  if (!actions?.length) return null
  return (
    <div className="flex flex-wrap gap-1.5">
      {actions.map((a) => (
        <button
          key={a.kind}
          type="button"
          className={btnGhost + ' !min-h-9 !px-2.5 !py-1.5 !text-xs'}
          disabled={!canWrite && a.kind !== 'draft_message'}
          title={!canWrite && a.kind !== 'draft_message' ? 'Lecture seule — actions désactivées' : ''}
          onClick={() => onPick(a)}
        >
          {a.label}
        </button>
      ))}
    </div>
  )
}

function ConfirmAction({ action, users, projects, budgets, notes, user, onClose, onApply, busy }) {
  const [draft, setDraft] = useState(() => ({ ...(action?.draft || {}) }))
  if (!action) return null
  const canWrite = canWriteRole(user)
  const writeBlocked = !canWrite && action.kind !== 'draft_message'
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-3">
      <button type="button" className="absolute inset-0" aria-label="Fermer" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-t-2xl bg-sage-50 p-4 shadow-xl sm:rounded-2xl">
        <h3 className="font-display text-lg text-sage-900">Confirmer — {action.label}</h3>
        <p className="mt-1 text-xs text-sage-600">Aucune action n’est exécutée sans votre confirmation.</p>
        {writeBlocked && (
          <p className="mt-2 rounded-lg bg-warn/10 px-2 py-1 text-xs text-warn">Rôle Lecteur : création interdite.</p>
        )}
        <div className="mt-3 space-y-2">
          {(action.kind === 'create_note' || action.kind === 'create_subnote' || action.kind === 'create_idea' || action.kind === 'create_risk') && (
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-sage-800">Titre</span>
              <input className={inputClass} value={draft.title || ''} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
            </label>
          )}
          {action.kind === 'create_subnote' && (
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-sage-800">Note parente</span>
              <select
                className={inputClass}
                value={draft.parentId || ''}
                onChange={(e) => setDraft({ ...draft, parentId: e.target.value })}
              >
                <option value="">Choisir…</option>
                {notes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.title}
                  </option>
                ))}
              </select>
            </label>
          )}
          {(action.kind === 'create_note' || action.kind === 'create_subnote') && (
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-sage-800">Contenu</span>
              <textarea
                className={inputClass + ' min-h-24'}
                value={draft.content || ''}
                onChange={(e) => setDraft({ ...draft, content: e.target.value })}
              />
            </label>
          )}
          {action.kind === 'create_idea' && (
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-sage-800">Description</span>
              <textarea
                className={inputClass + ' min-h-20'}
                value={draft.description || ''}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              />
            </label>
          )}
          {action.kind === 'create_risk' && (
            <>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-sage-800">Projet</span>
                <select
                  className={inputClass}
                  value={draft.projectId || ''}
                  onChange={(e) => setDraft({ ...draft, projectId: e.target.value })}
                >
                  <option value="">Choisir…</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-sage-800">Description</span>
                <textarea
                  className={inputClass + ' min-h-16'}
                  value={draft.description || ''}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                />
              </label>
            </>
          )}
          {action.kind === 'create_budget_line' && (
            <>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-sage-800">Budget</span>
                <select
                  className={inputClass}
                  value={draft.budgetId || ''}
                  onChange={(e) => setDraft({ ...draft, budgetId: e.target.value })}
                >
                  <option value="">Choisir…</option>
                  {budgets.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-sage-800">Libellé</span>
                <input className={inputClass} value={draft.name || ''} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-sage-800">Montant</span>
                <input
                  type="number"
                  min="0"
                  className={inputClass}
                  value={draft.amount || ''}
                  onChange={(e) => setDraft({ ...draft, amount: e.target.value })}
                />
              </label>
            </>
          )}
          {action.kind === 'draft_message' && (
            <>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-sage-800">Destinataire</span>
                <select
                  className={inputClass}
                  value={draft.userId || ''}
                  onChange={(e) => setDraft({ ...draft, userId: e.target.value })}
                >
                  <option value="">Choisir un membre…</option>
                  {users
                    .filter((u) => u.id !== user.id)
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.fullName} · {u.email}
                      </option>
                    ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-sage-800">Brouillon</span>
                <textarea
                  className={inputClass + ' min-h-24'}
                  value={draft.body || ''}
                  onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                />
              </label>
              <label className="flex items-center gap-2 text-sm text-sage-800">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-sage-700"
                  checked={Boolean(draft.postGeneral)}
                  onChange={(e) => setDraft({ ...draft, postGeneral: e.target.checked })}
                />
                Publier aussi dans le chat Général
              </label>
            </>
          )}
        </div>
        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" className={btnGhost} onClick={onClose}>
            Annuler
          </button>
          <button
            type="button"
            className={btnPrimary}
            disabled={busy || writeBlocked}
            onClick={() => onApply({ ...action, draft })}
          >
            <Check size={16} /> Confirmer
          </button>
        </div>
      </div>
    </div>
  )
}

function useAiChat({
  user,
  threads,
  section,
  context,
  users,
  flash,
  allowExternal,
  setAllowExternal,
  webSearch,
  setWebSearch,
}) {
  const [threadId, setThreadId] = useState(null)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [hasKey, setHasKey] = useState(false)
  const [pendingAction, setPendingAction] = useState(null)
  const [actionBusy, setActionBusy] = useState(false)
  const bottomRef = useRef(null)

  const thread = threads.find((t) => t.id === threadId) || null
  const messages = thread?.messages || []

  useEffect(() => {
    fetchAiStatus().then((s) => setHasKey(Boolean(s.hasKey))).catch(() => setHasKey(false))
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length, busy])

  const persist = async (id, patch) => {
    const saved = await saveAiThread({ id, section, contextLabel: context.contextLabel, ...patch }, user)
    setThreadId(saved.id)
    return saved
  }

  const startNew = async () => {
    const saved = await saveAiThread(
      {
        title: 'Nouvelle conversation',
        section,
        contextLabel: context.contextLabel,
        messages: [],
      },
      user,
    )
    setThreadId(saved.id)
    setError('')
    setDraft('')
  }

  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text)
      flash?.('Réponse copiée.')
    } catch {
      flash?.('Copie impossible.', 'err')
    }
  }

  const runTurn = async (userText, style = '') => {
    const text = String(userText || '').trim()
    if (!text || busy) return
    setBusy(true)
    setError('')
    const userMsg = { role: 'user', content: text, at: nowIso() }
    let id = threadId
    let history = messages
    try {
      if (!id) {
        const created = await saveAiThread(
          {
            title: text,
            section,
            contextLabel: context.contextLabel,
            messages: [userMsg],
          },
          user,
        )
        id = created.id
        history = created.messages
        setThreadId(id)
      } else {
        history = [...messages, userMsg]
        await persist(id, { messages: history })
      }

      const wantWeb = wantsWebSearch(text, webSearch)
      let answerText = ''
      let sources = []
      let origin = 'nazix'
      let usedExternal = false

      try {
        if (allowExternal && hasKey) {
          const payloadCtx = allowExternal ? context : stripExternalContext(context)
          const ext = await askExternal({
            messages: history.filter((m) => m.role === 'user' || m.role === 'assistant'),
            context: payloadCtx,
            allowExternal: true,
          })
          if (ext.ok && ext.text) {
            answerText = ext.text
            usedExternal = true
            origin = 'nazix'
          }
        }
      } catch {
        const msg = 'Service IA indisponible — repli local.'
        setError(msg)
        flash?.(msg, 'warn')
      }

      if (!answerText) {
        const local = localAnswer(style ? `${style}: ${text}` : text, context, style)
        answerText = local.text
        sources = local.sources
      } else {
        sources = localAnswer(text, context).sources
      }

      let webSources = []
      let webSearchedAt = ''
      if (wantWeb) {
        try {
          const web = await searchWeb(webQueryFrom(text))
          webSources = web.results || []
          webSearchedAt = web.searchedAt || nowIso()
          answerText += formatWebBlock(web)
        } catch {
          answerText += '\n\n---\n**Web** — recherche indisponible.'
          flash?.('Recherche web indisponible.', 'warn')
        }
      }

      const heuristicActions = [
        ...parseActions(text, context),
        ...parseActionsFromAssistant(answerText, context),
      ]
      const seen = new Set()
      const actions = heuristicActions.filter((a) => {
        if (seen.has(a.kind)) return false
        seen.add(a.kind)
        return true
      })

      const aiMsg = {
        role: 'assistant',
        content: answerText,
        sources,
        webSources,
        webSearchedAt,
        actions,
        origin: usedExternal ? 'external' : origin,
        at: nowIso(),
      }
      await persist(id, { messages: [...history, aiMsg], contextLabel: context.contextLabel, section })
    } catch (err) {
      const msg = toUserMessage(err, 'Service IA indisponible.')
      setError(msg)
      flash?.(msg, 'err')
    } finally {
      setBusy(false)
    }
  }

  const send = async (e) => {
    e?.preventDefault?.()
    const text = draft.trim()
    if (!text) return
    setDraft('')
    await runTurn(text)
  }

  const followUp = (style, label) => runTurn(label, style)

  const applyAction = async (action) => {
    if (action.kind !== 'draft_message' && !canWriteRole(user)) {
      flash?.('Permission refusée (Lecteur).', 'err')
      return
    }
    setActionBusy(true)
    try {
      const d = action.draft || {}
      if (action.kind === 'create_note' || action.kind === 'create_subnote') {
        if (action.kind === 'create_subnote' && !d.parentId) throw new Error('Choisissez une note parente.')
        await saveNote(
          {
            title: String(d.title || '').trim() || 'Note IA',
            content: d.content || '',
            category: 'Général',
            visibility: 'Privée',
            shares: [],
            parentId: action.kind === 'create_subnote' ? d.parentId : null,
          },
          user,
        )
        flash?.('Note créée (privée).')
      } else if (action.kind === 'create_idea') {
        await saveIdea(
          {
            title: String(d.title || '').trim() || 'Idée IA',
            description: d.description || '',
            status: 'Nouvelle',
            visibility: 'Privée',
            shares: [],
          },
          user,
        )
        flash?.('Idée créée (privée).')
      } else if (action.kind === 'create_risk') {
        if (!d.projectId) throw new Error('Choisissez un projet.')
        await saveRisk(
          {
            title: String(d.title || '').trim() || 'Risque IA',
            description: d.description || '',
            projectId: d.projectId,
            category: d.category || 'autre',
            probability: d.probability || 'moyenne',
            impact: d.impact || 'moyen',
            visibility: 'Privée',
            shares: [],
          },
          user,
        )
        flash?.('Risque créé (privé).')
      } else if (action.kind === 'create_budget_line') {
        if (!d.budgetId) throw new Error('Choisissez un budget.')
        await saveBudgetLine(
          {
            budgetId: d.budgetId,
            kind: d.kind || 'planned',
            category: d.category || 'Autres',
            name: String(d.name || '').trim() || 'Ligne IA',
            amount: Number(d.amount || 0),
          },
          user,
        )
        flash?.('Ligne budgétaire créée.')
      } else if (action.kind === 'draft_message') {
        if (!d.userId) throw new Error('Choisissez un destinataire.')
        const body = String(d.body || '').trim()
        if (!body) throw new Error('Message vide.')
        const target = users.find((u) => u.id === d.userId)
        await createNotification({
          userId: d.userId,
          type: 'ai_message',
          title: `Message de ${user.fullName}`,
          body,
          meta: { fromId: user.id },
        })
        if (d.postGeneral) {
          const general = await ensureGeneralGroup(user)
          await sendMessage(general.id, `${target ? `@${target.fullName} ` : ''}${body}`, user)
        }
        flash?.(d.postGeneral ? 'Notification envoyée et publiée dans Général.' : 'Notification envoyée.')
      }
      setPendingAction(null)
    } catch (err) {
      flash?.(toUserMessage(err, 'Action impossible.'), 'err')
    } finally {
      setActionBusy(false)
    }
  }

  const remove = async (id) => {
    await deleteAiThread(id, user)
    if (threadId === id) setThreadId(null)
    flash?.('Conversation supprimée.')
  }

  return {
    threadId,
    setThreadId,
    thread,
    messages,
    draft,
    setDraft,
    busy,
    error,
    setError,
    hasKey,
    pendingAction,
    setPendingAction,
    actionBusy,
    bottomRef,
    startNew,
    send,
    runTurn,
    followUp,
    copy,
    applyAction,
    remove,
    persistAllow: async (value) => {
      setAllowExternal(value)
      writeExternalPref(value)
      try {
        await saveUserSettings(user, { aiExternalEnabled: value })
      } catch {
        /* localStorage already written */
      }
    },
    persistWeb: (value) => {
      setWebSearch(value)
      writeWebPref(value)
    },
    allowExternal,
    webSearch,
  }
}

function ChatPane({
  chat,
  context,
  user,
  users,
  projects,
  budgets,
  notes,
  compact,
}) {
  const canWrite = canWriteRole(user)
  const lastAi = [...chat.messages].reverse().find((m) => m.role === 'assistant')
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3 xx-scroll">
        <LocalAiBanner hasKey={chat.hasKey} allowExternal={chat.allowExternal} />
        <p className="text-[11px] font-medium text-sage-600">{context.contextLabel}</p>
        {chat.messages.length === 0 && (
          <p className="text-sm text-sage-600">
            Posez une question sur vos notes, le budget restant, les risques en retard ou les prochains événements.
            Rien n’est envoyé hors de l’appareil tant que vous n’autorisez pas le service IA.
          </p>
        )}
        {chat.messages.map((m, i) => (
          <div key={`${m.at}-${i}`} className="space-y-1.5">
            <Bubble msg={m} onCopy={chat.copy} />
            {m.role === 'assistant' && m.actions?.length > 0 && (
              <ActionButtons
                actions={m.actions}
                canWrite={canWrite}
                onPick={chat.setPendingAction}
              />
            )}
          </div>
        ))}
        {chat.busy && (
          <div className="flex items-center gap-2 rounded-2xl border border-sage-300 bg-sage-100 px-3 py-2 text-sm text-sage-700">
            <Loader2 size={14} className="animate-spin" /> Réflexion…
          </div>
        )}
        {chat.error && (
          <div className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
            {chat.error}
            <button type="button" className="ml-2 underline" onClick={() => chat.setError('')}>
              Fermer
            </button>
          </div>
        )}
        {lastAi && !chat.busy && (
          <div className="flex flex-wrap gap-1">
            <button type="button" className={btnGhost + ' !min-h-8 !px-2 !py-1 !text-xs'} onClick={() => chat.followUp('short', 'Plus court')}>
              <AlignLeft size={12} /> Plus court
            </button>
            <button type="button" className={btnGhost + ' !min-h-8 !px-2 !py-1 !text-xs'} onClick={() => chat.followUp('detailed', 'Plus détaillé')}>
              <Rows3 size={12} /> Plus détaillé
            </button>
            <button type="button" className={btnGhost + ' !min-h-8 !px-2 !py-1 !text-xs'} onClick={() => chat.followUp('list', 'Liste')}>
              <List size={12} /> Liste
            </button>
          </div>
        )}
        <div ref={chat.bottomRef} />
      </div>
      <form onSubmit={chat.send} className="border-t border-sage-200 p-3">
        <div className="mb-2 flex flex-wrap gap-3 text-[11px] text-sage-700">
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              className="h-3.5 w-3.5 accent-sage-700"
              checked={chat.allowExternal}
              onChange={(e) => chat.persistAllow(e.target.checked)}
            />
            Autoriser l’envoi au service IA
          </label>
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              className="h-3.5 w-3.5 accent-sage-700"
              checked={chat.webSearch}
              onChange={(e) => chat.persistWeb(e.target.checked)}
            />
            <Globe size={12} /> Recherche web
          </label>
        </div>
        <div className="flex gap-2">
          <input
            className={inputClass}
            placeholder={compact ? 'Votre question…' : 'Résume mes notes, risques en retard, budget restant…'}
            value={chat.draft}
            onChange={(e) => chat.setDraft(e.target.value)}
            disabled={chat.busy}
          />
          <button type="submit" className={btnPrimary + ' !px-3'} disabled={chat.busy || !chat.draft.trim()} aria-label="Envoyer">
            <Send size={16} />
          </button>
        </div>
      </form>
      {chat.pendingAction && (
        <ConfirmAction
          key={chat.pendingAction.kind}
          action={chat.pendingAction}
          users={users}
          projects={projects}
          budgets={budgets}
          notes={notes}
          user={user}
          busy={chat.actionBusy}
          onClose={() => chat.setPendingAction(null)}
          onApply={chat.applyAction}
        />
      )}
    </div>
  )
}

export function AssistantPanel({
  open,
  collapsed,
  onCollapse,
  onClose,
  user,
  threads,
  section,
  context,
  users,
  projects,
  budgets,
  notes,
  flash,
  allowExternal,
  setAllowExternal,
  webSearch,
  setWebSearch,
}) {
  const chat = useAiChat({
    user,
    threads,
    section,
    context,
    users,
    flash,
    allowExternal,
    setAllowExternal,
    webSearch,
    setWebSearch,
  })

  if (!open) return null
  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => onCollapse(false)}
        className="fixed top-1/2 right-0 z-30 flex h-24 w-10 -translate-y-1/2 items-center justify-center rounded-l-xl bg-sage-700 text-sage-50 shadow"
        aria-label="Déplier l’assistant"
      >
        <Sparkles size={16} />
      </button>
    )
  }

  return (
    <aside className="fixed inset-0 z-40 flex flex-col bg-cream-green shadow-xl lg:inset-y-0 lg:left-auto lg:right-0 lg:w-[360px] lg:border-l lg:border-sage-200">
      <header className="flex items-center gap-2 border-b border-sage-200 px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <Sparkles size={16} className="text-sage-700" />
        <h2 className="min-w-0 flex-1 truncate font-display text-base text-sage-900">Assistant IA</h2>
        <button type="button" className="rounded-lg p-2 text-sage-600 hover:bg-sage-200" onClick={() => chat.startNew()} aria-label="Nouvelle conversation">
          <Plus size={16} />
        </button>
        <button type="button" className="hidden rounded-lg p-2 text-sage-600 hover:bg-sage-200 lg:inline-flex" onClick={() => onCollapse(true)} aria-label="Replier">
          <Minus size={16} />
        </button>
        <button type="button" className="rounded-lg p-2 text-sage-600 hover:bg-sage-200" onClick={onClose} aria-label="Fermer">
          <X size={16} />
        </button>
      </header>
      <ChatPane
        chat={chat}
        context={context}
        user={user}
        users={users}
        projects={projects}
        budgets={budgets}
        notes={notes}
        compact
      />
    </aside>
  )
}

export function AssistantView({
  user,
  threads,
  section,
  context,
  users,
  projects,
  budgets,
  notes,
  flash,
  allowExternal,
  setAllowExternal,
  webSearch,
  setWebSearch,
}) {
  const chat = useAiChat({
    user,
    threads,
    section,
    context,
    users,
    flash,
    allowExternal,
    setAllowExternal,
    webSearch,
    setWebSearch,
  })
  const [mobileThread, setMobileThread] = useState(false)

  return (
    <div className="flex min-h-[calc(100dvh-8rem)] flex-col gap-3 lg:flex-row">
      <aside className={`${mobileThread ? 'hidden lg:flex' : 'flex'} w-full flex-col rounded-2xl border border-sage-200 bg-white/80 lg:w-72`}>
        <div className="flex items-center justify-between gap-2 border-b border-sage-200 px-3 py-2">
          <p className="font-display text-sage-900">Conversations</p>
          <button
            type="button"
            className={btnGhost + ' !min-h-9 !px-2'}
            onClick={async () => {
              await chat.startNew()
              setMobileThread(true)
            }}
          >
            <Plus size={14} /> Nouveau
          </button>
        </div>
        <ul className="flex-1 overflow-y-auto xx-scroll p-2">
          {threads.length === 0 && <li className="px-2 py-6 text-center text-sm text-sage-500">Aucune conversation.</li>}
          {threads.map((t) => (
            <li key={t.id}>
              <div
                className={`mb-1 flex items-center gap-1 rounded-xl px-2 py-2 ${
                  chat.threadId === t.id ? 'bg-sage-200' : 'hover:bg-sage-100'
                }`}
              >
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() => {
                    chat.setThreadId(t.id)
                    setMobileThread(true)
                  }}
                >
                  <p className="truncate text-sm font-medium text-sage-900">{t.title}</p>
                  <p className="truncate text-[11px] text-sage-500">{t.contextLabel || t.section}</p>
                </button>
                <button
                  type="button"
                  className="rounded p-1.5 text-sage-500 hover:bg-white hover:text-danger"
                  onClick={() => chat.remove(t.id)}
                  aria-label="Supprimer la conversation"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      </aside>
      <section className={`${mobileThread ? 'flex' : 'hidden lg:flex'} min-w-0 flex-1 flex-col rounded-2xl border border-sage-200 bg-white/70`}>
        <div className="flex items-center gap-2 border-b border-sage-200 px-3 py-2 lg:hidden">
          <button type="button" className={btnGhost + ' !min-h-9'} onClick={() => setMobileThread(false)}>
            <ChevronRight size={14} className="rotate-180" /> Liste
          </button>
          <p className="truncate text-sm font-medium">{chat.thread?.title || 'Assistant IA'}</p>
        </div>
        <ChatPane
          chat={chat}
          context={context}
          user={user}
          users={users}
          projects={projects}
          budgets={budgets}
          notes={notes}
        />
      </section>
    </div>
  )
}

export function AiSettingsBlock({ user, allowExternal, onChange }) {
  return (
    <section className="rounded-2xl border border-sage-200 bg-white/80 p-5">
      <h2 className="flex items-center gap-2 font-display text-lg text-sage-900">
        <Sparkles size={18} /> Assistant IA
      </h2>
      <p className="mt-2 text-sm text-sage-600">
        Les clés API restent côté serveur (<code className="rounded bg-sage-100 px-1">OPENAI_API_KEY</code>,{' '}
        <code className="rounded bg-sage-100 px-1">ANTHROPIC_API_KEY</code> ou{' '}
        <code className="rounded bg-sage-100 px-1">GROK_API_KEY</code>) — jamais dans <code className="rounded bg-sage-100 px-1">VITE_*</code>.
        Sans clé, l’assistant extractif fonctionne hors ligne.
      </p>
      <label className="mt-3 flex items-start gap-2 rounded-xl border border-sage-200 bg-white p-3 text-sm">
        <input
          type="checkbox"
          className="mt-1 h-4 w-4 accent-sage-700"
          checked={allowExternal}
          onChange={async (e) => {
            const value = e.target.checked
            writeExternalPref(value)
            onChange(value)
            try {
              await saveUserSettings(user, { aiExternalEnabled: value })
            } catch {
              /* ignore */
            }
          }}
        />
        <span>
          <span className="font-medium text-sage-800">Autoriser l’envoi au service IA</span>
          <span className="mt-0.5 block text-xs text-sage-500">
            Désactivé par défaut. Les corps de notes / fichiers ne quittent pas l’appareil tant que cette case n’est pas cochée
            ({/* */}préférences <code className="rounded bg-sage-100 px-1">xx_settings.aiExternalEnabled</code>
            {' '}et <code className="rounded bg-sage-100 px-1">nazix_ai_external</code>).
          </span>
        </span>
      </label>
      <p className="mt-2 flex items-center gap-1 text-xs text-sage-500">
        <Shield size={12} /> Pas de mémoire croisée. L’IA ne supprime rien, ne partage pas et ne change pas les ACL.
      </p>
    </section>
  )
}

