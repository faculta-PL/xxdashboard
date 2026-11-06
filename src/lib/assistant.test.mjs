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

const jsonActions = parseActionsFromAssistant(
  'Voici une proposition :\n```json\n{"kind":"create_note","label":"Créer une note","draft":{"title":"Suivi","content":"ok"}}\n```',
  ctx,
)
assert(jsonActions.some((a) => a.kind === 'create_note' && a.draft?.title === 'Suivi'), JSON.stringify(jsonActions))
assert(openAiUnavailable('clé absente') === 'OpenAI indisponible: clé absente', 'error format')

assert(aiEndpoint('/api/ai') === '/api/ai', 'relative /api/ai without VITE_AI_URL')
assert(aiEndpoint('/api/ai/stream') === '/api/ai/stream', 'relative stream')
assert(aiEndpoint('/api/ai-search') === '/api/ai-search', 'relative search')

assert(wantsWebSearch('cherche en ligne React', false) === true, 'web intent')
assert(wantsWebSearch('résume', false) === false, 'no web')
assert(wantsWebSearch('résume', true) === true, 'toggle web')

console.log('assistant tests ok')
