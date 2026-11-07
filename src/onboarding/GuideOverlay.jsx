import { useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { getFirstLoginSteps, writeGuideDone } from './guideContent'
import { useI18n } from '../i18n'

export function GuideOverlay({ open, onClose, onGoView }) {
  const { t, lang } = useI18n()
  const steps = getFirstLoginSteps(lang)
  const [step, setStep] = useState(0)
  const [openedFor, setOpenedFor] = useState(open)
  if (open !== openedFor) {
    setOpenedFor(open)
    if (open) setStep(0)
  }

  if (!open || typeof document === 'undefined') return null

  const current = steps[step]
  const last = step === steps.length - 1

  const finish = (persist) => {
    if (persist) writeGuideDone()
    onClose?.()
  }

  const next = () => {
    if (last) {
      finish(true)
      return
    }
    const upcoming = steps[step + 1]
    if (upcoming?.target) onGoView?.(upcoming.target)
    setStep((s) => s + 1)
  }

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-ink/50 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="guide-overlay-title">
      <button type="button" className="absolute inset-0" aria-label={t('guidePage.skip')} onClick={() => finish(true)} />
      <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-t-2xl bg-sage-50 shadow-2xl animate-fade-up sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-sage-200 px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sage-500">
              {t('guidePage.step', { n: step + 1, total: steps.length })}
            </p>
            <h2 id="guide-overlay-title" className="mt-1 font-display text-2xl text-sage-900">
              {current.title}
            </h2>
          </div>
          <button
            type="button"
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-sage-600 hover:bg-sage-200"
            onClick={() => finish(true)}
            aria-label={t('common.close')}
          >
            <X size={18} />
          </button>
        </div>
        <div className="px-5 py-4">
          <p className="text-sm leading-relaxed text-sage-700">{current.body}</p>
          <div className="mt-4 flex gap-1.5" aria-hidden>
            {steps.map((s, i) => (
              <span
                key={s.id}
                className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-sage-700' : 'bg-sage-200'}`}
              />
            ))}
          </div>
        </div>
        <div className="flex flex-col-reverse gap-2 border-t border-sage-200 px-5 py-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            className="inline-flex min-h-11 items-center justify-center rounded-xl px-3 text-sm font-medium text-sage-700 hover:bg-sage-100"
            onClick={() => finish(true)}
          >
            {t('guidePage.skip')}
          </button>
          <button
            type="button"
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-sage-700 px-4 text-sm font-semibold text-sage-50 hover:bg-sage-800"
            onClick={next}
          >
            {last ? t('guidePage.finish') : t('guidePage.next')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
