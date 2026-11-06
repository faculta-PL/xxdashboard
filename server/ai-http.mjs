/** Handlers Node (req/res) for POST /api/ai, /api/ai/stream and /api/ai-search.
 * Shared by Vite middleware, Firebase Cloud Functions and Vercel serverless.
 * Keys stay on the server (OPENAI_API_KEY | ANTHROPIC_API_KEY | GROK_API_KEY).
 * Never expose secrets to the client. Never prefix VITE_. */

const MAX_BODY = 256 * 1024
const LLM_TIMEOUT_MS = 30000
const SEARCH_TIMEOUT_MS = 8000
const LAST_N = 20

const DEFAULT_ORIGINS = [
  'https://partagio.web.app',
  'https://partagio.firebaseapp.com',
  'http://localhost:3847',
  'http://127.0.0.1:3847',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
]

function extraOrigins(env = process.env) {
  const raw = env.NAZIX_CORS_ORIGINS || env.CORS_ORIGINS || ''
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

export function isAllowedOrigin(origin, env = process.env) {
  if (!origin) return false
  if (DEFAULT_ORIGINS.includes(origin)) return true
  if (extraOrigins(env).includes(origin)) return true
  try {
    const u = new URL(origin)
    if (u.protocol === 'https:') {
      if (u.hostname === 'partagio.web.app' || u.hostname === 'partagio.firebaseapp.com') return true
      if (u.hostname.endsWith('.partagio.web.app')) return true
      if (/^partagio--[a-z0-9-]+\.web\.app$/i.test(u.hostname)) return true
      if (u.hostname.endsWith('.vercel.app')) return true
      if (u.hostname.endsWith('.netlify.app')) return true
    }
    if (env.VERCEL_URL && origin === `https://${env.VERCEL_URL}`) return true
  } catch {
    return false
  }
  return false
}

export function applyCors(req, res, env = process.env) {
  const origin = req.headers?.origin || req.headers?.Origin
  if (origin && isAllowedOrigin(String(origin), env)) {
    res.setHeader('Access-Control-Allow-Origin', String(origin))
    res.setHeader('Vary', 'Origin')
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Authorization')
  res.setHeader('Access-Control-Max-Age', '3600')
}

function json(res, status, body) {
  const payload = JSON.stringify(body)
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(payload)
}

function readBody(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    return Promise.resolve(req.body)
  }
  if (typeof req.body === 'string') {
    const raw = req.body.trim()
    if (!raw) return Promise.resolve({})
    try {
      return Promise.resolve(JSON.parse(raw))
    } catch {
      return Promise.reject(Object.assign(new Error('JSON invalide.'), { status: 400 }))
    }
  }
  const rawBuf = req.rawBody
  if (rawBuf != null) {
    const raw = (Buffer.isBuffer(rawBuf) ? rawBuf.toString('utf8') : String(rawBuf)).trim()
    if (!raw) return Promise.resolve({})
    try {
      return Promise.resolve(JSON.parse(raw))
    } catch {
      return Promise.reject(Object.assign(new Error('JSON invalide.'), { status: 400 }))
    }
  }
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > MAX_BODY) {
        reject(Object.assign(new Error('Payload trop volumineux.'), { status: 413 }))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8').trim()
      if (!raw) {
        resolve({})
        return
      }
      try {
        resolve(JSON.parse(raw))
      } catch {
        reject(Object.assign(new Error('JSON invalide.'), { status: 400 }))
      }
    })
    req.on('error', reject)
  })
}

function stripTrailing(path) {
  return String(path || '/').replace(/\/+$/, '') || '/'
}

const AI_PATHS = new Set(['/api/ai', '/api/ai/stream', '/api/ai-search'])

export function isAiPath(path) {
  return AI_PATHS.has(stripTrailing(path))
}

function firstQueryValue(value) {
  if (value == null || value === '') return ''
  return String(Array.isArray(value) ? value[0] : value)
}

function pathFromMaybeUrl(raw) {
  const text = String(raw || '')
  if (!text) return { path: '', nazix: '' }
  try {
    const u = new URL(text, 'http://local')
    return {
      path: normalizeApiPath(u.pathname),
      nazix: u.searchParams.get('__nazix') || u.searchParams.get('__path') || '',
    }
  } catch {
    const [pathname, search = ''] = text.split('?')
    const params = new URLSearchParams(search)
    return {
      path: normalizeApiPath(pathname),
      nazix: params.get('__nazix') || params.get('__path') || '',
    }
  }
}

/** Prefer rewrite query `__nazix` so Vercel `/api/ai` still dispatches stream/search. */
export function requestPath(req) {
  const headers = req.headers || {}
  const query = req.query || {}
  const fromReqQuery = firstQueryValue(query.__nazix || query.__path)
  if (fromReqQuery) return normalizeApiPath(fromReqQuery)

  const candidates = []
  const consider = (raw) => {
    if (!raw) return
    const bits = pathFromMaybeUrl(raw)
    if (bits.nazix) candidates.push(normalizeApiPath(bits.nazix))
    if (bits.path) candidates.push(bits.path)
  }
  consider(req.url || req.path || '/')
  consider(headers['x-forwarded-uri'])
  consider(headers['x-original-path'])
  consider(headers['x-invoke-path'])
  consider(headers['x-matched-path'])

  const aiCandidates = [...new Set(candidates.filter(isAiPath))]
  const stream = aiCandidates.find((p) => p === '/api/ai/stream')
  if (stream) return stream
  const search = aiCandidates.find((p) => p === '/api/ai-search')
  if (search) return search
  if (aiCandidates[0]) return aiCandidates[0]
  return candidates[0] || normalizeApiPath('/')
}

function normalizeApiPath(path) {
  let p = stripTrailing(path)
  // Direct Cloud Function URL: …/ai/api/ai → /api/ai
  if (p.startsWith('/ai/api/')) p = p.slice(3)
  else if (p === '/ai/api') p = '/api'
  return p
}

function detectProvider(env) {
  if (env.OPENAI_API_KEY) return { name: 'openai', key: env.OPENAI_API_KEY }
  if (env.ANTHROPIC_API_KEY) return { name: 'anthropic', key: env.ANTHROPIC_API_KEY }
  if (env.GROK_API_KEY) return { name: 'grok', key: env.GROK_API_KEY }
  return null
}

function statusPayload(env) {
  const provider = detectProvider(env)
  if (!provider) {
    return {
      mode: 'local',
      ok: false,
      hasKey: false,
      error: 'OPENAI_API_KEY manquante',
    }
  }
  return { mode: provider.name, ok: true, hasKey: true, provider: provider.name }
}

const SYSTEM_PROMPT = `Tu es Nazix, l’assistant conversationnel de l’espace de travail collaboratif Nazix.
Réponds en français, clairement, de façon utile et naturelle — comme un assistant ChatGPT, mais ancré dans Nazix.
Utilise uniquement le contexte fourni (notes, idées, projets, budget, risques, fichiers, calendrier auxquels l’utilisateur a accès).
Cite les titres entre « ». N’invente jamais de données privées absentes du contexte.
Si tu manques d’information : dis-le clairement (« je n’ai pas trouvé ») plutôt que de fabuler.
Distingue les faits Nazix des résultats web (libellé Web).
Ne propose jamais de supprimer, de partager, ni de modifier les droits d’accès.
Tu ne crées rien tout seul : si une création est utile (note, sous-note, idée, risque, ligne budgétaire, brouillon de message), propose-la et ajoute éventuellement un bloc JSON, l’humain confirmera :

\`\`\`json
{"kind":"create_note","label":"Créer une note","draft":{"title":"…","content":"…"}}
\`\`\`

Kinds possibles : create_note, create_subnote, create_idea, create_risk, create_budget_line, draft_message.`

function toChatMessages(body) {
  const incoming = Array.isArray(body.messages) ? body.messages : []
  const mapped = incoming
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && m.content)
    .slice(-LAST_N)
    .map((m) => ({
      role: m.role,
      content: String(m.content).slice(0, 8000),
    }))
  const context = body.context && typeof body.context === 'object' ? body.context : {}
  const contextText = JSON.stringify(context).slice(0, 24000)
  const parts = []
  if (contextText && contextText !== '{}') {
    parts.push(`Contexte Nazix (uniquement des éléments déjà lisibles par l’utilisateur) :\n${contextText}`)
  }
  if (body.web && typeof body.web === 'object') {
    parts.push(`Résultats web (DuckDuckGo, ce ne sont pas des faits Nazix) :\n${JSON.stringify(body.web).slice(0, 8000)}`)
  }
  if (parts.length) {
    mapped.unshift({
      role: 'user',
      content: parts.join('\n\n'),
    })
    mapped.splice(1, 0, {
      role: 'assistant',
      content:
        'J’ai bien le contexte. Je m’appuierai uniquement sur ces éléments, je citerai les titres, et je distinguerai le web le cas échéant.',
    })
  }
  return mapped
}

function sanitizeLlmError(prefix, errText = '') {
  const clipped = String(errText || '')
    .replace(/sk-[a-zA-Z0-9_-]+/g, '[redacted]')
    .replace(/Bearer\s+\S+/gi, 'Bearer [redacted]')
    .slice(0, 180)
  return clipped ? `${prefix} — ${clipped}` : prefix
}

function combinedAbort(req, ms) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), ms)
  const onClose = () => ctrl.abort()
  if (req && typeof req.on === 'function') req.on('close', onClose)
  return {
    signal: ctrl.signal,
    cleanup() {
      clearTimeout(timer)
      req?.off?.('close', onClose)
    },
  }
}

async function fetchWithTimeout(url, options, ms, req) {
  const { signal, cleanup } = combinedAbort(req || { on() {}, off() {} }, ms)
  try {
    return await fetch(url, { ...options, signal })
  } finally {
    cleanup()
  }
}

function openaiMessages(messages) {
  return [{ role: 'system', content: SYSTEM_PROMPT }, ...messages]
}

async function callOpenAI(key, messages, req) {
  const res = await fetchWithTimeout(
    'https://api.openai.com/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.4,
        max_tokens: 1400,
        messages: openaiMessages(messages),
      }),
    },
    LLM_TIMEOUT_MS,
    req,
  )
  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(sanitizeLlmError(`OpenAI ${res.status}`, errText))
  }
  const data = await res.json()
  const text = data?.choices?.[0]?.message?.content
  if (!text) throw new Error('Réponse OpenAI vide.')
  return String(text)
}

async function callAnthropic(key, messages, req) {
  const res = await fetchWithTimeout(
    'https://api.anthropic.com/v1/messages',
    {
      method: 'POST',
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-latest',
        max_tokens: 1400,
        system: SYSTEM_PROMPT,
        messages,
      }),
    },
    LLM_TIMEOUT_MS,
    req,
  )
  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(sanitizeLlmError(`Anthropic ${res.status}`, errText))
  }
  const data = await res.json()
  const text = (data.content || [])
    .map((c) => c.text || '')
    .join('\n')
    .trim()
  if (!text) throw new Error('Réponse Anthropic vide.')
  return text
}

async function callGrok(key, messages, req) {
  const res = await fetchWithTimeout(
    'https://api.x.ai/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'grok-2-latest',
        temperature: 0.4,
        max_tokens: 1400,
        messages: openaiMessages(messages),
      }),
    },
    LLM_TIMEOUT_MS,
    req,
  )
  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(sanitizeLlmError(`Grok ${res.status}`, errText))
  }
  const data = await res.json()
  const text = data?.choices?.[0]?.message?.content
  if (!text) throw new Error('Réponse Grok vide.')
  return String(text)
}

async function callLlm(provider, messages, req) {
  if (provider.name === 'openai') return callOpenAI(provider.key, messages, req)
  if (provider.name === 'anthropic') return callAnthropic(provider.key, messages, req)
  return callGrok(provider.key, messages, req)
}

function startSse(res) {
  res.statusCode = 200
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  if (typeof res.flushHeaders === 'function') res.flushHeaders()
}

function sseWrite(res, obj) {
  res.write(`data: ${JSON.stringify(obj)}\n\n`)
}

async function streamOpenAI(key, messages, req, res) {
  const openaiRes = await fetchWithTimeout(
    'https://api.openai.com/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.4,
        max_tokens: 1400,
        stream: true,
        messages: openaiMessages(messages),
      }),
    },
    LLM_TIMEOUT_MS,
    req,
  )
  if (!openaiRes.ok) {
    const errText = await openaiRes.text().catch(() => '')
    throw new Error(sanitizeLlmError(`OpenAI ${openaiRes.status}`, errText))
  }
  if (!openaiRes.body || typeof openaiRes.body.getReader !== 'function') {
    throw new Error('Flux OpenAI indisponible.')
  }
  const reader = openaiRes.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let full = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data:')) continue
      const raw = trimmed.slice(5).trim()
      if (!raw || raw === '[DONE]') continue
      let parsed
      try {
        parsed = JSON.parse(raw)
      } catch {
        continue
      }
      const delta = parsed?.choices?.[0]?.delta?.content || ''
      if (delta) {
        full += delta
        sseWrite(res, { delta })
      }
    }
  }
  sseWrite(res, { done: true, text: full, provider: 'openai', ok: true })
  res.end()
  return full
}

async function handleAi(req, res, env) {
  if (req.method === 'GET') {
    json(res, 200, statusPayload(env))
    return
  }
  if (req.method !== 'POST') {
    json(res, 405, { ok: false, error: 'Méthode non autorisée.' })
    return
  }
  const provider = detectProvider(env)
  if (!provider) {
    json(res, 200, {
      mode: 'local',
      ok: false,
      hasKey: false,
      error: 'OPENAI_API_KEY manquante',
    })
    return
  }
  const body = await readBody(req)
  const messages = toChatMessages(body)
  const text = await callLlm(provider, messages, req)
  json(res, 200, { ok: true, mode: 'external', provider: provider.name, text })
}

async function handleAiStream(req, res, env) {
  if (req.method === 'GET') {
    json(res, 200, statusPayload(env))
    return
  }
  if (req.method !== 'POST') {
    json(res, 405, { ok: false, error: 'Méthode non autorisée.' })
    return
  }
  const provider = detectProvider(env)
  if (!provider) {
    json(res, 200, {
      mode: 'local',
      ok: false,
      hasKey: false,
      error: 'OPENAI_API_KEY manquante',
    })
    return
  }
  const body = await readBody(req)
  const messages = toChatMessages(body)
  startSse(res)
  try {
    if (provider.name === 'openai') {
      await streamOpenAI(provider.key, messages, req, res)
      return
    }
    const text = await callLlm(provider, messages, req)
    sseWrite(res, { delta: text })
    sseWrite(res, { done: true, text, provider: provider.name, ok: true })
    res.end()
  } catch (err) {
    const error = err?.name === 'AbortError' ? 'délai dépassé (30 s)' : err.message || 'Erreur flux IA.'
    try {
      sseWrite(res, { error, ok: false })
      res.end()
    } catch {
      /* headers may already be closed */
    }
  }
}

function collectDdgResults(data, q) {
  const items = []
  const push = (title, snippet, url, source) => {
    const t = String(title || '').trim()
    const s = String(snippet || '').trim()
    const u = String(url || '').trim()
    if (!t && !s) return
    items.push({
      title: t || q,
      snippet: s.slice(0, 400),
      url: u,
      source: source || 'DuckDuckGo',
      origin: 'web',
    })
  }
  if (data.AbstractText) {
    push(data.Heading || q, data.AbstractText, data.AbstractURL, data.AbstractSource || 'DuckDuckGo')
  }
  if (data.Answer) {
    push(data.Heading || q, String(data.Answer), data.AbstractURL || '', 'DuckDuckGo')
  }
  if (data.Definition) {
    push(data.Heading || 'Définition', data.Definition, data.DefinitionURL, data.DefinitionSource || 'DuckDuckGo')
  }
  for (const t of data.RelatedTopics || []) {
    if (t.Text) {
      push(t.Text.split(' - ')[0], t.Text, t.FirstURL, 'DuckDuckGo')
    } else if (Array.isArray(t.Topics)) {
      for (const sub of t.Topics.slice(0, 4)) {
        push(sub.Text?.split(' - ')[0] || 'Résultat', sub.Text, sub.FirstURL, 'DuckDuckGo')
      }
    }
  }
  const seen = new Set()
  return items
    .filter((item) => {
      const key = item.url || item.title
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .slice(0, 8)
}

async function handleSearch(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    json(res, 405, { ok: false, error: 'Méthode non autorisée.' })
    return
  }
  let q = ''
  if (req.method === 'POST') {
    const body = await readBody(req)
    q = String(body.q || body.query || '').trim()
  } else {
    q = new URL(req.url || '/', 'http://local').searchParams.get('q') || ''
    q = q.trim()
  }
  if (!q) {
    json(res, 400, { ok: false, error: 'Requête vide.' })
    return
  }
  const searchedAt = new Date().toISOString()
  const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(q)}&format=json&no_redirect=1&no_html=1&skip_disambig=1`
  const ddg = await fetchWithTimeout(
    url,
    {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'NazixAssistant/1.0',
      },
    },
    SEARCH_TIMEOUT_MS,
  )
  if (!ddg.ok) {
    json(res, 200, {
      ok: false,
      mode: 'web',
      results: [],
      searchedAt,
      error: `DuckDuckGo ${ddg.status}`,
    })
    return
  }
  const data = await ddg.json()
  json(res, 200, {
    ok: true,
    mode: 'web',
    origin: 'web',
    query: q,
    results: collectDdgResults(data, q),
    searchedAt,
    sourceLabel: 'Web · DuckDuckGo Instant Answer',
  })
}

/** Returns a Promise if the path is an AI route, otherwise null (caller should next()). */
export function dispatchAiRequest(req, res, env = process.env, pathOverride) {
  const path = pathOverride ? normalizeApiPath(pathOverride) : requestPath(req)
  if (!isAiPath(path)) return null
  const run =
    path === '/api/ai/stream'
      ? handleAiStream(req, res, env)
      : path === '/api/ai'
        ? handleAi(req, res, env)
        : handleSearch(req, res)
  return Promise.resolve(run).catch((err) => {
    const status = err.status || 500
    const aborted = err?.name === 'AbortError'
    json(res, aborted ? 504 : status, {
      ok: false,
      mode: 'error',
      error: aborted ? 'délai dépassé (30 s)' : err.message || 'Erreur serveur IA.',
    })
  })
}

export function createNodeHandler(pathOverride) {
  return async function handler(req, res) {
    applyCors(req, res, process.env)
    if (req.method === 'OPTIONS') {
      res.statusCode = 204
      res.end()
      return
    }
    const handled = dispatchAiRequest(req, res, process.env, pathOverride)
    if (!handled) {
      json(res, 404, { ok: false, error: 'Route inconnue.' })
      return
    }
    await handled
  }
}
