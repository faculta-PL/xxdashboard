/** Petits composants réutilisables — palette sauge / crème. */

export const inputClass =
  'w-full min-h-11 rounded-xl border border-sage-300 bg-white px-3 py-2.5 text-sage-900 outline-none ring-sage-400 placeholder:text-sage-400 focus:ring-2'
export const btnPrimary =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-sage-700 px-4 py-2.5 text-sm font-semibold text-sage-50 transition hover:bg-sage-800 disabled:opacity-50'
export const btnGhost =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-sage-300 bg-white/70 px-3 py-2 text-sm font-medium text-sage-800 transition hover:bg-sage-100'

export function StatusBadge({ value, tone }) {
  const t =
    tone ||
    (value === 'Actif' || value === 'En cours' || value === 'en cours'
      ? 'bg-ok/15 text-ok'
      : value === 'Terminé' || value === 'terminée' || value === 'résolu'
        ? 'bg-sage-200 text-sage-800'
        : value === 'Archivé' || value === 'Abandonnée' || value === 'écarté'
          ? 'bg-sage-100 text-sage-500'
          : 'bg-sage-100 text-sage-800')
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${t}`}>
      {value || '—'}
    </span>
  )
}

export function PriorityBadge({ value }) {
  const tone =
    value === 'élevée'
      ? 'bg-danger/15 text-danger'
      : value === 'moyenne'
        ? 'bg-warn/15 text-warn'
        : 'bg-ok/15 text-ok'
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${tone}`}>
      {value || 'faible'}
    </span>
  )
}

export function MemberAvatar({ name, size = 28, title }) {
  const label = String(name || '?').trim() || '?'
  const parts = label.split(/\s+/).filter(Boolean)
  const initials = (parts.length >= 2 ? parts[0][0] + parts[1][0] : label.slice(0, 2)).toUpperCase()
  return (
    <span
      title={title || label}
      aria-label={label}
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-sage-700 font-semibold text-sage-50"
      style={{ width: size, height: size, fontSize: Math.max(10, size * 0.36) }}
    >
      {initials}
    </span>
  )
}

export function ProgressBar({ value = 0, label, className = '' }) {
  const pct = Math.min(100, Math.max(0, Number(value) || 0))
  return (
    <div className={className}>
      {label != null && (
        <div className="mb-1 flex items-center justify-between gap-2 text-xs text-sage-600">
          <span className="truncate">{label}</span>
          <span className="shrink-0 font-semibold text-sage-800">{Math.round(pct)} %</span>
        </div>
      )}
      <div
        className="h-2 overflow-hidden rounded-full bg-sage-100"
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="h-full rounded-full bg-sage-700 transition-[width] duration-300" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export function EmptyState({ title, hint, action }) {
  return (
    <div className="rounded-2xl border border-dashed border-sage-300 bg-white/50 px-6 py-14 text-center animate-fade-up">
      <p className="font-display text-xl text-sage-800">{title}</p>
      <p className="mt-2 text-sm text-sage-600">{hint}</p>
      {action}
    </div>
  )
}

export function ConfirmDialog({
  open,
  title = 'Confirmer',
  body,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  onConfirm,
  onClose,
  busy,
  danger,
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-3">
      <button type="button" className="absolute inset-0" aria-label="Fermer" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-t-2xl bg-sage-50 p-5 shadow-xl animate-fade-up sm:rounded-2xl">
        <h3 className="font-display text-xl text-sage-900">{title}</h3>
        {body && <p className="mt-2 text-sm text-sage-700">{body}</p>}
        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" className={btnGhost} onClick={onClose} disabled={busy}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={danger ? `${btnPrimary} !bg-danger hover:!bg-danger/90` : btnPrimary}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? '…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export function formatMoney(amount, currency = 'EUR') {
  try {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: currency === 'USD' ? 'USD' : 'EUR',
    }).format(Number(amount) || 0)
  } catch {
    return `${Number(amount) || 0} ${currency || 'EUR'}`
  }
}

export function clipText(text, n = 80) {
  const s = String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
  if (s.length <= n) return s
  return `${s.slice(0, n - 1)}…`
}
