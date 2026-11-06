/** Vite connect middleware for POST /api/ai, POST /api/ai/stream and POST /api/ai-search.
 * Keys stay on the server (OPENAI_API_KEY | ANTHROPIC_API_KEY | GROK_API_KEY).
 * Never expose secrets to the client. Never prefix VITE_. */

import { dispatchAiRequest } from './ai-http.mjs'

export function attachAiMiddleware(server, env = process.env) {
  server.middlewares.use((req, res, next) => {
    const handled = dispatchAiRequest(req, res, env)
    if (!handled) {
      next()
      return
    }
  })
}

export function nazixAiPlugin(env) {
  const attach = (server) => attachAiMiddleware(server, env || process.env)
  return {
    name: 'nazix-ai-api',
    configureServer: attach,
    configurePreviewServer: attach,
  }
}
