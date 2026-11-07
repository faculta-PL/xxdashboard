import { useEffect, useRef, useState } from 'react'
import { Mic, MicOff } from 'lucide-react'
import { useI18n } from './i18n'
import { createRecognizer, speechSupported, VOICE_DESTS } from './lib/voice'
import { canWriteRole } from './lib/rbac'

const inputClass =
  'w-full min-h-11 rounded-xl border border-sage-300 bg-white px-3 py-2.5 text-sage-900 outline-none ring-sage-400 placeholder:text-sage-400 focus:ring-2'
const btnPrimary =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-sage-700 px-4 py-2.5 text-sm font-semibold text-sage-50 transition hover:bg-sage-800 disabled:opacity-50'
const btnGhost =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-sage-300 bg-white/70 px-3 py-2 text-sm font-medium text-sage-800 transition hover:bg-sage-100'

export default function VoiceModal({
  open,
  onClose,
  user,
  users = [],
  budgets = [],
  busy = false,
  onConfirm,
}) {
  const { t, lang } = useI18n()
  const supported = speechSupported()
  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [interim, setInterim] = useState('')
  const [dest, setDest] = useState('note')
  const [budgetId, setBudgetId] = useState(budgets[0]?.id || '')
  const [shareIds, setShareIds] = useState([])
  const [error, setError] = useState('')
  const recRef = useRef(null)
  const finalRef = useRef('')

  const stopRec = () => {
    try {
      recRef.current?.stop()
    } catch {
      /* ignore */
    }
    recRef.current = null
    setListening(false)
  }

  const startRec = () => {
    if (!supported) return
    stopRec()
    const rec = createRecognizer({
      lang,
      onResult: ({ final, interim: live, combined }) => {
        if (final) {
          finalRef.current = final
          setTranscript(final)
        }
        setInterim(live)
        if (!final && combined) setTranscript((prev) => prev || combined)
      },
      onError: (evt) => {
        if (evt?.error === 'not-allowed' || evt?.error === 'service-not-allowed') {
          setError(t('voice.unsupported'))
        }
        setListening(false)
      },
      onEnd: () => setListening(false),
    })
    if (!rec) {
      setError(t('voice.unsupported'))
      return
    }
    recRef.current = rec
    try {
      rec.start()
      setListening(true)
      setError('')
    } catch {
      setError(t('voice.unsupported'))
    }
  }

  useEffect(() => {
    if (!open) {
      stopRec()
      return undefined
    }
    setTranscript('')
    setInterim('')
    setDest('note')
    setShareIds([])
    setError('')
    finalRef.current = ''
    setBudgetId(budgets[0]?.id || '')
    if (supported) {
      const id = window.setTimeout(startRec, 0)
      return () => {
        window.clearTimeout(id)
        stopRec()
      }
    }
    return () => stopRec()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when the modal opens
  }, [open, lang])

  if (!open) return null
  const canWrite = canWriteRole(user)
  const others = users.filter((u) => u.id !== user?.id)

  const submit = async () => {
    const text = String(transcript || '').trim()
    if (!text) {
      setError(t('voice.needTranscript'))
      return
    }
    if (!VOICE_DESTS.includes(dest)) {
      setError(t('voice.needDest'))
      return
    }
    if (dest !== 'ai' && !canWrite) {
      setError(t('common.permissionDenied'))
      return
    }
    if (dest === 'budget' && !budgetId) {
      setError(t('voice.noBudget'))
      return
    }
    stopRec()
    await onConfirm?.({
      dest,
      text,
      title: firstLine(text, dest === 'event' ? t('voice.destEvent') : t('voice.destNote')),
      budgetId,
      shareIds,
    })
  }

  const destChip = (id, label) => (
    <button
      key={id}
      type="button"
      className={`min-h-10 rounded-full px-3 text-sm font-medium ${
        dest === id ? 'bg-sage-800 text-white' : 'bg-sage-100 text-sage-800 hover:bg-sage-200'
      }`}
      onClick={() => setDest(id)}
    >
      {label}
    </button>
  )

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-ink/45 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <button type="button" className="absolute inset-0 cursor-default" aria-label={t('common.close')} onClick={onClose} />
      <div
        className="relative z-10 flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-sage-50 shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 border-b border-sage-200 px-4 py-3">
          <h3 className="font-display text-xl text-sage-900">{t('voice.title')}</h3>
          <button type="button" className={btnGhost + ' !min-h-10 !px-2'} onClick={listening ? stopRec : startRec} disabled={!supported}>
            {listening ? <MicOff size={16} /> : <Mic size={16} />}
            {listening ? t('voice.listening') : t('voice.listen')}
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4 xx-scroll">
          {!supported && (
            <p className="rounded-xl border border-warn/40 bg-warn/10 px-3 py-2 text-sm text-sage-800">{t('voice.fallback')}</p>
          )}
          <label className="block text-sm font-medium text-sage-800">
            {t('voice.transcript')}
            <textarea
              className={inputClass + ' mt-1 min-h-28'}
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
            />
          </label>
          {interim ? <p className="text-xs italic text-sage-500">{interim}</p> : null}
          <div>
            <p className="mb-2 text-sm font-medium text-sage-800">{t('voice.destination')}</p>
            <div className="flex flex-wrap gap-1.5">
              {destChip('note', t('voice.destNote'))}
              {destChip('event', t('voice.destEvent'))}
              {destChip('budget', t('voice.destBudget'))}
              {destChip('idea', t('voice.destIdea'))}
              {destChip('ai', t('voice.destAi'))}
            </div>
          </div>
          {dest === 'budget' && (
            <label className="block text-sm font-medium text-sage-800">
              {t('voice.pickBudget')}
              <select className={inputClass + ' mt-1'} value={budgetId} onChange={(e) => setBudgetId(e.target.value)}>
                <option value="">{t('common.none')}</option>
                {budgets.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
              {budgets.length === 0 && <p className="mt-1 text-xs text-warn">{t('voice.noBudget')}</p>}
            </label>
          )}
          {dest !== 'ai' && (
            <div>
              <p className="mb-2 text-sm font-medium text-sage-800">{t('voice.shareOptional')}</p>
              <div className="flex max-h-28 flex-wrap gap-1 overflow-auto xx-scroll">
                {others.map((u) => {
                  const on = shareIds.includes(u.id)
                  return (
                    <button
                      key={u.id}
                      type="button"
                      className={`min-h-9 rounded-lg px-2 py-1 text-xs ${on ? 'bg-sage-700 text-white' : 'bg-sage-100 text-sage-700'}`}
                      onClick={() =>
                        setShareIds((prev) => (on ? prev.filter((id) => id !== u.id) : [...prev, u.id]))
                      }
                    >
                      {u.fullName || u.email}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
          {error ? (
            <p className="text-sm font-medium text-danger" role="alert">
              {error}
            </p>
          ) : null}
        </div>
        <div className="flex flex-col-reverse gap-2 border-t border-sage-200 px-4 py-3 sm:flex-row sm:justify-end">
          <button type="button" className={btnGhost} onClick={onClose} disabled={busy}>
            {t('common.cancel')}
          </button>
          <button type="button" className={btnPrimary} onClick={submit} disabled={busy || !transcript.trim()}>
            {t('voice.confirm')}
          </button>
        </div>
      </div>
    </div>
  )
}
