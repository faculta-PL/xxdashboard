import { systemPromptFor } from './ai-http.mjs'
import {
  contextCountsLabel,
  effectiveUserQuestion,
  isDictationGarbage,
  researchView,
  shapeResearchText,
  stripLeaks,
} from './research-chat.mjs'

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed')
}

const dictation = "okay let's see oh it started writing already okay please Ultra sync my note"
assert(isDictationGarbage(dictation), 'dictation title')
assert(!isDictationGarbage('Produits pour le lancement de CrownHair France'), 'real title')
assert(!isDictationGarbage('Budget sur les achats de produits Crown'), 'budget title')

assert(contextCountsLabel({ counts: { notes: 3, projects: 4, risksOpen: 1, budgets: 2 } }) === 'Notes 3 · Projets 4 · Risques 1', 'counts only')
assert(!contextCountsLabel({ counts: { notes: 3 }, currentBudget: { name: 'Budget secret' } }).includes('secret'), 'no title')

const dumped = `Salut ! Que puis-je faire pour toi aujourd'hui ?\nNazix : « ${dictation} », « Produits pour le lancement de CrownHair France »`
const greeted = shapeResearchText(dumped, { query: 'salut', lang: 'fr' })
assert(greeted.includes('Réponse courte'), greeted)
assert(/salut/i.test(greeted), greeted)
assert(!/okay let's see|ultra sync|Nazix :|CrownHair|Contexte\s*:/i.test(greeted), greeted)
assert(!greeted.includes('Short answer'), 'french headings only')

const leaked = stripLeaks(dumped)
assert(!leaked.includes('Nazix :'), leaked)
assert(!leaked.includes(dictation), leaked)

const wiki = [
  {
    title: 'Tour Eiffel',
    url: 'https://fr.wikipedia.org/wiki/Tour_Eiffel',
    snippet: 'La tour Eiffel est une tour de fer puddlé de 330 mètres à Paris.',
    source: 'Wikipedia',
  },
]
const quick = shapeResearchText('', { query: 'Tour Eiffel', lang: 'fr', mode: 'quick', webSources: wiki })
assert(quick.includes('Réponse courte'), quick)
assert(quick.includes('fer puddlé'), quick)
assert(quick.includes('https://fr.wikipedia.org/wiki/Tour_Eiffel'), quick)
assert(quick.includes('Wikipédia'), quick)
assert(!quick.includes('Analyse'), quick)
assert(!quick.includes('```'), quick)

const deep = shapeResearchText('', { query: 'Tour Eiffel', lang: 'fr', mode: 'deep', webSources: wiki })
assert(deep.includes('Analyse'), deep)
assert(deep.includes('https://fr.wikipedia.org/wiki/Tour_Eiffel'), deep)

const again = shapeResearchText(quick, { query: 'Tour Eiffel', lang: 'fr', mode: 'quick', webSources: wiki })
assert(again === quick, `not idempotent:\n${again}\n---\n${quick}`)

const empty = shapeResearchText('Je n’ai pas accès à Internet.', {
  query: 'Tour Eiffel',
  lang: 'fr',
  webSources: [],
  webAttempted: true,
})
assert(empty.includes('Limites'), empty)
assert(/n’a rien renvoyé|n'a rien renvoyé|rien n’est inventé|rien n'est inventé/i.test(empty), empty)
assert(!/330 mètres/.test(empty), empty)

const clash = shapeResearchText('', {
  query: 'hauteur',
  lang: 'fr',
  mode: 'quick',
  webSources: [
    { title: 'A', url: 'https://example.com/a', snippet: 'Hauteur 300 mètres.', source: 'Web' },
    { title: 'B', url: 'https://example.com/b', snippet: 'Hauteur 330 mètres.', source: 'Web' },
  ],
})
assert(clash.includes('Analyse'), clash)
assert(/ne s’accordent pas|ne s'accordent pas/i.test(clash), clash)

const english = shapeResearchText('', {
  query: 'Eiffel Tower',
  lang: 'en',
  mode: 'quick',
  webSources: [
    {
      title: 'Eiffel Tower',
      url: 'https://en.wikipedia.org/wiki/Eiffel_Tower',
      snippet: 'The Eiffel Tower is a wrought-iron tower in Paris.',
      source: 'Wikipedia',
    },
  ],
})
assert(english.includes('Short answer'), english)
assert(english.includes('Wikipedia'), english)
assert(!english.includes('Réponse courte'), english)
assert(!english.includes('Wikipédia'), english)

assert(effectiveUserQuestion('Regarde sur internet', ["C'est quoi la tour eiffel ?"]) === "C'est quoi la tour eiffel ?", 'reuse previous')
assert(effectiveUserQuestion('Plus court', ['Tour Eiffel']) === 'Tour Eiffel', 'shorter reuses')
assert(effectiveUserQuestion('compare', []) === 'compare', 'ambiguous stays')
const ambiguous = shapeResearchText('tout le workspace', { query: 'compare', lang: 'fr' })
assert(ambiguous.includes('?'), ambiguous)
assert(!ambiguous.includes('workspace'), ambiguous)

const view = researchView(quick)
assert(view.structured, 'structured view')
assert(view.sections.some((section) => section.key === 'sources' && section.items[0].url.includes('wikipedia.org')), 'link parsed')

const fr = systemPromptFor('fr')
const en = systemPromptFor('en', { mode: 'deep' })
assert(fr.includes('Réponse courte'), fr)
assert(!fr.includes('Short answer'), 'fr prompt stays french')
assert(en.includes('Short answer'), en)
assert(!en.includes('Réponse courte'), 'en prompt stays english')
assert(fr.includes('ne le recopie pas') || fr.includes('Ne le recopie') || fr.includes('ne le recopie'), fr)
assert(systemPromptFor('fr', { web: true }).includes('Tu PEUX'), 'web override kept')

console.log('research-chat ok')
