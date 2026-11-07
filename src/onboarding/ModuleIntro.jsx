import { useState } from 'react'
import { ChevronDown, HelpCircle } from 'lucide-react'
import { useI18n } from '../i18n'
import { MODULE_CHROME, getModuleGuide, readIntroCollapsed, writeIntroCollapsed } from './guideContent'

export function ModuleIntro({ view, onOpenGuide, forceOpen, onToggle }) {
  const { t, lang } = useI18n()
  const data = getModuleGuide(lang, view)
  const [collapsedMap, setCollapsedMap] = useState(readIntroCollapsed)
  const collapsed = forceOpen ? false : Boolean(collapsedMap[view])

  if (!data) return null

  const toggle = () => {
    const next = { ...collapsedMap, [view]: !collapsed }
    setCollapsedMap(next)
    writeIntroCollapsed(next)
    onToggle?.(!collapsed)
  }

  return (
    <section className="mb-4 rounded-2xl border border-sage-200 bg-white/80 p-4 animate-fade-up">
      <button
        type="button"
        className="flex w-full min-h-11 items-center gap-2 text-left"
        onClick={toggle}
        aria-expanded={!collapsed}
      >
        <HelpCircle size={18} className="shrink-0 text-sage-600" />
        <span className="min-w-0 flex-1 font-display text-lg text-sage-900">
          {t('about.heading', { title: data.title })}
        </span>
        <ChevronDown size={18} className={`shrink-0 text-sage-500 transition ${collapsed ? '-rotate-90' : ''}`} />
      </button>
      {!collapsed && (
        <div className="mt-2 pl-7">
          <p className="text-sm leading-relaxed text-sage-700">
            {MODULE_CHROME[view]?.emoji ? (
              <span className="mr-1" aria-hidden="true">
                {MODULE_CHROME[view].emoji}
              </span>
            ) : null}
            {data.lead}
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-sage-700">
            {data.bullets.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
          {onOpenGuide && (
            <button
              type="button"
              className="mt-3 text-sm font-semibold text-sage-800 underline decoration-sage-300 underline-offset-2 hover:text-sage-950"
              onClick={onOpenGuide}
            >
              {t('about.openGuide')}
            </button>
          )}
        </div>
      )}
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
