/** Handlers Node (req/res) for POST /api/ai, /api/ai/stream, /api/ai/image and /api/ai-search.
 * Shared by Vite middleware, Firebase Cloud Functions and Vercel serverless.
 * Keys stay on the server (OPENAI_API_KEY | ANTHROPIC_API_KEY | GROK_API_KEY).
 * Never expose secrets to the client. Never prefix VITE_. */

import {
  createActionStreamStripper,
  displayAiContent,
  splitDisplayAndActions,
} from './ai-actions.mjs'

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
Tu ne crées rien tout seul : si une création est utile (note, sous-note, idée, risque, ligne budgétaire, brouillon de message), décris-la en une ou deux phrases en français. L’interface affichera un bouton de confirmation. N’exécute jamais l’action.

INTERDICTION ABSOLUE : n’inclus JAMAIS de JSON, de bloc \`\`\`json, de {"kind":...}, de function-call, ni d’appel d’outil dans ta réponse. Pas de payload, pas de code. Uniquement du texte français visible par l’utilisateur.`

const SYSTEM_PROMPT_EN = `You are Nazix, the conversational assistant of the Nazix collaborative workspace.
Reply in English, clearly, usefully and naturally — like ChatGPT, but grounded in Nazix.
Use only the provided context (notes, ideas, projects, budget, risks, files, calendar the user can already read).
Quote titles in « ». Never invent private data missing from the context.
If you lack information: say so clearly (“I could not find that”) rather than guessing.
Distinguish Nazix facts from web results (label them Web).
Never propose deleting, sharing, or changing access rights.
You never create anything by yourself: if a creation would help (note, sub-note, idea, risk, budget line, message draft), describe it in one or two English sentences. The UI will show a confirmation button. Never execute the action.

ABSOLUTE BAN: never include JSON, a \`\`\`json block, {"kind":...}, a function-call, or a tool call in your reply. No payload, no code. Visible English text only.`

export function resolveAiLang(body) {
  const raw = String(body?.language || body?.lang || '').toLowerCase()
  return raw.startsWith('en') ? 'en' : 'fr'
}

export function systemPromptFor(lang) {
  return resolveAiLang({ language: lang }) === 'en' ? SYSTEM_PROMPT_EN : SYSTEM_PROMPT_FR
}

const IMAGE_TIMEOUT_MS = 55000
const IMAGE_PROMPT_MAX = 4000

function toChatMessages(body) {
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

function openaiMessages(messages, lang = 'fr') {
  return [{ role: 'system', content: systemPromptFor(lang) }, ...messages]
}

async function callOpenAI(key, messages, req, lang = 'fr') {
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
        messages: openaiMessages(messages, lang),
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

async function callAnthropic(key, messages, req, lang = 'fr') {
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
        system: systemPromptFor(lang),
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

async function callGrok(key, messages, req, lang = 'fr') {
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
        messages: openaiMessages(messages, lang),
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

async function callLlm(provider, messages, req, lang = 'fr') {
  if (provider.name === 'openai') return callOpenAI(provider.key, messages, req, lang)
  if (provider.name === 'anthropic') return callAnthropic(provider.key, messages, req, lang)
  return callGrok(provider.key, messages, req, lang)
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

async function streamOpenAI(key, messages, req, res, lang = 'fr') {
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
        messages: openaiMessages(messages, lang),
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
  const lang = resolveAiLang(body)
  const messages = toChatMessages(body)
  const raw = await callLlm(provider, messages, req, lang)
  const { content, actions } = splitDisplayAndActions(raw)
  json(res, 200, {
    ok: true,
    mode: 'external',
    provider: provider.name,
    text: content,
    content,
    actions,
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
  const lang = resolveAiLang(body)
  const messages = toChatMessages(body)
  startSse(res)
  try {
    if (provider.name === 'openai') {
      await streamOpenAI(provider.key, messages, req, res, lang)
      return
    }
    const raw = await callLlm(provider, messages, req, lang)
    const { content, actions } = splitDisplayAndActions(raw)
    if (content) sseWrite(res, { delta: content })
    sseWrite(res, {
      done: true,
      text: content,
      content,
      actions,
      provider: provider.name,
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

async function fetchDdgInstant(q) {
  const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(q)}&format=json&no_redirect=1&no_html=1&skip_disambig=1`
  const ddg = await fetchWithTimeout(
    url,
    { headers: { Accept: 'application/json', 'User-Agent': SEARCH_UA } },
    SEARCH_TIMEOUT_MS,
  )
  if (!ddg.ok) return []
  const data = await ddg.json().catch(() => ({}))
  return collectDdgResults(data || {}, q)
}

async function fetchDdgHtml(q) {
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
    try {
      const res = await fetchWithTimeout(
        att.url,
        { method: att.method, headers: att.headers, body: att.body, redirect: 'follow' },
        SEARCH_TIMEOUT_MS,
      )
      if (!res.ok) continue
      const html = await res.text()
      const items = parseDdgHtml(html, q)
      if (items.length) return items
    } catch {
      /* try next source */
    }
  }
  return []
}

async function fetchWiki(q) {
  const items = []
  for (const lang of ['fr', 'en']) {
    try {
      const url = `https://${lang}.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(q)}&limit=8&namespace=0&format=json`
      const res = await fetchWithTimeout(
        url,
        { headers: { Accept: 'application/json', 'User-Agent': SEARCH_UA } },
        SEARCH_TIMEOUT_MS,
      )
      if (!res.ok) continue
      const data = await res.json().catch(() => [])
      const titles = data[1] || []
      const descs = data[2] || []
      const urls = data[3] || []
      for (let i = 0; i < titles.length; i++) {
        items.push({
          title: titles[i],
          snippet: descs[i] || '',
          url: urls[i] || '',
          source: 'Wikipedia',
        })
      }
      if (items.length) break
    } catch {
      /* next language */
    }
  }
  return uniqueResults(items, q)
}

async function webSearchResults(q) {
  try {
    const instant = await fetchDdgInstant(q)
    if (instant.length) return instant
  } catch {
    /* fallback */
  }
  const [html, wiki] = await Promise.all([
    fetchDdgHtml(q).catch(() => []),
    fetchWiki(q).catch(() => []),
  ])
  return uniqueResults([...html, ...wiki], q)
}

async function handleSearch(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    json(res, 405, { ok: false, error: 'Méthode non autorisée.' })
    return
  }
  let body = {}
  if (req.method === 'POST') body = await readBody(req)
  const q = searchQueryFromReq(req, body)
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
  const results = await webSearchResults(q)
  json(res, 200, {
    ok: true,
    mode: 'web',
    origin: 'web',
    query: q,
    results,
    searchedAt,
    sourceLabel: 'Web',
  })
}

async function tryImageModel(key, prompt, model, req) {
  const payload = {
    model,
    prompt,
    n: 1,
    size: '1024x1024',
  }
  if (model === 'dall-e-3') payload.response_format = 'b64_json'
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
    throw Object.assign(new Error(sanitizeLlmError(`OpenAI images ${resImg.status}`, JSON.stringify(data).slice(0, 160))), {
      status: resImg.status,
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
  const key = env.OPENAI_API_KEY
  if (!key) {
    json(res, 200, { ok: false, hasKey: false, error: 'OPENAI_API_KEY manquante' })
    return
  }
  const body = await readBody(req)
  const prompt = String(body.prompt || body.text || '').trim()
  if (!prompt) {
    json(res, 400, { ok: false, error: 'Prompt requis.' })
    return
  }
  if (prompt.length > IMAGE_PROMPT_MAX) {
    json(res, 400, { ok: false, error: 'Prompt trop long.' })
    return
  }
  let data
  let modelUsed = 'gpt-image-1'
  try {
    data = await tryImageModel(key, prompt, 'gpt-image-1', req)
  } catch {
    modelUsed = 'dall-e-3'
    data = await tryImageModel(key, prompt, 'dall-e-3', req)
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
    json(res, 502, { ok: false, error: 'Image vide.' })
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
export function dispatchAiRequest(req, res, env = process.env, pathOverride) {
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
