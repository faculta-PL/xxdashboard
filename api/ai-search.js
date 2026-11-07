/** Vercel serverless GET/POST /api/ai-search (same handler as Vite + Firebase). */

import { createNodeHandler } from '../server/ai-http.mjs'

export const config = {
  runtime: 'nodejs',
  maxDuration: 60,
}

export default createNodeHandler('/api/ai-search')
