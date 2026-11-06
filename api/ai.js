/** Optional Vercel fallback for relative /api/ai — NOT the product backend.
 * Product AI is Firebase Cloud Function `ai` (set VITE_AI_URL on the frontend).
 * OPENAI_API_KEY stays a Firebase Functions secret, never VITE_. */

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
