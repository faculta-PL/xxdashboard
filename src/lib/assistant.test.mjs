import {
  aiEndpoint,
  buildContextPayload,
  contextLabel,
  localAnswer,
  parseActions,
  parseActionsFromAssistant,
  budgetMath,
  wantsWebSearch,
  openAiUnavailable,
  webSearchUrls,
  isLocalAiHost,
  WEB_EMPTY_MESSAGE,
  displayAiContent,
  visibleStreamContent,
  splitDisplayAndActions,
} from './assistant.js'

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

const notes = [
  { id: 'n1', title: 'Compte-rendu sprint', content: 'Livraison du module fichiers prévue vendredi.', updatedAt: '2026-11-01' },
  { id: 'n2', title: 'Stratégie Q4', content: 'Priorité sur le budget marketing.', updatedAt: '2026-11-02' },
]
const budgets = [{ id: 'b1', name: 'Projet Alpha', plannedTotal: 10000, currency: 'EUR', projectId: 'p1' }]
const lines = [
  { id: 'l1', budgetId: 'b1', kind: 'actual', status: 'paid', amount: 2500 },
  { id: 'l2', budgetId: 'b1', kind: 'planned', amount: 8000 },
]
const risks = [
  {
    id: 'r1',
    title: 'Fournisseur en retard',
    description: 'Pièces manquantes',
    status: 'en cours',
    priority: 'élevée',
    dueDate: '2020-01-01',
  },
]
const projects = [{ id: 'p1', title: 'Alpha', description: 'Lancement', status: 'Actif', progress: 40 }]
const events = [{ id: 'e1', title: 'Point équipe', date: '2099-12-01', time: '10:00', description: 'Hebdo' }]

const ctx = buildContextPayload({
  section: 'notes',
  notes,
  ideas: [],
  projects,
  events,
  files: [{ id: 'f1', name: 'cdc.pdf', ext: 'pdf' }],
  budgets,
  budgetLines: lines,
  risks,
  selectedNoteIds: ['n1', 'n2'],
  currentProjectId: 'p1',
})

assert(ctx.notes.length === 2, 'selected notes in context')
assert(contextLabel(ctx).includes('Notes (2)'), contextLabel(ctx))
assert(contextLabel(ctx).includes('Projet Alpha'), contextLabel(ctx))

const math = budgetMath(budgets[0], lines)
assert(math.paid === 2500, 'paid')
assert(math.remaining === 7500, 'remaining')
assert(math.pct === 25, 'pct')

const budgetAns = localAnswer('quel est le budget restant', ctx)
assert(/7[\s\u00a0]?500/.test(budgetAns.text) || budgetAns.text.includes('7'), budgetAns.text)
assert(budgetAns.text.includes('Alpha'), budgetAns.text)

const riskAns = localAnswer('risques en retard', ctx)
assert(riskAns.text.includes('Fournisseur'), riskAns.text)

const miss = localAnswer('xyzzy-inconnu-42', ctx)
assert(/je n’ai pas trouvé/i.test(miss.text), miss.text)

const sum = localAnswer('résume mes notes', ctx)
assert(sum.text.includes('Compte-rendu sprint'), sum.text)

const actions = parseActions('crée une note « Suivi fournisseur »', ctx)
assert(actions.some((a) => a.kind === 'create_note'), JSON.stringify(actions))

const fenced =
  'Voici une proposition :\n```json\n{"kind":"create_note","label":"Créer une note","draft":{"title":"Suivi","content":"ok"}}\n```'
const jsonActions = parseActionsFromAssistant(fenced, ctx)
assert(jsonActions.some((a) => a.kind === 'create_note' && a.draft?.title === 'Suivi'), JSON.stringify(jsonActions))
const shown = displayAiContent(fenced)
assert(!shown.includes('```'), shown)
assert(!shown.includes('"kind"'), shown)
assert(!shown.includes('create_note'), shown)
assert(shown.includes('Voici une proposition'), shown)

const nestedLoose =
  'Ok.\n{"kind":"create_note","label":"Créer une note","draft":{"title":"A","content":"B"}}\n'
const nestedSplit = splitDisplayAndActions(nestedLoose)
assert(nestedSplit.actions.some((a) => a.kind === 'create_note' && a.draft?.title === 'A'), JSON.stringify(nestedSplit))
assert(!nestedSplit.content.includes('{'), nestedSplit.content)
assert(!nestedSplit.content.includes('create_note'), nestedSplit.content)

const fnCall = '{"name":"create_note","arguments":{"title":"Outil","content":"x"}}'
const fnSplit = splitDisplayAndActions(fnCall)
assert(fnSplit.actions[0]?.kind === 'create_note', JSON.stringify(fnSplit))
assert(!fnSplit.content.includes('{'), fnSplit.content)
assert(fnSplit.content.length > 0, 'fallback copy when only JSON')

const partial = 'Je rédige\n```json\n{"kind":"create_note"'
assert(visibleStreamContent(partial) === 'Je rédige', visibleStreamContent(partial))
assert(!visibleStreamContent(partial).includes('json'), visibleStreamContent(partial))
const heldBrace = 'Texte\n{"kind":'
assert(visibleStreamContent(heldBrace) === 'Texte', visibleStreamContent(heldBrace))
assert(openAiUnavailable('clé absente') === 'OpenAI indisponible: clé absente', 'error format')

assert(aiEndpoint('/api/ai') === '/api/ai', 'relative /api/ai without VITE_AI_URL')
assert(aiEndpoint('/api/ai/stream') === '/api/ai/stream', 'relative stream')
assert(aiEndpoint('/api/ai-search') === '/api/ai-search', 'relative search')

assert(isLocalAiHost('localhost', '3847', false) === true, 'localhost is local')
assert(isLocalAiHost('127.0.0.1', '3847', false) === true, 'loopback is local')
assert(isLocalAiHost('app.vercel.app', '', false) === false, 'vercel is prod')
assert(
  webSearchUrls('react', { hostname: 'localhost', port: '3847', aiBase: 'https://fn.example' }).join() ===
    '/api/ai-search?q=react',
  'local ignores AI base',
)
assert(
  webSearchUrls('react', { hostname: 'app.vercel.app', port: '', dev: false, aiBase: 'https://fn.example' }).includes(
    'https://fn.example/search?q=react',
  ),
  'prod uses /search',
)
assert(
  webSearchUrls('react', { hostname: 'app.vercel.app', port: '', dev: false, aiBase: 'https://fn.example' }).includes(
    'https://fn.example/api/ai-search?q=react',
  ),
  'prod uses /api/ai-search',
)
assert(
  webSearchUrls('react', { hostname: 'app.vercel.app', port: '', dev: false, aiBase: '' }).join() ===
    '/api/ai-search?q=react',
  'prod without AI base still hits same-origin',
)
assert(WEB_EMPTY_MESSAGE === 'Aucun résultat web pour le moment.', 'user-facing empty copy')
assert(!WEB_EMPTY_MESSAGE.includes('VITE_'), 'no env names')

assert(wantsWebSearch('cherche en ligne React', false) === true, 'web intent')
assert(wantsWebSearch('résume', false) === false, 'no web')
assert(wantsWebSearch('résume', true) === true, 'toggle web')

console.log('assistant tests ok')
