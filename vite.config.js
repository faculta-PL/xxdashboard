import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, loadEnv } from 'vite'
import { nazixAiPlugin } from './server/ai-middleware.mjs'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  for (const [key, value] of Object.entries(env)) {
    if (process.env[key] === undefined) process.env[key] = value
  }
  return {
    plugins: [react(), tailwindcss(), nazixAiPlugin(process.env)],
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
