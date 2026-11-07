import { parseFeedbackRewrite } from './feedback.js'

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

const parsed = parseFeedbackRewrite('TITRE: Export PDF\nMESSAGE: Pouvoir exporter les notes liées.')
assert(parsed.title === 'Export PDF', 'title')
assert(parsed.body.includes('exporter'), 'body')

const fallback = parseFeedbackRewrite('Une seule ligne')
assert(fallback.body === 'Une seule ligne', 'fallback body')

console.log('parseFeedbackRewrite ok')
