import {
  answerFromSources,
  ensureSourceReply,
  isBareInternetAsk,
  isEncyclopedicQuery,
  normalizeWebQuery,
  resolveWebQuery,
  searchFailureMessage,
  userAskedForWeb,
} from './web-query.mjs'
import { systemPromptFor } from './ai-http.mjs'

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

assert(normalizeWebQuery('Tour Eiffel') === 'Tour Eiffel', 'keep Tour Eiffel')
assert(normalizeWebQuery("C'est quoi la tour eiffel ?") === 'tour eiffel', 'strip c est quoi')
assert(normalizeWebQuery('Qu’est-ce que la tour Eiffel ?') === 'tour Eiffel', 'strip qu est-ce')
assert(isBareInternetAsk('Regarde sur internet') === true, 'bare internet')
assert(isBareInternetAsk('cherche sur le web') === true, 'bare web')
assert(isBareInternetAsk('search the web') === true, 'bare search the web')
assert(isBareInternetAsk('cherche en ligne React') === false, 'topic stays')
assert(
  resolveWebQuery('Regarde sur internet', ["C'est quoi la tour eiffel ?"]) === 'tour eiffel',
  'follow-up uses the previous question',
)
assert(isEncyclopedicQuery('Tour Eiffel') === true, 'short topic is encyclopedic')
assert(isEncyclopedicQuery("C'est quoi la tour eiffel ?") === true, 'c est quoi is encyclopedic')
assert(userAskedForWeb('Regarde sur internet') === true, 'internet intent')
assert(userAskedForWeb('résume mes notes') === false, 'workspace intent')

const sources = [
  {
    title: 'Tour Eiffel',
    url: 'https://fr.wikipedia.org/wiki/Tour_Eiffel',
    snippet: 'La tour Eiffel est une tour de fer puddlé à Paris.',
  },
]
const refused =
  "Je n'ai pas accès à Internet pour effectuer des recherches. Je peux uniquement vous aider avec les informations disponibles dans votre espace de travail collaboratif Nazix."
const fixed = ensureSourceReply(refused, sources, 'fr')
assert(!/n['’]ai pas acc[eè]s/i.test(fixed), fixed)
assert(fixed.includes('https://fr.wikipedia.org/wiki/Tour_Eiffel'), 'link kept')
assert(fixed.includes('fer puddlé'), 'snippet kept')
const nazixOnly = ensureSourceReply(
  'Je n’ai pas trouvé d’informations sur la tour Eiffel dans le contexte Nazix.',
  sources,
  'fr',
)
assert(nazixOnly.includes('https://fr.wikipedia.org/wiki/Tour_Eiffel'), 'nazix-only refusal uses the source')
assert(!/pas trouv/i.test(nazixOnly), nazixOnly)
assert(answerFromSources(sources, 'en').includes('Sources:'), 'en heading')
assert(searchFailureMessage('fr', { status: 503 }) === 'La recherche web a échoué (HTTP 503).', 'fr status')
assert(searchFailureMessage('en', { status: 0 }) === 'Web search failed (network).', 'en network')

const webFr = systemPromptFor('fr', { web: true })
const webEn = systemPromptFor('en', { web: true })
assert(webFr.includes('Tu PEUX'), webFr)
assert(!webFr.includes('Utilise uniquement le contexte fourni'), 'fr restriction lifted')
assert(webEn.includes('You MAY'), webEn)
assert(!webEn.includes('Use only the provided context'), 'en restriction lifted')
assert(systemPromptFor('fr').includes('Réponds en français'), 'default fr prompt')
assert(systemPromptFor('en').includes('Reply in English'), 'default en prompt')
assert(!webFr.includes('sk-') && !webEn.includes('sk-'), 'no secrets')

console.log('web-query ok')
