/** Vercel serverless — /api/ai, plus rewrites for /api/ai/stream and /api/ai-search.
 * Set OPENAI_API_KEY in the Vercel project (server env), never VITE_OPENAI_API_KEY. */

import { createNodeHandler } from '../server/ai-http.mjs'

export const config = {
  runtime: 'nodejs',
  supportsResponseStreaming: true,
  maxDuration: 60,
}

function pathOverride(req) {
  const q = req.query || {}
  const raw = q.__nazix || q.__path
  if (raw == null || raw === '') return undefined
  return Array.isArray(raw) ? raw[0] : String(raw)
}

export default function handler(req, res) {
  return createNodeHandler(pathOverride(req))(req, res)
}
