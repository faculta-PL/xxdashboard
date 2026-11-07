import { isAiPath, resolveAiLang, systemPromptFor } from './ai-http.mjs'

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

assert(isAiPath('/api/ai/image') === true, 'image path')
assert(resolveAiLang({ language: 'en' }) === 'en', 'en')
assert(resolveAiLang({ lang: 'FR' }) === 'fr', 'fr')
assert(systemPromptFor('en').includes('Reply in English'), 'en prompt')
assert(systemPromptFor('fr').includes('Réponds en français'), 'fr prompt')
assert(!systemPromptFor('en').includes('sk-'), 'no secrets')
console.log('ai-lang ok')
