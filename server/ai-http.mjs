/** Handlers Node (req/res) for POST /api/ai, /api/ai/stream, /api/ai/image and /api/ai-search.
 * Shared by Vite middleware, Firebase Cloud Functions and Vercel serverless.
 * Keys stay on the server (OPENAI_API_KEY | ANTHROPIC_API_KEY | GROK_API_KEY).
 * Never expose secrets to the client. Never prefix VITE_. */

import {
  createActionStreamStripper,
  displayAiContent,
  splitDisplayAndActions,
} from './ai-actions.mjs'
import {
  ensureSourceReply,
  isEncyclopedicQuery,
  resolveWebQuery,
  searchFailureMessage,
  userAskedForWeb,
} from './web-query.mjs'

const MAX_BODY = 256 * 1024
const LLM_TIMEOUT_MS = 30000
const SEARCH_TIMEOUT_MS = 10000
const SEARCH_UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 NazixSearch/1.0'
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

const AI_PATHS = new Set(['/api/ai', '/api/ai/stream', '/api/ai/image', '/api/ai-search', '/search'])

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
  const image = aiCandidates.find((p) => p === '/api/ai/image')
  if (image) return image
  const stream = aiCandidates.find((p) => p === '/api/ai/stream')
  if (stream) return stream
  const search = aiCandidates.find((p) => p === '/api/ai-search')
  if (search) return search
  if (aiCandidates[0]) return aiCandidates[0]
  return candidates[0] || normalizeApiPath('/')
}

function normalizeApiPath(path) {
  let p = stripTrailing(path)
  // Direct Cloud Function URL: …/ai/api/ai → /api/ai, …/ai/search → /search
  if (p.startsWith('/ai/')) p = p.slice(3) || '/'
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

const SYSTEM_PROMPT_FR = `Tu es Nazix, l’assistant conversationnel de l’espace de travail collaboratif Nazix.
Réponds en français, clairement, de façon utile et naturelle — comme un assistant ChatGPT, mais ancré dans Nazix.
Utilise uniquement le contexte fourni (notes, idées, projets, budget, risques, fichiers, calendrier auxquels l’utilisateur a accès).
Cite les titres entre « ». N’invente jamais de données privées absentes du contexte.
Si tu manques d’information : dis-le clairement (« je n’ai pas trouvé ») plutôt que de fabuler.
Distingue les faits Nazix des résultats web (libellé Web).
Ne propose jamais de supprimer, de partager, ni de modifier les droits d’accès.
Tu ne crées rien tout seul. Si une action est utile (créer ou mettre à jour une note, une tâche, un événement, un projet, ou une ligne budgétaire avec libellé, montant, type income ou expense, catégorie), décris-la en une ou deux phrases. Termine ensuite par UN seul bloc \`\`\`json {"actions":[{"kind":"create_budget_line","label":"...","draft":{"name":"...","amount":0,"flow":"expense","category":"Autres"}}]} \`\`\`. L’interface retire ce bloc et affiche un bouton. N’exécute jamais l’action. N’écris le JSON nulle part ailleurs.`

const SYSTEM_PROMPT_EN = `You are Nazix, the conversational assistant of the Nazix collaborative workspace.
Reply in English, clearly, usefully and naturally — like ChatGPT, but grounded in Nazix.
Use only the provided context (notes, ideas, projects, budget, risks, files, calendar the user can already read).
Quote titles in « ». Never invent private data missing from the context.
If you lack information: say so clearly (“I could not find that”) rather than guessing.
Distinguish Nazix facts from web results (label them Web).
Never propose deleting, sharing, or changing access rights.
You never create anything by yourself. If an action would help (create or update a note, task, event, project, or a budget line with label, amount, type income or expense, and category), describe it in one or two sentences. Then end with ONE \`\`\`json {"actions":[{"kind":"create_budget_line","label":"...","draft":{"name":"...","amount":0,"flow":"expense","category":"Autres"}}]} \`\`\` block. The UI strips that block and shows a confirm button. Never execute the action. Do not repeat the JSON in prose.`

export function resolveAiLang(body) {
  const raw = String(body?.language || body?.lang || '').toLowerCase()
  return raw.startsWith('en') ? 'en' : 'fr'
}

const WEB_OVERRIDE_FR = `La recherche web est activée. Tu PEUX et tu DOIS utiliser les sources publiques fournies pour répondre aux questions générales. Réponds dans la langue de l’utilisateur, à partir de ces sources, puis liste les liens sous ta réponse. Ne dis jamais que tu n’as pas accès à Internet lorsque la recherche web est activée.`

const WEB_OVERRIDE_EN = `Web search is enabled. You MAY and MUST use the public sources provided to answer general questions. Answer in the user's language from those sources, then list the links under your answer. Never say you have no internet access when web search is enabled.`

export function systemPromptFor(lang, opts = {}) {
  const en = resolveAiLang({ language: lang }) === 'en'
  let base = en ? SYSTEM_PROMPT_EN : SYSTEM_PROMPT_FR
  if (!opts.web) return base
  if (en) {
    base = base.replace(
      'Use only the provided context (notes, ideas, projects, budget, risks, files, calendar the user can already read).',
      'Use Nazix context for private workspace data. When public web sources are provided, you MAY and MUST answer from them.',
    )
    return `${base}\n${WEB_OVERRIDE_EN}`
  }
  base = base.replace(
    'Utilise uniquement le contexte fourni (notes, idées, projets, budget, risques, fichiers, calendrier auxquels l’utilisateur a accès).',
    'Utilise le contexte Nazix pour les données privées de l’espace. Lorsque des sources web publiques sont fournies, tu PEUX et tu DOIS t’en servir pour répondre.',
  )
  return `${base}\n${WEB_OVERRIDE_FR}`
}

const IMAGE_TIMEOUT_MS = 55000
const IMAGE_PROMPT_MAX = 4000

function formatWebContext(web, lang) {
  const results = Array.isArray(web?.results) ? web.results.filter((item) => item && (item.title || item.url)) : []
  const en = lang === 'en'
  if (!results.length) {
    return en
      ? 'Web search ran and returned no public source. Say that clearly. Do not claim you have no internet access.'
      : 'La recherche web a été exécutée et n’a renvoyé aucune source publique. Dis-le clairement. Ne prétends pas que tu n’as pas accès à Internet.'
  }
  const lines = results.slice(0, 6).map((item) => {
    const title = String(item.title || '').slice(0, 180)
    const url = String(item.url || '')
    const snippet = String(item.snippet || '').slice(0, 500)
    return `- ${title}\n  url: ${url}\n  extrait: ${snippet}`
  })
  const head = en
    ? 'Public web sources you MAY use (not private Nazix facts). Answer from them in the user\'s language and list the links:'
    : 'Sources web publiques que tu PEUX utiliser (ce ne sont pas des faits privés Nazix). Réponds à partir d’elles, dans la langue de l’utilisateur, et liste les liens :'
  return `${head}\n${lines.join('\n')}`.slice(0, 8000)
}

function toChatMessages(body, lang = 'fr') {
  const incoming = Array.isArray(body.messages) ? body.messages : []
  const mapped = incoming
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && m.content)
    .slice(-LAST_N)
    .map((m) => ({
      role: m.role,
      content: (m.role === 'assistant' ? displayAiContent(m.content) : String(m.content)).slice(0, 8000),
    }))
  const context = body.context && typeof body.context === 'object' ? body.context : {}
  const contextText = JSON.stringify(context).slice(0, 24000)
  const webOn = Boolean(body.webSearch || (body.web && typeof body.web === 'object'))
  const parts = []
  if (contextText && contextText !== '{}') {
    parts.push(`Contexte Nazix (uniquement des éléments déjà lisibles par l’utilisateur) :\n${contextText}`)
  }
  if (webOn) parts.push(formatWebContext(body.web, lang))
  if (parts.length) {
    const ack = webOn
      ? lang === 'en'
        ? 'I have the Nazix context and the public web sources. I may use those sources, answer in the user\'s language, and I will list the links.'
        : 'J’ai le contexte Nazix et les sources web publiques. Je peux m’en servir, répondre dans la langue de l’utilisateur, et je listerai les liens.'
      : 'J’ai bien le contexte. Je m’appuierai uniquement sur ces éléments, je citerai les titres, et je distinguerai le web le cas échéant.'
    mapped.unshift({
      role: 'user',
      content: parts.join('\n\n'),
    })
    mapped.splice(1, 0, {
      role: 'assistant',
      content: ack,
    })
  }
  return mapped
}

function publicApiMessage(errText = '') {
  const raw = String(errText || '')
  let message = raw
  try {
    const parsed = JSON.parse(raw)
    message = parsed?.error?.message || parsed?.message || raw
  } catch {
    /* plain text */
  }
  return String(message || '')
    .replace(/sk-[a-zA-Z0-9_-]+/g, '')
    .replace(/Bearer\s+\S+/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180)
}

function sanitizeLlmError(prefix, errText = '') {
  const clipped = publicApiMessage(errText)
  return clipped ? `${prefix} — ${clipped}` : prefix
}

function imageFailure(lang, status, errText) {
  const detail = publicApiMessage(errText)
  if (String(lang || '').startsWith('en')) {
    return detail
      ? `Image generation is unavailable (${status}). ${detail}`
      : `Image generation is unavailable (${status}). The rest of Create still works.`
  }
  return detail
    ? `La génération d’image est indisponible (${status}). ${detail}`
    : `La génération d’image est indisponible (${status}). Le reste de Création fonctionne.`
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

function openaiMessages(messages, lang = 'fr', web = false) {
  return [{ role: 'system', content: systemPromptFor(lang, { web }) }, ...messages]
}

async function callOpenAI(key, messages, req, lang = 'fr', web = false) {
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
        messages: openaiMessages(messages, lang, web),
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

async function callAnthropic(key, messages, req, lang = 'fr', web = false) {
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
        system: systemPromptFor(lang, { web }),
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

async function callGrok(key, messages, req, lang = 'fr', web = false) {
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
        messages: openaiMessages(messages, lang, web),
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

async function callLlm(provider, messages, req, lang = 'fr', web = false) {
  if (provider.name === 'openai') return callOpenAI(provider.key, messages, req, lang, web)
  if (provider.name === 'anthropic') return callAnthropic(provider.key, messages, req, lang, web)
  return callGrok(provider.key, messages, req, lang, web)
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

async function streamOpenAI(key, messages, req, res, lang = 'fr', web = false) {
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
        messages: openaiMessages(messages, lang, web),
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
  const stripper = createActionStreamStripper()
  let lastVisible = ''
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
        const { visible } = stripper.push(delta)
        if (visible.startsWith(lastVisible)) {
          const extra = visible.slice(lastVisible.length)
          if (extra) sseWrite(res, { delta: extra })
        } else {
          sseWrite(res, { content: visible })
        }
        lastVisible = visible
      }
    }
  }
  const finished = stripper.finish()
  if (finished.content.startsWith(lastVisible)) {
    const extra = finished.content.slice(lastVisible.length)
    if (extra) sseWrite(res, { delta: extra })
  } else if (finished.content !== lastVisible) {
    sseWrite(res, { content: finished.content })
  }
  sseWrite(res, {
    done: true,
    text: finished.content,
    content: finished.content,
    actions: finished.actions,
    provider: 'openai',
    ok: true,
  })
  res.end()
  return finished.content
}

function userTurns(body) {
  return (Array.isArray(body?.messages) ? body.messages : [])
    .filter((m) => m && m.role === 'user' && m.content)
    .map((m) => String(m.content))
}

function shouldSearchWeb(body) {
  if (body?.webSearch === true || body?.searchWeb === true) return true
  if (body?.web && typeof body.web === 'object') return true
  return userTurns(body).some((text) => userAskedForWeb(text))
}

function clientWebResults(body) {
  const results = Array.isArray(body?.web?.results) ? body.web.results : []
  return results.filter((item) => item && (item.url || item.title))
}

async function prepareChatBody(body) {
  const lang = resolveAiLang(body)
  if (!shouldSearchWeb(body)) return { body, lang, web: null }
  const turns = userTurns(body)
  const latest = turns[turns.length - 1] || String(body?.q || body?.query || '')
  const query = resolveWebQuery(latest, turns.slice(0, -1))
  const searchedAt = new Date().toISOString()
  if (!query) {
    const web = { enabled: true, ok: true, query: '', results: [], searchedAt, sourceLabel: 'Web' }
    return { body: { ...body, web, webSearch: true }, lang, web }
  }
  try {
    const results = await webSearchResults(query, { lang })
    const web = { enabled: true, ok: true, query, results, searchedAt, sourceLabel: 'Web' }
    return { body: { ...body, web, webSearch: true }, lang, web }
  } catch (err) {
    const fallback = clientWebResults(body)
    console.error(`[ai-search] status=${Number(err?.status || 0)} host=${err?.host || 'unknown'}`)
    if (fallback.length) {
      const web = {
        enabled: true,
        ok: true,
        query,
        results: fallback,
        searchedAt: body.web?.searchedAt || searchedAt,
        sourceLabel: 'Web',
      }
      return { body: { ...body, web, webSearch: true }, lang, web }
    }
    const error = new Error(searchFailureMessage(lang, err))
    error.status = Number(err?.status || 0)
    error.host = err?.host || ''
    error.searchError = true
    throw error
  }
}

function replySearchError(res, err, started) {
  const payload = { ok: false, error: err.message || searchFailureMessage('fr', err), searchError: true }
  if (!started) {
    json(res, 200, payload)
    return
  }
  try {
    sseWrite(res, payload)
    res.end()
  } catch {
    /* headers may already be closed */
  }
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
  let prepared
  try {
    prepared = await prepareChatBody(body)
  } catch (err) {
    if (err?.searchError) {
      replySearchError(res, err, false)
      return
    }
    throw err
  }
  const { lang, web } = prepared
  const messages = toChatMessages(prepared.body, lang)
  const raw = await callLlm(provider, messages, req, lang, Boolean(web))
  const split = splitDisplayAndActions(raw)
  const content = ensureSourceReply(split.content, web?.results, lang)
  json(res, 200, {
    ok: true,
    mode: 'external',
    provider: provider.name,
    text: content,
    content,
    actions: split.actions,
    web: web || undefined,
  })
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
  let prepared
  try {
    prepared = await prepareChatBody(body)
  } catch (err) {
    if (err?.searchError) {
      replySearchError(res, err, false)
      return
    }
    throw err
  }
  const { lang, web } = prepared
  const messages = toChatMessages(prepared.body, lang)
  const webOn = Boolean(web)
  startSse(res)
  try {
    if (web?.results?.length) {
      const raw = await callLlm(provider, messages, req, lang, true)
      const split = splitDisplayAndActions(raw)
      const content = ensureSourceReply(split.content, web.results, lang)
      if (content) sseWrite(res, { delta: content })
      sseWrite(res, {
        done: true,
        text: content,
        content,
        actions: split.actions,
        provider: provider.name,
        web,
        replace: true,
        ok: true,
      })
      res.end()
      return
    }
    if (provider.name === 'openai') {
      await streamOpenAI(provider.key, messages, req, res, lang, webOn)
      return
    }
    const raw = await callLlm(provider, messages, req, lang, webOn)
    const { content, actions } = splitDisplayAndActions(raw)
    if (content) sseWrite(res, { delta: content })
    sseWrite(res, {
      done: true,
      text: content,
      content,
      actions,
      provider: provider.name,
      web: web || undefined,
      ok: true,
    })
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

function decodeHtml(text) {
  return String(text || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, ' ')
    .trim()
}

function decodeDdgHref(href) {
  const raw = String(href || '')
    .trim()
    .replace(/&amp;/g, '&')
  if (!raw) return ''
  try {
    const u = new URL(raw, 'https://duckduckgo.com')
    const uddg = u.searchParams.get('uddg')
    if (uddg) return uddg
    return u.href
  } catch {
    return raw
  }
}

function uniqueResults(items, q, limit = 8) {
  const seen = new Set()
  const out = []
  for (const item of items) {
    const title = decodeHtml(item.title || q)
    const snippet = decodeHtml(item.snippet || '')
    const url = String(item.url || '').trim()
    if (!title && !snippet) continue
    const key = url || title.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push({
      title: title || q,
      snippet: snippet.slice(0, 400),
      url,
      source: item.source || 'DuckDuckGo',
      origin: 'web',
    })
    if (out.length >= limit) break
  }
  return out
}

function collectDdgResults(data, q) {
  const items = []
  const push = (title, snippet, url, source) => {
    items.push({ title, snippet, url, source: source || 'DuckDuckGo' })
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
  return uniqueResults(items, q)
}

function parseDdgHtml(html, q) {
  const items = []
  const snippets = []
  const snippetRe = /<(?:a|span|td)[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/(?:a|span|td)>/gi
  let sn
  while ((sn = snippetRe.exec(html))) snippets.push(decodeHtml(sn[1]))
  const linkRe = /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi
  let m
  let i = 0
  while ((m = linkRe.exec(html))) {
    items.push({
      title: decodeHtml(m[2]),
      url: decodeDdgHref(m[1]),
      snippet: snippets[i++] || '',
      source: 'DuckDuckGo',
    })
  }
  if (!items.length) {
    const liteRe = /<a[^>]*rel="nofollow"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi
    while ((m = liteRe.exec(html))) {
      const url = decodeDdgHref(m[1])
      if (!url || /duckduckgo\.com/i.test(url)) continue
      items.push({ title: decodeHtml(m[2]), url, snippet: '', source: 'DuckDuckGo' })
    }
  }
  return uniqueResults(items, q)
}

function searchQueryFromReq(req, body = {}) {
  const fromQuery = firstQueryValue(req.query?.q || req.query?.query)
  if (fromQuery) return String(fromQuery).trim()
  try {
    const u = new URL(req.url || '/', 'http://local')
    const q = u.searchParams.get('q') || u.searchParams.get('query') || ''
    if (q) return q.trim()
  } catch {
    /* ignore */
  }
  return String(body.q || body.query || '').trim()
}

// MODULES-LAYER START
function assertApprovedSearchUrl(url) {
  let host = ''
  try {
    host = new URL(url).hostname.toLowerCase()
  } catch {
    throw new Error('Source de recherche non autorisée.')
  }
  if (
    host === 'google.com' ||
    host.endsWith('.google.com') ||
    host.includes('google.') ||
    host === 'instagram.com' ||
    host.endsWith('.instagram.com')
  ) {
    throw new Error('Source de recherche non autorisée.')
  }
  const ok =
    host === 'duckduckgo.com' ||
    host.endsWith('.duckduckgo.com') ||
    host === 'wikipedia.org' ||
    host.endsWith('.wikipedia.org')
  if (!ok) throw new Error('Source de recherche non autorisée.')
  return url
}
// MODULES-LAYER END

const WIKI_UA = 'NazixSearch/1.0 (Nazix workspace; +https://github.com/faculta-PL/xxdashboard)'

function searchHost(url) {
  try {
    return new URL(url).host
  } catch {
    return ''
  }
}

function noteSearchFailure(bag, status, url) {
  const host = searchHost(url)
  console.error(`[ai-search] status=${Number(status || 0)} host=${host || 'unknown'}`)
  bag.failures.push({ status: Number(status || 0), host })
}

async function fetchApproved(url, options, bag) {
  assertApprovedSearchUrl(url)
  let res
  try {
    res = await fetchWithTimeout(url, options, SEARCH_TIMEOUT_MS)
  } catch {
    noteSearchFailure(bag, 0, url)
    return null
  }
  if (!res.ok) {
    noteSearchFailure(bag, res.status, url)
    return null
  }
  bag.ok += 1
  return res
}

async function fetchDdgInstant(q, bag) {
  const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(q)}&format=json&no_redirect=1&no_html=1&skip_disambig=1`
  const ddg = await fetchApproved(
    url,
    { headers: { Accept: 'application/json', 'User-Agent': SEARCH_UA } },
    bag,
  )
  if (!ddg) return []
  const data = await ddg.json().catch(() => ({}))
  return collectDdgResults(data || {}, q)
}

async function fetchDdgHtml(q, bag) {
  const headers = {
    'User-Agent': SEARCH_UA,
    Accept: 'text/html,application/xhtml+xml',
  }
  const attempts = [
    { url: `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`, method: 'GET', headers },
    {
      url: 'https://html.duckduckgo.com/html/',
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `q=${encodeURIComponent(q)}&kl=wt-wt`,
    },
    { url: `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(q)}`, method: 'GET', headers },
  ]
  for (const att of attempts) {
    const res = await fetchApproved(
      att.url,
      { method: att.method, headers: att.headers, body: att.body, redirect: 'follow' },
      bag,
    )
    if (!res) continue
    const html = await res.text()
    const items = parseDdgHtml(html, q)
    if (items.length) return items
  }
  return []
}

function wikiTitleUrl(lang, title) {
  const slug = String(title || '').trim().replace(/ /g, '_')
  if (!slug) return ''
  return `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(slug)}`
}

function clipSnippet(text, n = 420) {
  const s = decodeHtml(text)
  if (s.length <= n) return s
  const cut = s.slice(0, n)
  const sp = cut.lastIndexOf(' ')
  return `${(sp > 80 ? cut.slice(0, sp) : cut).trim()}…`
}

async function fetchWikiLang(lang, q, bag) {
  const headers = { Accept: 'application/json', 'User-Agent': WIKI_UA }
  const items = []
  const openUrl = `https://${lang}.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(q)}&limit=5&namespace=0&format=json&origin=*`
  const opened = await fetchApproved(openUrl, { headers }, bag)
  if (opened) {
    const data = await opened.json().catch(() => [])
    const titles = data[1] || []
    const descs = data[2] || []
    const urls = data[3] || []
    for (let i = 0; i < titles.length; i += 1) {
      items.push({
        title: titles[i],
        snippet: descs[i] || '',
        url: urls[i] || wikiTitleUrl(lang, titles[i]),
        source: 'Wikipedia',
      })
    }
  }
  if (!items.length) {
    const listUrl = `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q)}&srlimit=5&utf8=1&format=json&origin=*`
    const listed = await fetchApproved(listUrl, { headers }, bag)
    if (listed) {
      const data = await listed.json().catch(() => ({}))
      for (const hit of data?.query?.search || []) {
        const title = hit?.title || ''
        if (!title) continue
        items.push({
          title,
          snippet: clipSnippet(hit.snippet || ''),
          url: wikiTitleUrl(lang, title),
          source: 'Wikipedia',
        })
      }
    }
  }
  const top = items[0]
  if (top?.title && String(top.snippet || '').trim().length < 80) {
    const exUrl = `https://${lang}.wikipedia.org/w/api.php?action=query&prop=extracts&exintro=1&explaintext=1&redirects=1&titles=${encodeURIComponent(top.title)}&format=json&origin=*`
    const extracted = await fetchApproved(exUrl, { headers }, bag)
    if (extracted) {
      const data = await extracted.json().catch(() => ({}))
      const pages = Object.values(data?.query?.pages || {})
      const page = pages.find((p) => p && p.extract && !p.missing) || null
      if (page?.extract) {
        top.snippet = clipSnippet(page.extract)
        if (page.title) {
          top.title = page.title
          top.url = wikiTitleUrl(lang, page.title)
        }
      }
    }
  }
  return items
}

async function fetchWiki(q, bag) {
  let items = []
  for (const lang of ['fr', 'en']) {
    const found = await fetchWikiLang(lang, q, bag)
    if (found.length) {
      items = found
      break
    }
  }
  return uniqueResults(items, q)
}

function publicResult(item) {
  return {
    title: item.title,
    url: item.url,
    snippet: item.snippet,
    source: item.source || (String(item.url || '').includes('wikipedia.org') ? 'Wikipedia' : 'Web'),
  }
}

export async function webSearchResults(q, opts = {}) {
  const raw = String(q || '').trim()
  const query = String(opts.query || resolveWebQuery(raw, opts.prior || []) || raw).trim()
  if (!query) return []
  const encyclopedic = isEncyclopedicQuery(raw) || isEncyclopedicQuery(query)
  const bag = { ok: 0, failures: [] }
  const lang = opts.lang === 'en' ? 'en' : 'fr'
  const wiki = await fetchWiki(query, bag)
  let instant = []
  if (!encyclopedic || !wiki.length) instant = await fetchDdgInstant(query, bag)
  let items = uniqueResults(encyclopedic ? [...wiki, ...instant] : [...instant, ...wiki], query, 8)
  if (!items.length) {
    const html = await fetchDdgHtml(query, bag)
    items = uniqueResults([...wiki, ...instant, ...html], query, 8)
  }
  if (!items.length && query !== raw) {
    const wikiRaw = await fetchWiki(raw, bag)
    items = uniqueResults(wikiRaw, raw, 8)
  }
  if (!items.length && !bag.ok && bag.failures.length) {
    const last = bag.failures[bag.failures.length - 1]
    const err = new Error(searchFailureMessage(lang, last))
    err.status = last.status
    err.host = last.host
    err.searchError = true
    throw err
  }
  return items.map(publicResult)
}

async function handleSearch(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    json(res, 405, { ok: false, error: 'Méthode non autorisée.' })
    return
  }
  let body = {}
  if (req.method === 'POST') body = await readBody(req)
  // MODULES-LAYER START
  if (body && typeof body === 'object') {
    delete body.apiKey
    delete body.api_key
    delete body.key
    delete body.token
    delete body.authorization
    delete body.secret
  }
  // MODULES-LAYER END
  const raw = searchQueryFromReq(req, body)
  const lang = resolveAiLang(body)
  const q = resolveWebQuery(raw)
  const searchedAt = new Date().toISOString()
  if (!q) {
    json(res, 200, {
      ok: true,
      mode: 'web',
      origin: 'web',
      query: '',
      results: [],
      searchedAt,
    })
    return
  }
  try {
    const results = await webSearchResults(q, { lang, query: q })
    json(res, 200, {
      ok: true,
      mode: 'web',
      origin: 'web',
      query: q,
      results,
      searchedAt,
      sourceLabel: 'Web',
    })
  } catch (err) {
    console.error(`[ai-search] status=${Number(err?.status || 0)} host=${err?.host || 'unknown'}`)
    json(res, 502, {
      ok: false,
      searchError: true,
      error: err.searchError ? err.message : searchFailureMessage(lang, err),
      status: Number(err?.status || 0),
    })
  }
}

async function tryImageModel(key, prompt, model, req) {
  const payload =
    model === 'gpt-image-1'
      ? { model, prompt, size: '1024x1024', output_format: 'png' }
      : { model, prompt, n: 1, size: '1024x1024', response_format: 'b64_json' }
  const resImg = await fetchWithTimeout(
    'https://api.openai.com/v1/images/generations',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    },
    IMAGE_TIMEOUT_MS,
    req,
  )
  const data = await resImg.json().catch(() => ({}))
  if (!resImg.ok) {
    throw Object.assign(new Error(imageFailure('fr', resImg.status, JSON.stringify(data).slice(0, 500))), {
      status: resImg.status,
      detail: publicApiMessage(JSON.stringify(data).slice(0, 500)),
    })
  }
  return data
}

async function handleImage(req, res, env) {
  if (req.method === 'GET') {
    json(res, 200, { ...statusPayload(env), image: Boolean(env.OPENAI_API_KEY) })
    return
  }
  if (req.method !== 'POST') {
    json(res, 405, { ok: false, error: 'Méthode non autorisée.' })
    return
  }
  const body = await readBody(req)
  const lang = resolveAiLang(body)
  const key = env.OPENAI_API_KEY
  if (!key) {
    json(res, 200, {
      ok: false,
      hasKey: false,
      error: lang === 'en'
        ? 'Image generation is not configured on the server. No key is stored in the browser.'
        : 'La génération d’image n’est pas configurée sur le serveur. Aucune clé n’est stockée dans le navigateur.',
    })
    return
  }
  const prompt = String(body.prompt || body.text || '').trim()
  if (!prompt) {
    json(res, 400, { ok: false, error: lang === 'en' ? 'A prompt is required.' : 'Prompt requis.' })
    return
  }
  if (prompt.length > IMAGE_PROMPT_MAX) {
    json(res, 400, { ok: false, error: lang === 'en' ? 'Prompt is too long.' : 'Prompt trop long.' })
    return
  }
  let data
  let modelUsed = 'gpt-image-1'
  let firstError = null
  try {
    data = await tryImageModel(key, prompt, 'gpt-image-1', req)
  } catch (err) {
    firstError = err
    modelUsed = 'dall-e-3'
    try {
      data = await tryImageModel(key, prompt, 'dall-e-3', req)
    } catch (err2) {
      json(res, 200, { ok: false, error: imageFailure(lang, err2.status || err.status || 502, err2.detail || err2.message || firstError?.message || '') })
      return
    }
  }
  const item = data?.data?.[0] || {}
  let b64 = item.b64_json || ''
  let url = item.url || ''
  let mime = 'image/png'
  if (!b64 && url) {
    try {
      const imgRes = await fetchWithTimeout(url, {}, IMAGE_TIMEOUT_MS, req)
      if (imgRes.ok) {
        const buf = Buffer.from(await imgRes.arrayBuffer())
        const ct = String(imgRes.headers.get('content-type') || 'image/png').split(';')[0]
        mime = ct || 'image/png'
        b64 = buf.toString('base64')
        url = ''
      }
    } catch {
      /* keep remote url */
    }
  }
  if (!b64 && !url) {
    json(res, 200, {
      ok: false,
      error: lang === 'en' ? 'The image service returned an empty file. The rest of Create still works.' : 'Le service d’image a renvoyé un fichier vide. Le reste de Création fonctionne.',
    })
    return
  }
  json(res, 200, {
    ok: true,
    model: modelUsed,
    mime,
    b64: b64 || undefined,
    url: url || undefined,
  })
}

/** Returns a Promise if the path is an AI route, otherwise null (caller should next()). */
// Synced with src/platform/plans.js — launch mode never paywalls this route.
const LAUNCH_FREE_MODE = true

export function dispatchAiRequest(req, res, env = process.env, pathOverride) {
  if (LAUNCH_FREE_MODE !== true) {
    json(res, 402, { ok: false, error: 'Plan requis.' })
    return Promise.resolve()
  }
  const path = pathOverride ? normalizeApiPath(pathOverride) : requestPath(req)
  if (!isAiPath(path)) return null
  const run =
    path === '/api/ai/image'
      ? handleImage(req, res, env)
      : path === '/api/ai/stream'
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
