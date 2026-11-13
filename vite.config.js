import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, loadEnv } from 'vite'
import { nazixAiPlugin } from './server/ai-middleware.mjs'
import { tasksWirePlugin } from './server/tasks-wire.mjs'

/** Charge un fichier .env dans process.env sans jamais exposer la clé au client. */
function applyDotenvFile(file) {
  if (!existsSync(file)) return
  const text = readFileSync(file, 'utf8')
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq < 1) continue
    const key = line.slice(0, eq).trim()
    if (!key || key.startsWith('VITE_OPENAI') || key.startsWith('VITE_ANTHROPIC') || key.startsWith('VITE_GROK')) {
      continue
    }
    let val = line.slice(eq + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = val
  }
}

export default defineConfig(({ mode }) => {
  applyDotenvFile(resolve(process.cwd(), '.env'))
  applyDotenvFile(resolve(process.cwd(), '.env.local'))
  const env = loadEnv(mode, process.cwd(), '')
  for (const [key, value] of Object.entries(env)) {
    if (key.startsWith('VITE_OPENAI') || key.startsWith('VITE_ANTHROPIC') || key.startsWith('VITE_GROK')) continue
    if (process.env[key] === undefined) process.env[key] = value
  }
  if (process.env.VITE_OPENAI_API_KEY || env.VITE_OPENAI_API_KEY) {
    throw new Error('Ne jamais définir VITE_OPENAI_API_KEY — utilisez OPENAI_API_KEY côté serveur.')
  }
  return {
    appType: 'spa',
    plugins: [tasksWirePlugin(), react(), tailwindcss(), nazixAiPlugin(process.env)],
    // nazixAiPlugin: GET/POST /api/ai, /api/ai/stream, /api/ai/image, /api/ai-search on dev + preview (port 3847).
    server: {
      host: '0.0.0.0',
      port: 3847,
      strictPort: true,
    },
    preview: {
      host: '0.0.0.0',
      port: 3847,
      strictPort: true,
    },
  }
})
