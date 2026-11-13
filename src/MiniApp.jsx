import { useEffect, useMemo, useState } from 'react'
import { Building2, CalendarDays, ListTodo, MessageCircle, Mic, Star, StickyNote } from 'lucide-react'
import { useI18n, dateLocale } from './i18n'
import { useAutosave } from './lib/formDraft'
import { canReadEntity, canWriteRole } from './lib/rbac'
import {
  ensureGeneralGroup,
  listGroupsForUser,
  listMembersOfOrg,
  listOrganizations,
  saveNote,
  selectOrganization,
  sendMessage,
} from './lib/store'
import { createRecognizer, speechSupported } from './lib/voice'
import { todayIso } from './lib/todos'

const btn =
  'inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-sage-700 px-4 text-base font-semibold text-white disabled:opacity-50'
const field =
  'w-full min-h-12 rounded-2xl border border-sage-300 bg-white px-3 py-3 text-base text-sage-900 outline-none focus:ring-2 focus:ring-sage-400'

function readDictationLang() {
  try {
    return localStorage.getItem('nazix_dictation_lang') === 'en-US' ? 'en-US' : 'fr-FR'
  } catch {
    return 'fr-FR'
  }
}

export default function MiniApp({
  user,
  orgId,
  notes,
  todos,
  events,
  messages,
  syncStatus,
  onOpenFull,
  onLogout,
}) {
  const { t, lang } = useI18n()
  const [quick, setQuick] = useState('')
  const [chat, setChat] = useState('')
  const [busy, setBusy] = useState(false)
  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState('')
  const [error, setError] = useState('')
  const orgs = listOrganizations().filter((org) => listMembersOfOrg(org.id).some((m) => m.userId === user.id))
  const org = orgs.find((item) => item.id === orgId)

  const auto = useAutosave({
    text: quick,
    enabled: Boolean(orgId) && canWriteRole(user),
    storageKey: `mini-note:${orgId || 'none'}`,
    onSave: async (text) => {
      const body = String(text || '').trim()
      if (body.length < 2 || !orgId) return
      await saveNote(
        { title: body.split('\n')[0].slice(0, 80) || t('mini.quick'), content: body, category: 'Général', visibility: 'Privée', shares: [] },
        user,
      )
    },
  })

  useEffect(() => {
    if (auto.recovered && !quick) setQuick(auto.recovered)
    // only when recovery arrives
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto.recovered])

  const today = todayIso()
  const todayTasks = useMemo(
    () => todos.filter((task) => task.dueDate === today && task.status !== 'done' && canReadEntity(user, task)),
    [todos, today, user],
  )
  const important = useMemo(
    () =>
      notes
        .filter((note) => note.important && canReadEntity(user, note))
        .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0)),
    [notes, user],
  )
  const upcoming = useMemo(
    () =>
      events
        .filter((event) => event.date && event.date >= today)
        .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))
        .slice(0, 5),
    [events, today],
  )
  const thread = useMemo(() => messages.slice(-30), [messages])

  const dictate = () => {
    if (!speechSupported()) {
      setError(t('voice.noSpeech'))
      return
    }
    const rec = createRecognizer({
      locale: readDictationLang(),
      onResult: ({ final, interim: live }) => {
        if (final) setQuick(final)
        setInterim(live)
      },
      onError: () => setListening(false),
      onEnd: () => setListening(false),
    })
    if (!rec) {
      setError(t('voice.noSpeech'))
      return
    }
    try {
      rec.start()
      setListening(true)
      setError('')
    } catch {
      setError(t('voice.noSpeech'))
    }
  }

  const send = async (e) => {
    e.preventDefault()
    const text = chat.trim()
    if (!text) return
    setBusy(true)
    try {
      const group = await ensureGeneralGroup(user)
      await sendMessage(group.id, text, user)
      setChat('')
    } catch (err) {
      setError(err.message || t('mini.noChat'))
    } finally {
      setBusy(false)
    }
  }

  if (!orgId) {
    return (
      <main className="mx-auto min-h-[100dvh] max-w-lg px-4 py-6">
        <h1 className="font-display text-3xl text-sage-900">{t('mini.title')}</h1>
        <p className="mt-2 text-sage-700">{t('mini.needOrg')}</p>
        <button type="button" className={btn + ' mt-4'} onClick={onOpenFull}>
          {t('mini.openFull')}
        </button>
      </main>
    )
  }

  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-lg flex-col gap-4 px-4 py-4 pb-8">
      <header className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-sage-500">{t('mini.kicker')}</p>
          <h1 className="font-display text-3xl text-sage-900">{t('mini.title')}</h1>
        </div>
        <span className="rounded-full bg-sage-200 px-2 py-1 text-xs font-semibold text-sage-800">{syncStatus}</span>
      </header>
      <label className="flex items-center gap-2 text-sm font-semibold text-sage-800">
        <Building2 size={18} />
        <select className={field} value={orgId} aria-label={t('orgs.switch')} onChange={(e) => selectOrganization(e.target.value, user)}>
          {orgs.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
      {error ? (
        <p className="rounded-xl bg-warn/15 px-3 py-2 text-sm text-sage-900" role="alert">
          {error}
        </p>
      ) : null}

      <section className="rounded-3xl border border-sage-200 bg-white p-4">
        <h2 className="flex items-center gap-2 font-display text-xl text-sage-900">
          <ListTodo size={18} /> {t('mini.today')}
        </h2>
        {todayTasks.length === 0 ? (
          <p className="mt-2 text-sm text-sage-500">{t('mini.noTasks')}</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {todayTasks.map((task) => (
              <li key={task.id} className="rounded-2xl bg-sage-50 px-3 py-3 text-base text-sage-900">
                {task.title}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-3xl border border-sage-200 bg-white p-4">
        <h2 className="flex items-center gap-2 font-display text-xl text-sage-900">
          <Star size={18} /> {t('nav.important')}
        </h2>
        {important.length === 0 ? (
          <p className="mt-2 text-sm text-sage-500">{t('mini.noNotes')}</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {important.slice(0, 6).map((note) => (
              <li key={note.id} className="rounded-2xl bg-sage-50 px-3 py-3">
                <p className="font-semibold text-sage-900">{note.title}</p>
                <p className="mt-1 line-clamp-3 text-sm text-sage-700">{note.content}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-3xl border border-sage-200 bg-white p-4">
        <h2 className="flex items-center gap-2 font-display text-xl text-sage-900">
          <StickyNote size={18} /> {t('mini.quick')}
        </h2>
        <textarea className={field + ' mt-2 min-h-28'} placeholder={t('mini.quickPh')} value={quick} onChange={(e) => setQuick(e.target.value)} />
        {interim ? <p className="mt-1 text-sm italic text-sage-500">{interim}</p> : null}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button type="button" className={btn} onClick={dictate}>
            <Mic size={18} /> {listening ? t('voice.listeningState') : t('voice.dictate')}
          </button>
          <span className="text-sm text-sage-600">
            {auto.status === 'saving' ? t('autosave.saving') : auto.status === 'saved' ? t('autosave.saved') : auto.status === 'unsaved' ? t('autosave.unsaved') : ''}
          </span>
        </div>
      </section>

      <section className="rounded-3xl border border-sage-200 bg-white p-4">
        <h2 className="flex items-center gap-2 font-display text-xl text-sage-900">
          <CalendarDays size={18} /> {t('mini.upcoming')}
        </h2>
        {upcoming.length === 0 ? (
          <p className="mt-2 text-sm text-sage-500">{t('mini.noEvents')}</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {upcoming.map((event) => (
              <li key={event.id} className="rounded-2xl bg-sage-50 px-3 py-3 text-base">
                <span className="font-semibold">{event.title}</span>
                <span className="mt-1 block text-sm text-sage-600">
                  {event.date} {event.time || ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-3xl border border-sage-200 bg-white p-4">
        <h2 className="flex items-center gap-2 font-display text-xl text-sage-900">
          <MessageCircle size={18} /> {t('mini.chat')}
        </h2>
        <p className="text-xs text-sage-500">{org?.name}</p>
        <div className="mt-2 h-48 space-y-2 overflow-y-auto rounded-2xl bg-sage-50 p-2">
          {thread.length === 0 ? (
            <p className="text-sm text-sage-500">{t('mini.noChat')}</p>
          ) : (
            thread.map((msg) => (
              <p key={msg.id} className="rounded-xl bg-white px-3 py-2 text-sm text-sage-900">
                <span className="font-semibold">{msg.authorName || '—'}: </span>
                {msg.body}
              </p>
            ))
          )}
        </div>
        <form onSubmit={send} className="mt-2 flex gap-2">
          <input className={field} value={chat} placeholder={t('mini.chatPh')} onChange={(e) => setChat(e.target.value)} />
          <button className={btn} disabled={busy || !chat.trim()}>
            {t('mini.send')}
          </button>
        </form>
      </section>

      <p className="text-center text-xs text-sage-500">{new Date().toLocaleString(dateLocale(lang))}</p>
      <div className="flex gap-2">
        <button type="button" className={btn + ' flex-1 bg-sage-800'} onClick={onOpenFull}>
          {t('mini.openFull')}
        </button>
        <button type="button" className="min-h-12 flex-1 rounded-2xl border border-sage-300 text-sm font-semibold" onClick={onLogout}>
          {t('nav.logout')}
        </button>
      </div>
    </main>
  )
}

export function isMiniRequest() {
  if (typeof window === 'undefined') return false
  const params = new URLSearchParams(window.location.search)
  return params.get('mini') === '1' || window.location.pathname === '/mini'
}
