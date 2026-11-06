/** Vercel serverless — /api/ai, plus rewrites for /api/ai/stream and /api/ai-search.
 * Set OPENAI_API_KEY in the Vercel project (server env), never VITE_OPENAI_API_KEY. */

import { createNodeHandler } from '../server/ai-http.mjs'

export const config = {
  supportsResponseStreaming: true,
}

export default createNodeHandler()
