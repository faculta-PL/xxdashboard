import { interpolate, normalizeLang, translate, landingPlanPoints } from './lib/i18nCore.js'

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
assert(translate('fr', 'tools.title') === 'Création', 'tools')
assert(translate('en', 'nav.help', { label: 'Notes' }) === 'Help — Notes', interpolate('Help — {label}', { label: 'Notes' }))
assert(landingPlanPoints('en', 'free').length === 4, 'plan points')
assert(!translate('fr', 'nav.notes').includes('VITE_'), 'no vite')
console.log('i18n ok')
