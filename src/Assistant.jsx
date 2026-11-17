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
  Globe,
  Shield,
  List,
  AlignLeft,
  Rows3,
  Check,
  Square,
  Mic,
} from 'lucide-react'
import { useI18n } from './i18n'
import {
  FAB_VIEWS,
  localAnswer,
  parseActions,
  parseActionsFromAssistant,
  wantsWebSearch,
  webQueryFrom,
  askExternal,
  askExternalStream,
  searchWeb,
  formatSearchError,
  effectiveUserQuestion,
  isGreeting,
  isModeSwitch,
  isWorkspaceQuestion,
  shapeResearchText,
  fetchAiStatus,
  writeExternalPref,
  writeWebPref,
  openAiUnavailable,
  displayAiContent,
  visibleStreamContent,
  mergeAiActions,
  splitDisplayAndActions,
} from './lib/assistant'
import {
  saveAiThread,
  deleteAiThread,
  saveNote,
  saveIdea,
  saveRisk,
  saveBudgetLine,
  saveEvent,
  saveProject,
  saveTodo,
  saveTodoList,
  getStoreSnapshot,
  createNotification,
  sendMessage,
  ensureGeneralGroup,
  saveUserSettings,
  toUserMessage,
} from './lib/store'
import { canWriteRole } from './lib/rbac'
import { useStickToBottom } from './chat/stick.js'
import { ResearchAnswer } from './chat/ResearchAnswer.jsx'

const inputClass =
  'w-full min-h-11 rounded-xl border border-sage-300 bg-white px-3 py-2.5 text-sage-900 outline-none ring-sage-400 placeholder:text-sage-400 focus:ring-2'
const btnPrimary =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-sage-700 px-4 py-2.5 text-sm font-semibold text-sage-50 transition hover:bg-sage-800 disabled:opacity-50'
const btnGhost =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-sage-300 bg-white/70 px-3 py-2 text-sm font-medium text-sage-800 transition hover:bg-sage-100'

function nowIso() {
  return new Date().toISOString()
}

function messageId() {
  return `msg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function messageKey(message, index) {
  if (message?.id) return message.id
  if (message?.at) return `${message.role || 'm'}-${message.at}`
  return `idx-${index}`
}

export function AssistantFab({ view, open, onOpen }) {
  const { t } = useI18n()
  if (open || !FAB_VIEWS.includes(view)) return null
  return (
    <button
      type="button"
      onClick={onOpen}
      className="fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-[max(1rem,env(safe-area-inset-right))] z-20 inline-flex min-h-12 items-center gap-2 rounded-full bg-sage-700 px-4 py-3 text-sm font-semibold text-sage-50 shadow-lg hover:bg-sage-800"
      aria-label={t('ai.openFab')}
    >
      <Sparkles size={18} />
      <span className="hidden sm:inline">{t('ai.title')}</span>
    </button>
  )
}

function OpenAiBanner({ openaiOk, openaiError }) {
  const { t } = useI18n()
  const tone = openaiOk
    ? 'border-sage-300 bg-sage-100/80 text-sage-800'
    : 'border-warn/40 bg-warn/10 text-sage-800'
  return (
    <div className={`overflow-hidden rounded-xl border px-3 py-2 text-xs leading-snug ${tone}`} style={{ height: '3.5rem' }}>
      <p className="line-clamp-1 font-semibold" title={openaiOk ? t('ai.bannerOk') : openAiUnavailable(openaiError || t('errors.openaiMissing'))}>
        {openaiOk ? t('ai.bannerOk') : openAiUnavailable(openaiError || t('errors.openaiMissing'))}
      </p>
      <p className={`line-clamp-1 ${openaiOk ? 'text-transparent' : 'text-sage-600'}`} aria-hidden={openaiOk || undefined} title={openaiOk ? undefined : t('ai.bannerHint')}>
        {openaiOk ? '\u00a0' : t('ai.bannerHint')}
      </p>
    </div>
  )
}

function Bubble({ msg, onCopy }) {
  const { t } = useI18n()
  const isAi = msg.role !== 'user'
  const shown = isAi ? displayAiContent(msg.content) : msg.content
  return (
    <div className={`flex ${isAi ? 'justify-start' : 'justify-end'}`}>
      <div
        className={`max-w-[92%] rounded-2xl border px-3 py-2 text-sm ${
          isAi
            ? 'border-sage-300 bg-sage-100 text-sage-900'
            : 'whitespace-pre-wrap border-sage-200 bg-white text-sage-800'
        }`}
      >
        <div className="mb-1 flex items-center justify-between gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-sage-500">
            {isAi ? t('ai.nazix') : t('ai.you')}
            {msg.origin === 'web' ? ' · web' : ''}
          </span>
          {isAi && (
            <button
              type="button"
              className="rounded p-1 text-sage-500 hover:bg-sage-200 hover:text-sage-800"
              onClick={() => onCopy(shown)}
              aria-label={t('ai.copy')}
            >
              <Copy size={12} />
            </button>
          )}
        </div>
        {isAi ? <ResearchAnswer text={shown} /> : shown}
        {msg.streaming && <span className="ml-0.5 inline-block animate-pulse text-sage-500">▍</span>}
        {msg.fallback && (
          <p className="mt-2 text-[11px] font-medium text-warn">{t('ai.fallback')}</p>
        )}
      </div>
    </div>
  )
}

function ActionButtons({ actions, canWrite, onPick }) {
  const { t } = useI18n()
  if (!actions?.length) return null
  return (
    <div className="flex flex-wrap gap-1.5">
      {actions.map((a) => (
        <button
          key={a.kind}
          type="button"
          className={btnGhost + ' !min-h-9 !px-2.5 !py-1.5 !text-xs'}
          disabled={!canWrite && a.kind !== 'draft_message'}
          title={!canWrite && a.kind !== 'draft_message' ? t('ai.readOnlyActions') : ''}
          onClick={() => onPick(a)}
        >
          {t(`ai.action.${a.kind}`) === `ai.action.${a.kind}` ? a.label : t(`ai.action.${a.kind}`)}
        </button>
      ))}
    </div>
  )
}

function ConfirmAction({ action, users, projects, budgets, notes, user, onClose, onApply, busy }) {
  const { t } = useI18n()
  const [draft, setDraft] = useState(() => ({ ...(action?.draft || {}) }))
  if (!action) return null
  const canWrite = canWriteRole(user)
  const writeBlocked = !canWrite && action.kind !== 'draft_message'
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-ink/45 p-0 sm:items-center sm:p-4">
      <button type="button" className="absolute inset-0" aria-label={t('common.close')} onClick={onClose} />
      <div className="relative z-10 flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl bg-sage-50 shadow-2xl sm:rounded-2xl">
        <div className="sticky top-0 z-20 shrink-0 border-b border-sage-200 bg-sage-50 px-4 py-3">
          <h3 className="font-display text-lg text-sage-900">
            {t('common.confirm')} — {action.label}
          </h3>
          <p className="mt-1 text-xs text-sage-600">{t('ai.noMemory')}</p>
          {writeBlocked && <p className="mt-2 rounded-lg bg-warn/10 px-2 py-1 text-xs text-warn">{t('ai.readerBlocked')}</p>}
        </div>
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-3 xx-scroll">
          {(action.kind === 'create_note' ||
            action.kind === 'create_subnote' ||
            action.kind === 'create_idea' ||
            action.kind === 'create_risk') && (
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-sage-800">{t('notes.title')}</span>
              <input className={inputClass} value={draft.title || ''} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
            </label>
          )}
          {action.kind === 'create_subnote' && (
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-sage-800">{t('ai.parentNote')}</span>
              <select
                className={inputClass}
                value={draft.parentId || ''}
                onChange={(e) => setDraft({ ...draft, parentId: e.target.value })}
              >
                <option value="">{t('ai.choose')}</option>
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
              <span className="mb-1 block font-medium text-sage-800">{t('ai.content')}</span>
              <textarea
                className={inputClass + ' min-h-24'}
                value={draft.content || ''}
                onChange={(e) => setDraft({ ...draft, content: e.target.value })}
              />
            </label>
          )}
          {action.kind === 'create_idea' && (
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-sage-800">{t('ai.description')}</span>
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
                <span className="mb-1 block font-medium text-sage-800">{t('common.project')}</span>
                <select
                  className={inputClass}
                  value={draft.projectId || ''}
                  onChange={(e) => setDraft({ ...draft, projectId: e.target.value })}
                >
                  <option value="">{t('ai.choose')}</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-sage-800">{t('ai.description')}</span>
                <textarea
                  className={inputClass + ' min-h-16'}
                  value={draft.description || ''}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                />
              </label>
            </>
          )}
          {(action.kind === 'create_task' || action.kind === 'update_task' || action.kind === 'create_event' || action.kind === 'update_event' || action.kind === 'create_project' || action.kind === 'update_project' || action.kind === 'update_note') && (
            <>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-sage-800">{t('notes.title')}</span>
                <input className={inputClass} value={draft.title || ''} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-sage-800">{t('ai.description')}</span>
                <textarea className={inputClass + ' min-h-20'} value={draft.description || draft.content || ''} onChange={(e) => setDraft({ ...draft, description: e.target.value, content: e.target.value })} />
              </label>
              {(action.kind === 'create_event' || action.kind === 'update_event') && (
                <div className="grid grid-cols-2 gap-2">
                  <input type="date" className={inputClass} value={draft.date || ''} onChange={(e) => setDraft({ ...draft, date: e.target.value })} />
                  <input type="time" className={inputClass} value={draft.time || ''} onChange={(e) => setDraft({ ...draft, time: e.target.value })} />
                </div>
              )}
            </>
          )}
          {(action.kind === 'create_budget_line' || action.kind === 'update_budget_line') && (
            <>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-sage-800">{t('searchUi.budget')}</span>
                <select
                  className={inputClass}
                  value={draft.budgetId || ''}
                  onChange={(e) => setDraft({ ...draft, budgetId: e.target.value })}
                >
                  <option value="">{t('ai.choose')}</option>
                  {budgets.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-sage-800">{t('ai.label')}</span>
                <input className={inputClass} value={draft.name || ''} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-sage-800">{t('ai.amount')}</span>
                <input
                  type="number"
                  min="0"
                  className={inputClass}
                  value={draft.amount || ''}
                  onChange={(e) => setDraft({ ...draft, amount: e.target.value })}
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-sage-800">{t('ai.flow')}</span>
                <select className={inputClass} value={draft.flow || 'expense'} onChange={(e) => setDraft({ ...draft, flow: e.target.value })}>
                  <option value="expense">{t('ai.expense')}</option>
                  <option value="income">{t('ai.income')}</option>
                </select>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-sage-800">{t('ai.category')}</span>
                <input className={inputClass} value={draft.category || 'Autres'} onChange={(e) => setDraft({ ...draft, category: e.target.value })} />
              </label>
            </>
          )}
          {action.kind === 'draft_message' && (
            <>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-sage-800">{t('ai.recipient')}</span>
                <select
                  className={inputClass}
                  value={draft.userId || ''}
                  onChange={(e) => setDraft({ ...draft, userId: e.target.value })}
                >
                  <option value="">{t('ai.chooseMember')}</option>
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
                <span className="mb-1 block font-medium text-sage-800">{t('ai.draft')}</span>
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
                {t('ai.postGeneral')}
              </label>
            </>
          )}
        </div>
        <div className="sticky bottom-0 z-20 flex shrink-0 flex-col-reverse gap-2 border-t border-sage-200 bg-sage-50 px-4 py-3 sm:flex-row sm:justify-end pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button type="button" className={btnGhost} onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button
            type="button"
            className={btnPrimary}
            disabled={busy || writeBlocked}
            onClick={() => onApply({ ...action, draft })}
          >
            <Check size={16} /> {t('common.confirm')}
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
  pendingPrompt = '',
  onPendingConsumed,
}) {
  const { t, lang } = useI18n()
  const [threadId, setThreadId] = useState(null)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [hasKey, setHasKey] = useState(false)
  const [openaiOk, setOpenaiOk] = useState(false)
  const [openaiError, setOpenaiError] = useState('')
  const [statusReady, setStatusReady] = useState(false)
  const [pendingUser, setPendingUser] = useState(null)
  const [streamText, setStreamText] = useState('')
  const [pendingAction, setPendingAction] = useState(null)
  const [actionBusy, setActionBusy] = useState(false)
  const [searching, setSearching] = useState(false)
  const abortRef = useRef(null)
  const streamRef = useRef('')
  const researchModeRef = useRef('quick')

  const thread = threads.find((t) => t.id === threadId) || null
  const messages = thread?.messages || []

  useEffect(() => {
    fetchAiStatus()
      .then((s) => {
        setHasKey(Boolean(s.hasKey))
        setOpenaiOk(Boolean(s.ok))
        setOpenaiError(s.ok ? '' : s.error || 'OPENAI_API_KEY manquante')
      })
      .catch(() => {
        setHasKey(false)
        setOpenaiOk(false)
        setOpenaiError('serveur IA injoignable')
      })
      .finally(() => setStatusReady(true))
  }, [])

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
    abortRef.current?.abort()
  }

  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text)
      flash?.(t('ai.copied'))
    } catch {
      flash?.(t('ai.copyFail'), 'err')
    }
  }

  const stop = () => {
    abortRef.current?.abort()
  }

  const runTurn = async (userText, style = '') => {
    const text = String(userText || '').trim()
    if (!text || busy) return
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setBusy(true)
    setError('')
    streamRef.current = ''
    setStreamText('')
    const userMsg = { id: messageId(), role: 'user', content: text, at: nowIso() }
    setPendingUser(userMsg)
    let id = threadId
    let history = messages
    let usedExternal = false
    let fallback = false
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
      setPendingUser(null)

      const priorUsers = history.filter((m) => m.role === 'user').map((m) => m.content)
      const effective = effectiveUserQuestion(text, priorUsers.slice(0, -1))
      const mode = style === 'detailed' ? 'deep' : style === 'short' ? 'quick' : researchModeRef.current
      if (style === 'detailed' || style === 'short') researchModeRef.current = mode
      const greeting = isGreeting(effective)
      const wantWeb = !greeting && (wantsWebSearch(text, webSearch) || wantsWebSearch(effective, webSearch))
      let webPayload = null
      let webSources = []
      let webSearchedAt = ''
      let searchFailed = false
      if (wantWeb) {
        setSearching(true)
        try {
          const web = await searchWeb(webQueryFrom(isModeSwitch(text) ? effective : text, history))
          webPayload = web
          webSources = web.results || []
          webSearchedAt = web.searchedAt || nowIso()
        } catch (err) {
          searchFailed = true
          webPayload = null
          webSources = []
          webSearchedAt = ''
          setError(formatSearchError(err, lang))
        } finally {
          setSearching(false)
        }
      }

      const takeServerWeb = (ext) => {
        const results = ext?.web?.results
        if (!Array.isArray(results)) return
        webPayload = ext.web
        webSources = results
        webSearchedAt = ext.web.searchedAt || webSearchedAt || nowIso()
        if (results.length) {
          searchFailed = false
          setError('')
        }
      }

      let answerText = ''
      let apiActions = []

      const onDelta = (_delta, full) => {
        streamRef.current = full
        setStreamText(visibleStreamContent(full))
      }

      const skipOpenAi = statusReady && !hasKey && !openaiOk
      const canCallOpenAi = !skipOpenAi
      if (canCallOpenAi) {
        try {
          const ext = await askExternalStream({
            messages: history.filter((m) => m.role === 'user' || m.role === 'assistant'),
            context,
            web: webPayload,
            webSearch: wantWeb,
            signal: ctrl.signal,
            onDelta,
            language: lang,
            researchMode: mode,
          })
          takeServerWeb(ext)
          if (ext.ok && (ext.content || ext.text)) {
            answerText = ext.content || ext.text
            usedExternal = true
            apiActions = Array.isArray(ext.actions) ? ext.actions : []
          }
        } catch (err) {
          if (ctrl.signal.aborted && streamRef.current) {
            answerText = streamRef.current
            usedExternal = true
          } else if (ctrl.signal.aborted) {
            setError('Génération interrompue.')
            setBusy(false)
            setStreamText('')
            abortRef.current = null
            return
          } else if (err?.searchError && !webSources.length) {
            searchFailed = true
            const msg = formatSearchError(err, lang)
            setError(msg)
            answerText = msg
            usedExternal = true
          } else {
            try {
              const ext = await askExternal({
                messages: history.filter((m) => m.role === 'user' || m.role === 'assistant'),
                context,
                web: webPayload,
                webSearch: wantWeb,
                signal: ctrl.signal,
                language: lang,
                researchMode: mode,
              })
              takeServerWeb(ext)
              if (ext.ok && (ext.content || ext.text)) {
                answerText = ext.content || ext.text
                usedExternal = true
                apiActions = Array.isArray(ext.actions) ? ext.actions : []
                streamRef.current = answerText
                setStreamText(visibleStreamContent(answerText))
              }
            } catch (err2) {
              if (err2?.searchError && !webSources.length) {
                searchFailed = true
                const msg = formatSearchError(err2, lang)
                setError(msg)
                answerText = msg
                usedExternal = true
              } else {
                const reason = err2?.message || err?.message || 'erreur inconnue'
                const msg = openAiUnavailable(reason)
                setError(msg)
                flash?.(msg, 'warn')
              }
            }
          }
        }
      } else if (!searchFailed) {
        setError(openAiUnavailable(openaiError || 'OPENAI_API_KEY manquante'))
      }

      let workspaceSources = []
      if (!answerText && !searchFailed) {
        const preferLocal = !webSources.length || isWorkspaceQuestion(effective)
        if (preferLocal) {
          const local = localAnswer(
            effective,
            context,
            style === 'list' ? 'list' : mode === 'deep' ? 'detailed' : '',
            lang,
          )
          answerText = local.text
          workspaceSources = local.sources || []
          fallback = true
        }
      }

      const split = splitDisplayAndActions(answerText)
      answerText = shapeResearchText(split.content, {
        lang,
        mode,
        query: effective,
        webSources,
        workspaceSources,
        webAttempted: wantWeb && !searchFailed,
      })
      const actions = mergeAiActions(
        apiActions,
        split.actions,
        parseActions(text, context),
        parseActionsFromAssistant(answerText, context),
      )

      const aiMsg = {
        id: messageId(),
        role: 'assistant',
        content: answerText,
        sources: workspaceSources,
        webSources,
        webSearchedAt,
        actions,
        origin: usedExternal ? 'external' : 'local',
        fallback,
        at: nowIso(),
      }
      await persist(id, { messages: [...history, aiMsg], contextLabel: context.contextLabel, section })
    } catch (err) {
      const msg = openAiUnavailable(toUserMessage(err, 'erreur inconnue'))
      setError(msg)
      flash?.(msg, 'err')
    } finally {
      setBusy(false)
      setSearching(false)
      setStreamText('')
      setPendingUser(null)
      abortRef.current = null
    }
  }

  const consumedPrompt = useRef('')
  useEffect(() => {
    const text = String(pendingPrompt || '').trim()
    if (!text || consumedPrompt.current === text || busy) return
    consumedPrompt.current = text
    onPendingConsumed?.()
    runTurn(text)
    // Voice already confirmed send-to-AI; do not auto-create notes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingPrompt])

  const send = async (e) => {
    e?.preventDefault?.()
    const text = draft.trim()
    if (!text || busy) return
    setDraft('')
    await runTurn(text)
  }

  const onComposerKey = (e) => {
    if (e.key !== 'Enter' || e.shiftKey) return
    if (e.nativeEvent?.isComposing || e.keyCode === 229) return
    e.preventDefault()
    send(e)
  }

  const followUp = (style, label) => runTurn(label, style)

  const applyAction = async (action) => {
    // Never run from JSON in the bubble — only the confirm dialog calls this.
    if (action.kind !== 'draft_message' && !canWriteRole(user)) {
      flash?.(t('ai.readerDenied'), 'err')
      return
    }
    setActionBusy(true)
    try {
      const d = action.draft || {}
      if (action.kind === 'create_note' || action.kind === 'create_subnote') {
        if (action.kind === 'create_subnote' && !d.parentId) throw new Error(t('ai.pickParent'))
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
        flash?.(t('ai.noteCreated'))
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
        flash?.(t('ai.ideaCreated'))
      } else if (action.kind === 'create_risk') {
        if (!d.projectId) throw new Error(t('ai.pickProject'))
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
        flash?.(t('ai.riskCreated'))
      } else if (action.kind === 'update_note') {
        if (!d.id) throw new Error(t('ai.pickParent'))
        await saveNote({ id: d.id, title: String(d.title || '').trim() || 'Note', content: d.content || d.description || '' }, user)
        flash?.(t('ai.noteUpdated'))
      } else if (action.kind === 'create_task' || action.kind === 'update_task') {
        const snap = getStoreSnapshot()
        const lists = Object.values(snap.xx_todo_lists || {}).filter((list) => list.orgId === snap.activeOrgId)
        const list = lists[0] || (await saveTodoList({ name: 'Tâches', visibility: 'Équipe' }, user))
        await saveTodo(
          {
            id: action.kind === 'update_task' ? d.id : undefined,
            listId: d.listId || list.id,
            title: String(d.title || '').trim() || 'Tâche',
            description: d.description || '',
            status: d.status || 'todo',
            priority: d.priority || 'medium',
          },
          user,
        )
        flash?.(action.kind === 'update_task' ? t('ai.taskUpdated') : t('ai.taskCreated'))
      } else if (action.kind === 'create_event' || action.kind === 'update_event') {
        await saveEvent(
          {
            id: action.kind === 'update_event' ? d.id : undefined,
            title: String(d.title || '').trim() || 'Rendez-vous',
            description: d.description || '',
            date: d.date || new Date().toISOString().slice(0, 10),
            time: d.time || '09:00',
            visibility: 'Partagée',
            shares: [],
          },
          user,
        )
        flash?.(action.kind === 'update_event' ? t('ai.eventUpdated') : t('ai.eventCreated'))
      } else if (action.kind === 'create_project' || action.kind === 'update_project') {
        await saveProject(
          {
            id: action.kind === 'update_project' ? d.id : undefined,
            title: String(d.title || '').trim() || 'Projet',
            description: d.description || '',
            status: d.status || 'À préparer',
            visibility: 'Partagée',
            shares: [],
          },
          user,
        )
        flash?.(action.kind === 'update_project' ? t('ai.projectUpdated') : t('ai.projectCreated'))
      } else if (action.kind === 'create_budget_line' || action.kind === 'update_budget_line') {
        const budgetId = d.budgetId || budgets[0]?.id
        if (!budgetId) throw new Error(t('ai.pickActiveBudget'))
        const category = ['Salaires et rémunérations', 'Matériel et équipements', 'Fournitures et produits', 'Transport et déplacements', 'Marketing et communication', 'Frais administratifs', 'Prestataires et services', 'Autres'].includes(d.category)
          ? d.category
          : 'Autres'
        await saveBudgetLine(
          {
            id: action.kind === 'update_budget_line' ? d.id : undefined,
            budgetId,
            kind: d.kind || 'planned',
            category,
            name: String(d.name || d.label || '').trim() || 'Ligne IA',
            amount: Number(d.amount || 0),
            flow: d.flow === 'income' ? 'income' : 'expense',
          },
          user,
        )
        flash?.(action.kind === 'update_budget_line' ? t('ai.lineUpdated') : t('ai.lineCreated'))
      } else if (action.kind === 'draft_message') {
        if (!d.userId) throw new Error(t('ai.pickRecipient'))
        const body = String(d.body || '').trim()
        if (!body) throw new Error(t('ai.emptyMessage'))
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
        flash?.(d.postGeneral ? t('ai.notifyPosted') : t('ai.notifySent'))
      }
      setPendingAction(null)
    } catch (err) {
      flash?.(toUserMessage(err, t('ai.actionFail')), 'err')
    } finally {
      setActionBusy(false)
    }
  }

  const remove = async (id) => {
    await deleteAiThread(id, user)
    if (threadId === id) setThreadId(null)
    flash?.(t('ai.deleted'))
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
    openaiOk,
    openaiError,
    pendingUser,
    streamText,
    searching,
    stop,
    onComposerKey,
    pendingAction,
    setPendingAction,
    actionBusy,
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
  onDictate,
}) {
  const { t } = useI18n()
  const canWrite = canWriteRole(user)
  const scrollerRef = useRef(null)
  const lastAi = [...chat.messages].reverse().find((m) => m.role === 'assistant')
  const pendingAlreadySaved = chat.pendingUser && chat.messages.some((m) => m.id ? m.id === chat.pendingUser.id : m.at === chat.pendingUser.at)
  const visible = pendingAlreadySaved || !chat.pendingUser ? chat.messages : [...chat.messages, chat.pendingUser]
  const last = visible[visible.length - 1]
  const revision = [
    visible.length,
    last ? messageKey(last, visible.length - 1) : '',
    last?.content?.length || 0,
    chat.streamText.length,
    chat.busy ? 1 : 0,
  ].join(':')
  const onScroll = useStickToBottom(scrollerRef, { threadKey: chat.threadId || 'new', revision })
  const showTyping = chat.busy && !chat.searching && chat.messages[chat.messages.length - 1]?.role !== 'assistant'
  const quickClass = btnGhost + ' !h-8 !min-h-0 shrink-0 !px-2 !py-0 !text-xs'
  return (
    <div className="flex min-h-0 w-full flex-1 basis-0 flex-col overflow-hidden [overflow-anchor:none]">
      <div className="shrink-0 space-y-1 px-3 pt-3">
        <OpenAiBanner openaiOk={chat.openaiOk} openaiError={chat.openaiError} />
        <p className="h-4 truncate text-[11px] font-medium leading-4 text-sage-600">{context.contextLabel || ' '}</p>
      </div>
      <div
        ref={scrollerRef}
        onScroll={onScroll}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3 xx-scroll [overflow-anchor:none]"
      >
        <div className="space-y-3">
          {visible.length === 0 && (
            <p className="text-sm text-sage-600">{t('ai.emptyHint')}</p>
          )}
          {visible.map((m, i) => (
            <div key={messageKey(m, i)} className="space-y-1.5 [overflow-anchor:none]">
              <Bubble msg={m} onCopy={chat.copy} />
              {m.role === 'assistant' && (
                <ActionButtons
                  actions={
                    m.actions?.length
                      ? m.actions
                      : parseActionsFromAssistant(m.content, context)
                  }
                  canWrite={canWrite}
                  onPick={chat.setPendingAction}
                />
              )}
            </div>
          ))}
          <div className="[overflow-anchor:none]" style={{ minHeight: '4.5rem' }} aria-live="polite">
            {showTyping ? (
              <Bubble
                msg={{
                  id: 'typing',
                  role: 'assistant',
                  content: chat.streamText || (chat.openaiOk ? t('ai.thinking') : t('ai.localThinking')),
                  streaming: true,
                }}
                onCopy={chat.copy}
              />
            ) : null}
          </div>
          {chat.error ? (
            <div className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
              {chat.error}
              <button type="button" className="ml-2 underline" onClick={() => chat.setError('')}>
                {t('common.close')}
              </button>
            </div>
          ) : null}
        </div>
      </div>
      <div className="flex h-10 shrink-0 items-center gap-1 overflow-x-auto overflow-y-hidden px-3 [overflow-anchor:none]">
        <button type="button" className={quickClass + (lastAi ? '' : ' invisible')} disabled={!lastAi || chat.busy} onClick={() => chat.followUp('short', t('ai.shorter'))}>
          <AlignLeft size={12} /> {t('ai.shorter')}
        </button>
        <button type="button" className={quickClass + (lastAi ? '' : ' invisible')} disabled={!lastAi || chat.busy} onClick={() => chat.followUp('detailed', t('ai.detailed'))}>
          <Rows3 size={12} /> {t('ai.detailed')}
        </button>
        <button type="button" className={quickClass + (lastAi ? '' : ' invisible')} disabled={!lastAi || chat.busy} onClick={() => chat.followUp('list', t('ai.list'))}>
          <List size={12} /> {t('ai.list')}
        </button>
      </div>
      <div className="flex h-5 shrink-0 items-center px-3 text-[11px] text-sage-600" aria-live="polite">
        {chat.searching ? t('searchUi.searching') : '\u00a0'}
      </div>
      <form
        onSubmit={chat.send}
        className="shrink-0 border-t border-sage-200 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      >
        <div className="mb-2 flex h-6 items-center overflow-hidden text-[11px] text-sage-700">
          <label className="flex items-center gap-1.5 whitespace-nowrap">
            <input
              type="checkbox"
              className="h-3.5 w-3.5 shrink-0 accent-sage-700"
              checked={chat.webSearch}
              onChange={(e) => chat.persistWeb(e.target.checked)}
            />
            <Globe size={12} />
            {t('ai.webSearch')}
          </label>
        </div>
        <div className="flex items-center gap-2">
          {onDictate && (
            <button
              type="button"
              className={btnGhost + ' shrink-0 !p-0'}
              style={{ width: '2.75rem', height: '2.75rem', minWidth: '2.75rem', minHeight: '2.75rem' }}
              onClick={onDictate}
              aria-label={t('voice.dictate')}
            >
              <Mic size={16} />
            </button>
          )}
          <textarea
            className={inputClass + ' min-w-0 flex-1 resize-none overflow-y-auto'}
            style={{ height: '2.75rem', minHeight: '2.75rem', maxHeight: '2.75rem' }}
            rows={1}
            placeholder={compact ? t('ai.placeholderShort') : t('ai.placeholder')}
            value={chat.draft}
            onChange={(e) => chat.setDraft(e.target.value)}
            onKeyDown={chat.onComposerKey}
          />
          <button
            type={chat.busy ? 'button' : 'submit'}
            className={btnPrimary + ' shrink-0 !p-0'}
            style={{ width: '2.75rem', height: '2.75rem', minWidth: '2.75rem', minHeight: '2.75rem' }}
            disabled={!chat.busy && !chat.draft.trim()}
            aria-label={chat.busy ? t('ai.stop') : t('ai.send')}
            onClick={chat.busy ? chat.stop : undefined}
          >
            {chat.busy ? <Square size={14} /> : <Send size={16} />}
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
  pendingPrompt,
  onPendingConsumed,
  onDictate,
}) {
  const { t } = useI18n()
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
    pendingPrompt,
    onPendingConsumed,
  })

  if (!open) return null
  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => onCollapse(false)}
        className="fixed top-1/2 right-0 z-20 flex h-24 w-10 -translate-y-1/2 items-center justify-center rounded-l-xl bg-sage-700 text-sage-50 shadow"
        aria-label={t('ai.expand')}
      >
        <Sparkles size={16} />
      </button>
    )
  }

  return (
    <aside className="fixed inset-0 z-30 flex h-dvh max-h-dvh flex-col overflow-hidden bg-cream-green shadow-xl lg:inset-y-0 lg:left-auto lg:right-0 lg:h-dvh lg:w-[360px] lg:border-l lg:border-sage-200">
      <header className="flex shrink-0 items-center gap-2 border-b border-sage-200 px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <Sparkles size={16} className="text-sage-700" />
        <h2 className="min-w-0 flex-1 truncate font-display text-base text-sage-900">{t('ai.title')}</h2>
        <button type="button" className="rounded-lg p-2 text-sage-600 hover:bg-sage-200" onClick={() => chat.startNew()} aria-label={t('ai.newThread')}>
          <Plus size={16} />
        </button>
        <button type="button" className="hidden rounded-lg p-2 text-sage-600 hover:bg-sage-200 lg:inline-flex" onClick={() => onCollapse(true)} aria-label={t('ai.collapse')}>
          <Minus size={16} />
        </button>
        <button type="button" className="rounded-lg p-2 text-sage-600 hover:bg-sage-200" onClick={onClose} aria-label={t('ai.close')}>
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
        onDictate={onDictate}
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
  pendingPrompt,
  onPendingConsumed,
  onDictate,
}) {
  const { t } = useI18n()
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
    pendingPrompt,
    onPendingConsumed,
  })
  const [mobileThread, setMobileThread] = useState(false)

  const frame = 'h-[min(32rem,calc(100dvh-14rem))] max-h-[min(32rem,calc(100dvh-14rem))]'
  return (
    <div className="flex items-start gap-3 [overflow-anchor:none] lg:flex-row">
      <aside className={`${mobileThread ? 'hidden lg:flex' : 'flex'} ${frame} w-full shrink-0 flex-col overflow-hidden rounded-2xl border border-sage-200 bg-white/80 lg:w-72`}>
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-sage-200 px-3 py-2">
          <p className="font-display text-sage-900">{t('ai.conversations')}</p>
          <button
            type="button"
            className={btnGhost + ' !min-h-9 !px-2'}
            onClick={async () => {
              await chat.startNew()
              setMobileThread(true)
            }}
          >
            <Plus size={14} /> {t('ai.new')}
          </button>
        </div>
        <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain xx-scroll p-2 [overflow-anchor:none]">
          {threads.length === 0 && <li className="px-2 py-6 text-center text-sm text-sage-500">{t('ai.none')}</li>}
          {threads.map((thread) => (
            <li key={thread.id} className="[overflow-anchor:none]">
              <div
                className={`mb-1 flex min-h-[3.25rem] items-center gap-1 rounded-xl px-2 py-2 ${
                  chat.threadId === thread.id ? 'bg-sage-200' : 'hover:bg-sage-100'
                }`}
              >
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() => {
                    chat.setThreadId(thread.id)
                    setMobileThread(true)
                  }}
                >
                  <p className="truncate text-sm font-medium text-sage-900">{thread.title}</p>
                  <p className="truncate text-[11px] text-sage-500">{thread.contextLabel || thread.section}</p>
                </button>
                <button
                  type="button"
                  className="shrink-0 rounded p-1.5 text-sage-500 hover:bg-white hover:text-danger"
                  onClick={() => chat.remove(thread.id)}
                  aria-label={t('ai.deleteThread')}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      </aside>
      <section className={`${mobileThread ? 'flex' : 'hidden lg:flex'} ${frame} min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-sage-200 bg-white/70`}>
        <div className="flex h-12 shrink-0 items-center gap-2 border-b border-sage-200 px-3 lg:hidden">
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
          onDictate={onDictate}
        />
      </section>
    </div>
  )
}

export function AiSettingsBlock({ user: _user, allowExternal: _allowExternal, onChange: _onChange }) {
  const { t } = useI18n()
  return (
    <section className="rounded-2xl border border-sage-200 bg-white/80 p-5">
      <h2 className="flex items-center gap-2 font-display text-lg text-sage-900">
        <Sparkles size={18} /> {t('ai.title')}
      </h2>
      <p className="mt-2 text-sm text-sage-800">{t('ai.bannerOk')}</p>
      <p className="mt-2 text-sm text-sage-600">{t('ai.settingsHint')}</p>
      <p className="mt-2 flex items-center gap-1 text-xs text-sage-500">
        <Shield size={12} /> {t('ai.noMemory')}
      </p>
    </section>
  )
}

