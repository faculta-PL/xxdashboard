import {
  interpolate,
  normalizeLang,
  translate,
  landingPlanPoints,
  dictKeyList,
  dateLocale,
} from './lib/i18nCore.js'

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

assert(normalizeLang('EN-us') === 'en', 'en')
assert(normalizeLang('fr') === 'fr', 'fr')
assert(normalizeLang('') === 'fr', 'default fr')
assert(translate('fr', 'nav.notes') === 'Notes', 'fr notes')
assert(translate('en', 'nav.notes') === 'Notes', 'en notes')
assert(translate('en', 'nav.dashboard') === 'Dashboard', 'en dashboard')
assert(translate('fr', 'nav.dashboard') === 'Tableau de bord', 'fr dashboard')
assert(translate('en', 'common.save') === 'Save', 'save en')
assert(translate('fr', 'common.view') === 'Voir', 'view fr')
assert(translate('en', 'voice.dictate') === 'Dictate', 'dictate')
assert(translate('fr', 'voice.dictate') === 'Dicter', 'dicter')
assert(translate('fr', 'tools.title') === 'Création', 'tools')
assert(translate('en', 'nav.help', { label: 'Notes' }) === 'Help — Notes', interpolate('Help — {label}', { label: 'Notes' }))
assert(landingPlanPoints('en', 'free').length === 4, 'plan points')
assert(!translate('fr', 'nav.notes').includes('VITE_'), 'no vite')

assert(translate('en', 'nav.groupWorkspace') === 'Workspace', 'en workspace')
assert(translate('fr', 'nav.groupWorkspace') === 'Espace de travail', 'fr workspace')
assert(!translate('fr', 'nav.groupWorkspace').toLowerCase().includes('workspace'), 'no leftover workspace in fr')
assert(translate('en', 'about.openGuide') === 'Open the Guide', 'about en')
assert(translate('fr', 'about.openGuide') === 'Ouvrir le Guide', 'about fr')
assert(translate('en', 'about.heading', { title: 'Exports' }) === 'About — Exports', 'about heading en')
assert(translate('fr', 'about.heading', { title: 'Exports' }) === 'À propos — Exports', 'about heading fr')
assert(translate('en', 'exportUi.rows', { n: 3 }).includes('consolidated'), 'export rows en')
assert(translate('fr', 'exportUi.rows', { n: 3 }).includes('consolidées'), 'export rows fr')
assert(translate('en', 'exportUi.hint').toLowerCase().includes('encoding'), 'encoding en')
assert(translate('fr', 'exportUi.hint').includes('Encodage'), 'encoding fr')
assert(translate('en', 'chrome.export').length > 10, 'chrome export en')
assert(translate('fr', 'chrome.export').length > 10, 'chrome export fr')
assert(dateLocale('en') === 'en-GB', 'date en')
assert(dateLocale('fr') === 'fr-FR', 'date fr')

const frKeys = dictKeyList('fr').sort()
const enKeys = dictKeyList('en').sort()
const missingEn = frKeys.filter((k) => !enKeys.includes(k))
const missingFr = enKeys.filter((k) => !frKeys.includes(k))
assert(missingEn.length === 0, `EN missing keys: ${missingEn.join(', ')}`)
assert(missingFr.length === 0, `FR missing keys: ${missingFr.join(', ')}`)

console.log('i18n ok')
