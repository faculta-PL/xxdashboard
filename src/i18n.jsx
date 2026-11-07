/** Nazix i18n React hook. Persist nazix_lang. */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
export {
  LANG_KEY,
  LANGS,
  normalizeLang,
  readLang,
  writeLang,
  interpolate,
  translate,
  landingPlanPoints,
  calendarLabels,
  dateLocale,
  dictKeyList,
  valueLabel,
  formatDateTime,
  formatDate,
} from './lib/i18nCore.js'
import { LANGS, readLang, writeLang, translate } from './lib/i18nCore.js'

const I18nContext = createContext({
  lang: 'fr',
  setLang: () => {},
  t: (key, vars) => translate('fr', key, vars),
})

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(readLang)

  useEffect(() => {
    writeLang(lang)
    if (typeof document !== 'undefined') document.documentElement.lang = lang
  }, [lang])

  const setLang = useCallback((next) => {
    setLangState(writeLang(next))
  }, [])

  const t = useCallback((key, vars) => translate(lang, key, vars), [lang])

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  return useContext(I18nContext)
}

export function LangToggle({ className = '' }) {
  const { lang, setLang, t } = useI18n()
  return (
    <div
      role="group"
      aria-label={t('common.language')}
      className={`inline-flex shrink-0 rounded-full border border-sage-300 bg-white/80 p-0.5 text-xs font-semibold ${className}`}
    >
      {LANGS.map((code) => (
        <button
          key={code}
          type="button"
          aria-pressed={lang === code}
          className={`min-h-8 min-w-9 rounded-full px-2 ${
            lang === code ? 'bg-sage-800 text-white' : 'text-sage-700 hover:bg-sage-100'
          }`}
          onClick={() => setLang(code)}
        >
          {code.toUpperCase()}
        </button>
      ))}
    </div>
  )
}
