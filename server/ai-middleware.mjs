/** Vite connect middleware for POST /api/ai and POST /api/ai-search.
 * Keys stay on the server (OPENAI_API_KEY | ANTHROPIC_API_KEY | GROK_API_KEY).
 * Never expose secrets to the client. */

const MAX_BODY = 256 * 1024
const LLM_TIMEOUT_MS = 25000
const SEARCH_TIMEOUT_MS = 8000

function json(res, status, body) {
  const payload = JSON.stringify(body)
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(payload)
}

function readBody(req) {
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

function pathname(req) {
  try {
    return new URL(req.url || '/', 'http://local').pathname.replace(/\/+$/, '') || '/'
  } catch {
    return String(req.url || '').split('?')[0]
  }
}

function detectProvider(env) {
  if (env.OPENAI_API_KEY) return { name: 'openai', key: env.OPENAI_API_KEY }
  if (env.ANTHROPIC_API_KEY) return { name: 'anthropic', key: env.ANTHROPIC_API_KEY }
  if (env.GROK_API_KEY) return { name: 'grok', key: env.GROK_API_KEY }
  return null
}

function statusPayload(env) {
  const provider = detectProvider(env)
  if (!provider) return { mode: 'local', ok: false, hasKey: false }
  return { mode: 'ready', ok: true, hasKey: true, provider: provider.name }
}

const SYSTEM_PROMPT = `Tu es l’assistant Nazix, un espace de travail collaboratif (notes, idées, projets, budget, risques, fichiers, calendrier).
Réponds en français, de façon structurée et concise.
N’utilise que le contexte fourni : ne fabule pas. Cite les titres des notes / entités entre « ».
Distingue clairement les faits Nazix des résultats web.
Ne propose jamais de supprimer, de partager, ni de modifier les droits d’accès.
Tu peux proposer des actions de création (note, sous-note, idée, risque, ligne budgétaire, brouillon de message) sous forme de boutons mentaux — l’humain confirmera.
Si tu manques d’information : dis « je n’ai pas trouvé ».`

function toChatMessages(body) {
  const incoming = Array.isArray(body.messages) ? body.messages : []
  const mapped = incoming
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && m.content)
    .slice(-16)
    .map((m) => ({
      role: m.role,
      content: String(m.content).slice(0, 8000),
    }))
  const context = body.context && typeof body.context === 'object' ? body.context : {}
  const contextText = JSON.stringify(context).slice(0, 24000)
  if (contextText && contextText !== '{}') {
    mapped.unshift({
      role: 'user',
      content: `Contexte Nazix (uniquement des éléments déjà lisibles par l’utilisateur) :\n${contextText}`,
    })
    mapped.splice(1, 0, {
      role: 'assistant',
      content: 'J’ai bien le contexte. Je m’appuierai uniquement sur ces éléments et je citerai les titres.',
    })
  }
  return mapped
}

async function fetchWithTimeout(url, options, ms) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), ms)
  try {
    return await fetch(url, { ...options, signal: ctrl.signal })
  } finally {
    clearTimeout(timer)
  }
}

async function callOpenAI(key, messages) {
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
        temperature: 0.3,
        max_tokens: 1200,
        messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
      }),
    },
    LLM_TIMEOUT_MS,
  )
  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`OpenAI ${res.status}${errText ? ` — ${errText.slice(0, 180)}` : ''}`)
  }
  const data = await res.json()
  const text = data?.choices?.[0]?.message?.content
  if (!text) throw new Error('Réponse OpenAI vide.')
  return String(text)
}

async function callAnthropic(key, messages) {
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
        max_tokens: 1200,
        system: SYSTEM_PROMPT,
        messages,
      }),
    },
    LLM_TIMEOUT_MS,
  )
  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`Anthropic ${res.status}${errText ? ` — ${errText.slice(0, 180)}` : ''}`)
  }
  const data = await res.json()
  const text = (data?.content || []).map((c) => c.text || '').join('\n').trim()
  if (!text) throw new Error('Réponse Anthropic vide.')
  return text
}

async function callGrok(key, messages) {
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
        temperature: 0.3,
        max_tokens: 1200,
        messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
      }),
    },
    LLM_TIMEOUT_MS,
  )
  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`Grok ${res.status}${errText ? ` — ${errText.slice(0, 180)}` : ''}`)
  }
  const data = await res.json()
  const text = data?.choices?.[0]?.message?.content
  if (!text) throw new Error('Réponse Grok vide.')
  return String(text)
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
    json(res, 200, { mode: 'local', ok: false, hasKey: false })
    return
  }
  const body = await readBody(req)
  if (!body.allowExternal) {
    json(res, 200, { mode: 'local', ok: false, hasKey: true, reason: 'external_not_allowed' })
    return
  }
  const messages = toChatMessages(body)
  let text
  if (provider.name === 'openai') text = await callOpenAI(provider.key, messages)
  else if (provider.name === 'anthropic') text = await callAnthropic(provider.key, messages)
  else text = await callGrok(provider.key, messages)
  json(res, 200, { ok: true, mode: 'external', provider: provider.name, text })
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
  return items.filter((item) => {
    const key = item.url || item.title
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }).slice(0, 8)
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

export function attachAiMiddleware(server, env = process.env) {
  server.middlewares.use((req, res, next) => {
    const path = pathname(req)
    if (path !== '/api/ai' && path !== '/api/ai-search') {
      next()
      return
    }
    const run = path === '/api/ai' ? handleAi(req, res, env) : handleSearch(req, res)
    Promise.resolve(run).catch((err) => {
      const status = err.status || 500
      json(res, status, {
        ok: false,
        mode: 'local',
        error: err.message || 'Erreur serveur IA.',
      })
    })
  })
}

export function nazixAiPlugin(env) {
  const attach = (server) => attachAiMiddleware(server, env || process.env)
  return {
    name: 'nazix-ai-api',
    configureServer: attach,
    configurePreviewServer: attach,
  }
}
