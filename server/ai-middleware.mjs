/** Vite connect middleware for GET/POST /api/ai, /api/ai/stream and /api/ai-search.
 * Same-origin search works in `vite` and `vite preview` without VITE_AI_URL.
 * Keys stay on the server (OPENAI_API_KEY | ANTHROPIC_API_KEY | GROK_API_KEY).
 * Never expose secrets to the client. Never prefix VITE_. */

import { dispatchAiRequest } from './ai-http.mjs'

export function attachAiMiddleware(server, env = process.env) {
  const mw = function nazixAiApi(req, res, next) {
    const handled = dispatchAiRequest(req, res, env)
    if (!handled) next()
  }
  server.middlewares.use(mw)
  const stack = server.middlewares.stack
  if (Array.isArray(stack) && stack.length > 1) {
    const idx = stack.findIndex((layer) => layer.handle === mw)
    if (idx > 0) {
      const [layer] = stack.splice(idx, 1)
      stack.unshift(layer)
    }
  }
}

export function nazixAiPlugin(env) {
  const attach = (server) => attachAiMiddleware(server, env || process.env)
  return {
    name: 'nazix-ai-api',
    configureServer: attach,
    configurePreviewServer: attach,
  }
}
