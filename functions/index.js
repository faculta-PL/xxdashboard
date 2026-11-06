/** Cloud Function `ai` — HTTPS proxy for /api/ai, /api/ai/stream, /api/ai-search.
 * OPENAI_API_KEY is a Functions secret (never a VITE_ frontend var). */

import { initializeApp } from 'firebase-admin/app'
import { defineSecret } from 'firebase-functions/params'
import { onRequest } from 'firebase-functions/v2/https'
import { applyCors, dispatchAiRequest } from './ai-http.mjs'

try {
  initializeApp()
} catch {
  /* already initialized */
}

const openaiApiKey = defineSecret('OPENAI_API_KEY')

function functionEnv() {
  return {
    ...process.env,
    OPENAI_API_KEY: openaiApiKey.value() || process.env.OPENAI_API_KEY || '',
  }
}

export const ai = onRequest(
  {
    region: 'us-central1',
    timeoutSeconds: 60,
    memory: '256MiB',
    secrets: [openaiApiKey],
    invoker: 'public',
    cors: false,
  },
  async (req, res) => {
    const env = functionEnv()
    applyCors(req, res, env)
    if (req.method === 'OPTIONS') {
      res.status(204).end()
      return
    }
    const handled = dispatchAiRequest(req, res, env)
    if (!handled) {
      res.status(404).json({ ok: false, error: 'Route inconnue.' })
      return
    }
    await handled
  },
)
