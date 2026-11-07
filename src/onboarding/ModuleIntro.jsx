import { HelpCircle } from 'lucide-react'
import { useI18n } from '../i18n'
import { MODULE_CHROME, getModuleGuide } from './guideContent'

export function ModuleIntro({ view, onOpenGuide, forceOpen }) {
  const { t, lang } = useI18n()
  const data = getModuleGuide(lang, view)

  if (!data) return null

  const next = data.bullets?.[0] || ''
  const extra = forceOpen ? data.bullets?.slice(1) || [] : []

  return (
    <section className="mb-4 rounded-2xl border border-sage-200 bg-white/80 px-3 py-2.5 animate-fade-up">
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sage-100 text-base" aria-hidden="true">
          {MODULE_CHROME[view]?.emoji || '🌿'}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm leading-snug text-sage-800">{data.lead}</p>
          {next ? (
            <p className="mt-0.5 text-xs leading-snug text-sage-500">
              <span className="font-semibold text-sage-600">{t('about.nextDo')}</span> {next}
            </p>
          ) : null}
          {extra.length > 0 && (
            <ul className="mt-2 list-disc space-y-0.5 pl-4 text-xs text-sage-600">
              {extra.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          )}
        </div>
        {onOpenGuide && (
          <button
            type="button"
            className="inline-flex min-h-9 shrink-0 items-center rounded-lg px-2 text-xs font-semibold text-sage-800 underline decoration-sage-300 underline-offset-2 hover:bg-sage-100 hover:text-sage-950"
            onClick={onOpenGuide}
          >
            {t('about.openGuide')}
          </button>
        )}
      </div>
    </section>
  )
}

export function HelpHeaderButton({ onClick, label }) {
  const { t } = useI18n()
  const text = label || t('about.helpModule')
  return (
    <button
      type="button"
      className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-sage-700 hover:bg-sage-200"
      onClick={onClick}
      aria-label={text}
      title={text}
    >
      <HelpCircle size={20} />
    </button>
  )
}
