import { createPortal } from 'react-dom'
import { Mail, X } from 'lucide-react'
import {
  VERIFY_EMAIL,
  RESET_EMAIL,
  firebaseUnavailableLine,
} from '../lib/emailCopy'

export function EmailNoticeModal({ notice, onClose }) {
  if (!notice || typeof document === 'undefined') return null
  const verify = notice.kind === 'verify'
  const copy = verify ? VERIFY_EMAIL : RESET_EMAIL
  const code = notice.code || ''
  const email = notice.email || ''

  return createPortal(
    <div className="fixed inset-0 z-[85] flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <button type="button" className="absolute inset-0" aria-label="Fermer" onClick={onClose} />
      <div className="relative z-10 flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-sage-50 shadow-2xl sm:rounded-2xl">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-sage-200 px-5 py-4">
          <div className="flex items-start gap-2">
            <Mail size={20} className="mt-0.5 text-sage-700" />
            <div>
              <h3 className="font-display text-xl text-sage-900">{copy.subject}</h3>
              <p className="text-xs text-sage-500">Expéditeur attendu : {copy.fromHint}</p>
            </div>
          </div>
          <button
            type="button"
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-sage-600 hover:bg-sage-200"
            onClick={onClose}
            aria-label="Fermer"
          >
            <X size={18} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 xx-scroll">
          <p className="text-sm font-medium text-sage-800">{copy.summary(email)}</p>
          {!notice.firebaseSent && (
            <p className="mt-2 rounded-xl border border-warn/30 bg-warn/10 px-3 py-2 text-sm text-sage-800" role="status">
              {firebaseUnavailableLine()}
            </p>
          )}
          {code ? (
            <p className="mt-3 rounded-xl border border-sage-200 bg-white px-3 py-3 text-center">
              <span className="block text-xs font-semibold uppercase tracking-wide text-sage-500">
                {verify ? 'Code à 6 chiffres' : 'Code local'}
              </span>
              <span className="mt-1 block font-display text-3xl tracking-[0.2em] text-sage-900">{code}</span>
            </p>
          ) : null}
          {!verify && (
            <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-sage-700">
              {RESET_EMAIL.steps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
          )}
          <pre className="mt-4 whitespace-pre-wrap rounded-xl bg-sage-100 px-3 py-3 text-xs leading-relaxed text-sage-800">
            {copy.body(email, code)}
          </pre>
        </div>
        <div className="flex shrink-0 justify-end border-t border-sage-200 px-5 py-3">
          <button
            type="button"
            className="inline-flex min-h-11 items-center rounded-xl bg-sage-700 px-4 text-sm font-semibold text-sage-50 hover:bg-sage-800"
            onClick={onClose}
          >
            J’ai compris
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
