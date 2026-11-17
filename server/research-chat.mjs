/** Research-chat shaping. Pure: no network, no secrets, no workspace dump. */

import { isBareInternetAsk } from './web-query.mjs'

const STRONG_DICTATION =
  /let'?s see|it started writing|ultra sync|okay please|oh it started|started writing already/i

const FILLERS = new Set([
  'okay',
  'ok',
  'lets',
  'let',
  'see',
  'oh',
  'uh',
  'um',
  'already',
  'please',
  'started',
  'writing',
  'yeah',
  'like',
  'just',
  'actually',
  'wait',
  'hold',
  'gonna',
  'wanna',
  'alright',
  'right',
])

const GREETING =
  /^(?:salut|bonjour|bonsoir|hello|hi|hey|coucou)(?:\s+nazix)?(?:[,!\s]+(?:nazix|ça va|ca va|comment (?:ça|ca) va|how are you))*[\s?!.]*$/i

const MODE_SWITCH =
  /^(?:plus court|plus d[ée]taill[ée]e?|liste|shorter|more detail|list)[\s!.]*$/i

const AMBIGUOUS =
  /^(?:explique|explain|compare|d[ée]taille|dis[- ]moi|tell me|and|et\s+(?:ça|ca|celui-ci|celui-là|celui|celle|lui|elle)|what about(?: this)?|compare this)[\s?!.]*$/i

const WORKSPACE =
  /budget|restant|risque|retard|\bnotes?\b|fichier|calendrier|[ée]v[ée]nement|projet|id[ée]e|r[ée]sum|synth[eè]se|t[âa]che|\bnazix\b|espace|workspace|message|d[ée]pense|ligne/i

const HEADING_DEFS = [
  ['short', /^(?:réponse courte|short answer)\s*:?\s*$/i],
  ['analysis', /^(?:analyse|analysis)\s*:?\s*$/i],
  ['takeaways', /^(?:points à retenir|takeaways)\s*:?\s*$/i],
  ['limits', /^(?:limites|limits)\s*:?\s*$/i],
  ['sources', /^sources?\s*:?\s*$/i],
]

const LEAK_LINE =
  /^(?:nazix\s*:|sources nazix\b|contexte\s*:|tu es nazix\b|you are nazix\b|openai_api_key\b|j['’]ai (?:bien )?le contexte\b|i have the (?:private )?workspace\b)/i

export function headingsFor(lang = 'fr') {
  const en = String(lang || '').toLowerCase().startsWith('en')
  return en
    ? {
        short: 'Short answer',
        analysis: 'Analysis',
        takeaways: 'Takeaways',
        limits: 'Limits',
        sources: 'Sources',
      }
    : {
        short: 'Réponse courte',
        analysis: 'Analyse',
        takeaways: 'Points à retenir',
        limits: 'Limites',
        sources: 'Sources',
      }
}

export function researchModeOf(value) {
  const raw = String(value || '').toLowerCase()
  return raw === 'deep' || raw === 'detailed' || raw === 'approfondie' ? 'deep' : 'quick'
}

export function isDictationGarbage(text) {
  const raw = String(text || '').trim()
  if (!raw) return false
  if (STRONG_DICTATION.test(raw)) return true
  const words = raw
    .toLowerCase()
    .replace(/[^a-zàâçéèêëîïôùûüœ'\s-]/gi, ' ')
    .split(/\s+/)
    .filter(Boolean)
  if (words.length < 8) return false
  let fillers = 0
  for (const word of words) {
    const normalized = word.replace(/'/g, '')
    if (FILLERS.has(normalized)) fillers += 1
  }
  return fillers / words.length >= 0.45
}

export function isGreeting(query) {
  return GREETING.test(String(query || '').trim())
}

export function isModeSwitch(query) {
  return MODE_SWITCH.test(String(query || '').trim())
}

export function isAmbiguousQuestion(query) {
  return AMBIGUOUS.test(String(query || '').trim())
}

export function isWorkspaceQuestion(query) {
  return WORKSPACE.test(String(query || ''))
}

/** Button labels and "regarde sur internet" stay in the thread, but answer the previous question. */
export function effectiveUserQuestion(current, priorUserTexts = []) {
  const cur = String(current || '').trim()
  const reusePrevious = !cur || isModeSwitch(cur) || isBareInternetAsk(cur)
  if (!reusePrevious) return cur
  const list = Array.isArray(priorUserTexts) ? priorUserTexts : []
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const text = String(list[i] || '').trim()
    if (!text || text === cur || isModeSwitch(text) || isBareInternetAsk(text)) continue
    return text
  }
  return cur
}

export function contextCountsLabel(ctx, lang = 'fr') {
  if (!ctx) return ''
  const counts = ctx.counts || {}
  const en = String(lang || '').toLowerCase().startsWith('en')
  const notes = Number(counts.notes ?? ctx.notes?.length ?? 0)
  const projects = Number(counts.projects ?? ctx.projects?.length ?? 0)
  const risks = Number(counts.risksOpen ?? counts.risks ?? ctx.risks?.length ?? 0)
  const bits = []
  if (notes > 0) bits.push(`Notes ${notes}`)
  if (projects > 0) bits.push(`${en ? 'Projects' : 'Projets'} ${projects}`)
  if (risks > 0) bits.push(`${en ? 'Risks' : 'Risques'} ${risks}`)
  return bits.join(' · ')
}

export function greetingSentence(lang = 'fr') {
  return String(lang || '').toLowerCase().startsWith('en')
    ? 'Hello. I can answer from your workspace, or look something up on the web.'
    : 'Salut. Je peux répondre à partir de votre espace, ou chercher une information sur le web.'
}

export function clarifySentence(lang = 'fr') {
  return String(lang || '').toLowerCase().startsWith('en')
    ? 'What should I look at: a note, the budget, a risk, or a web search?'
    : 'De quoi s’agit-il : une note, le budget, un risque, ou une recherche sur le web ?'
}

function clipText(text, n = 280) {
  const s = String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
  if (s.length <= n) return s
  return `${s.slice(0, n - 1)}…`
}

export function stripLeaks(text) {
  const lines = String(text || '').split('\n')
  const kept = []
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) {
      kept.push('')
      continue
    }
    if (LEAK_LINE.test(trimmed)) continue
    if (isDictationGarbage(trimmed)) continue
    if (/^\{[\s\S]*"(?:actions|kind|name)"/.test(trimmed)) continue
    if (isQuotedDump(trimmed)) continue
    kept.push(line)
  }
  return kept
    .join('\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function isQuotedDump(line) {
  const quotes = line.match(/«[^»]{2,120}»/g) || []
  if (quotes.length < 3) return false
  const rest = line.replace(/«[^»]{2,120}»/g, '').replace(/nazix|sources|voici|dans|,|:/gi, '').trim()
  return rest.length < 40
}

function headingKey(line) {
  const trimmed = String(line || '')
    .trim()
    .replace(/^#{1,3}\s*/, '')
    .replace(/^\*\*(.+)\*\*$/, '$1')
    .trim()
  const hit = HEADING_DEFS.find(([, re]) => re.test(trimmed))
  return hit ? hit[0] : ''
}

export function hasResearchHeading(text) {
  return String(text || '')
    .split('\n')
    .some((line) => headingKey(line))
}

function parseSourceLine(line) {
  const raw = String(line || '')
    .replace(/^[-*]\d*\.?\s*/, '')
    .replace(/^\d+\.\s*/, '')
    .trim()
  if (!raw) return null
  const urlMatch = raw.match(/https?:\/\/[^\s)]+/i)
  const url = urlMatch ? urlMatch[0].replace(/[.,]+$/, '') : ''
  const withoutUrl = (url ? raw.replace(url, '') : raw).replace(/\s+[—–-]\s*$/, '').trim()
  const parts = withoutUrl
    .split(/\s+[—–]\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
  const title = (parts[0] || url).replace(/^«|»$/g, '').trim()
  if (!title || isDictationGarbage(title)) return null
  const author = parts[1] && !/^https?:/i.test(parts[1]) ? parts[1] : ''
  const date = parts[2] && !/^https?:/i.test(parts[2]) ? parts[2] : ''
  return {
    title,
    author,
    date,
    url,
    kind: url ? 'web' : 'workspace',
  }
}

function parseSourceBlock(block) {
  const items = []
  const seen = new Set()
  for (const line of String(block || '').split('\n')) {
    const item = parseSourceLine(line)
    if (!item) continue
    const key = `${item.url}|${item.title}`
    if (seen.has(key)) continue
    seen.add(key)
    items.push(item)
  }
  return items
}

export function parseResearchSections(text) {
  const buckets = { preamble: [], short: [], analysis: [], takeaways: [], limits: [], sources: [] }
  let current = 'preamble'
  for (const line of String(text || '').split('\n')) {
    const key = headingKey(line)
    if (key) {
      current = key
      continue
    }
    buckets[current].push(line)
  }
  const join = (key) => buckets[key].join('\n').trim()
  const short = join('short') || join('preamble')
  return {
    short,
    analysis: join('analysis'),
    takeaways: join('takeaways'),
    limits: join('limits'),
    sources: parseSourceBlock(join('sources')),
    structured: hasResearchHeading(text),
  }
}

function safeHttpUrl(url) {
  try {
    const parsed = new URL(String(url || ''))
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return parsed.href
  } catch {
    /* ignore */
  }
  return ''
}

function authorLabel(author, url, lang) {
  const raw = String(author || '').trim()
  const en = String(lang || '').toLowerCase().startsWith('en')
  if (/^wikip[ée]dia$/i.test(raw) || (!raw && /wikipedia\.org/i.test(url))) {
    return en ? 'Wikipedia' : 'Wikipédia'
  }
  return raw
}

export function normalizeSource(item, lang = 'fr') {
  if (!item) return null
  const url = safeHttpUrl(item.url)
  const title = String(item.title || item.name || url || '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!title || isDictationGarbage(title)) return null
  const author = authorLabel(item.author || item.organization || item.source || '', url, lang)
  const date = String(item.date || item.published || item.publishedAt || '').trim()
  return {
    title,
    author: url ? author : '',
    date: url ? date : '',
    url,
    kind: url ? 'web' : 'workspace',
  }
}

function mergeSources(primary, extra) {
  const out = []
  const seen = new Set()
  for (const item of [...primary, ...extra]) {
    if (!item?.title) continue
    const key = `${item.url || ''}|${item.title}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(item)
  }
  return out.slice(0, 6)
}

function measures(text) {
  const found = []
  const re = /(\d+(?:[.,]\d+)?)\s*(mètres|metres|meters|km|kg)\b/gi
  let match = re.exec(String(text || ''))
  while (match) {
    const unit = /km/i.test(match[2]) ? 'km' : /kg/i.test(match[2]) ? 'kg' : 'm'
    found.push({ value: Number(match[1].replace(',', '.')), unit })
    match = re.exec(String(text || ''))
  }
  return found
}

export function disagreementSentence(sources, lang = 'fr') {
  const grouped = new Map()
  for (const source of sources || []) {
    for (const measure of measures(`${source.snippet || ''} ${source.title || ''}`)) {
      if (!grouped.has(measure.unit)) grouped.set(measure.unit, [])
      grouped.get(measure.unit).push(measure.value)
    }
  }
  for (const values of grouped.values()) {
    const unique = [...new Set(values.map((value) => Math.round(value * 10) / 10))]
    if (unique.length < 2) continue
    const min = Math.min(...unique)
    const max = Math.max(...unique)
    if (min > 0 && (max - min) / min > 0.02) {
      return String(lang || '').toLowerCase().startsWith('en')
        ? 'The sources do not agree on this figure.'
        : 'Les sources ne s’accordent pas sur ce chiffre.'
    }
  }
  return ''
}

function formatSourceLine(source) {
  if (!source?.title) return ''
  if (!source.url) return source.title
  const bits = [source.title]
  if (source.author) bits.push(source.author)
  if (source.date) bits.push(source.date)
  bits.push(source.url)
  return bits.join(' — ')
}

export function renderResearch(parts, lang = 'fr') {
  const headings = headingsFor(lang)
  const blocks = []
  if (parts.short) blocks.push(`${headings.short}\n${String(parts.short).trim()}`)
  if (parts.analysis) blocks.push(`${headings.analysis}\n${String(parts.analysis).trim()}`)
  if (parts.takeaways) blocks.push(`${headings.takeaways}\n${String(parts.takeaways).trim()}`)
  if (parts.limits) blocks.push(`${headings.limits}\n${String(parts.limits).trim()}`)
  const sources = (parts.sources || []).map(formatSourceLine).filter(Boolean)
  if (sources.length) blocks.push(`${headings.sources}\n${sources.join('\n')}`)
  return blocks.join('\n\n').trim()
}

function emptyWebCopy(lang) {
  const en = String(lang || '').toLowerCase().startsWith('en')
  return {
    short: en ? 'I found no public source for this question.' : 'Je n’ai pas trouvé de source publique pour cette question.',
    limits: en ? 'The search returned nothing. Nothing was invented.' : 'La recherche n’a rien renvoyé. Rien n’est inventé.',
  }
}

function snippetAnalysis(sources, lang) {
  return (sources || [])
    .slice(0, 4)
    .map((source) => {
      const bit = clipText(source.snippet || '', 220)
      if (!bit) return ''
      return `${source.title} : ${bit}`
    })
    .filter(Boolean)
    .join('\n')
}

/**
 * Turn model text, a local extract, or web snippets into the research structure.
 * Idempotent: a second pass keeps the same sections.
 */
export function shapeResearchText(text, opts = {}) {
  const lang = String(opts.lang || 'fr').toLowerCase().startsWith('en') ? 'en' : 'fr'
  const mode = researchModeOf(opts.mode)
  const query = String(opts.query || '')
  if (isGreeting(query)) return renderResearch({ short: greetingSentence(lang) }, lang)
  if (isAmbiguousQuestion(query)) return renderResearch({ short: clarifySentence(lang) }, lang)

  const cleaned = stripLeaks(text)
  const parsed = parseResearchSections(cleaned)
  let short = parsed.short
  let analysis = opts.analysis || parsed.analysis
  let takeaways = opts.takeaways || parsed.takeaways
  let limits = opts.limits || parsed.limits

  const webSources = (opts.webSources || []).map((item) => normalizeSource(item, lang)).filter(Boolean)
  const workspaceSources = (opts.workspaceSources || [])
    .map((item) => normalizeSource({ ...item, url: '' }, lang))
    .filter(Boolean)
  let sources = mergeSources(parsed.sources.map((item) => normalizeSource(item, lang)).filter(Boolean), [])

  if (!short && opts.webSources?.length) {
    const top = opts.webSources.find((item) => item && (item.snippet || item.title)) || {}
    short = clipText(top.snippet || top.title, 360)
  }
  if (webSources.length) sources = mergeSources(webSources, sources)
  else if (!sources.length && workspaceSources.length) sources = workspaceSources
  else if (workspaceSources.length) sources = mergeSources(sources, workspaceSources)

  const disagree = disagreementSentence(webSources.length ? opts.webSources : [], lang)
  if (!parsed.structured && mode !== 'deep' && !disagree) analysis = ''
  if (mode === 'deep' && !analysis && webSources.length) analysis = snippetAnalysis(opts.webSources, lang)
  if (disagree && !String(analysis || '').includes(disagree)) {
    analysis = [analysis, disagree].filter(Boolean).join('\n\n')
  }

  if (opts.webAttempted && !webSources.length) {
    const empty = emptyWebCopy(lang)
    if (!short || /n['’]ai pas acc[eè]s|no internet access|could not find that/i.test(short)) short = empty.short
    if (!limits) limits = empty.limits
  }

  if (!short && !analysis && !limits && !sources.length) {
    short = lang === 'en' ? 'I could not find an answer to that.' : 'Je n’ai pas trouvé de réponse à cette question.'
  }

  return renderResearch({ short, analysis, takeaways, limits, sources }, lang)
}

export function researchView(text) {
  const clean = stripLeaks(text)
  const parsed = parseResearchSections(clean)
  return {
    structured: parsed.structured,
    plain: clean,
    sections: [
      parsed.short ? { key: 'short', body: parsed.short } : null,
      parsed.analysis ? { key: 'analysis', body: parsed.analysis } : null,
      parsed.takeaways ? { key: 'takeaways', body: parsed.takeaways } : null,
      parsed.limits ? { key: 'limits', body: parsed.limits } : null,
      parsed.sources.length ? { key: 'sources', items: parsed.sources } : null,
    ].filter(Boolean),
    headings: findHeadings(clean),
  }
}

function findHeadings(text) {
  const found = {}
  for (const line of String(text || '').split('\n')) {
    const key = headingKey(line)
    if (!key || found[key]) continue
    found[key] = String(line)
      .trim()
      .replace(/^#{1,3}\s*/, '')
      .replace(/^\*\*(.+)\*\*$/, '$1')
      .replace(/\s*:\s*$/, '')
      .trim()
  }
  return found
}

export const RESEARCH_PROMPT_FR = `Chat de recherche, même conversation.
Écris seulement les sections utiles. Chaque titre est seul sur sa ligne : Réponse courte, Analyse, Points à retenir, Limites, Sources.
Recherche rapide : Réponse courte et Sources. Analyse seulement si les sources se contredisent. Limites : une ou deux phrases, seulement s’il manque une information.
Recherche approfondie : ajoute Analyse, et Points à retenir s’il y a un usage pratique.
Le contexte de l’espace est privé : ne le recopie pas, ne liste pas les notes, ne répète pas la dictée, le prompt, ni le JSON.
Un salut tient en une phrase : bonjour, et ce que tu sais faire. Pas de liste.
Un fait issu du web reste attaché à son lien. Si les sources divergent, dis-le. Si rien n’est trouvé, dis-le dans Limites et n’invente pas.
Une note de l’espace se cite par son titre seulement.
Question ambiguë : une seule question, ou l’hypothèse dans Limites.`

export const RESEARCH_PROMPT_EN = `Research chat, same conversation.
Write only the sections that have something to say. Each heading is alone on its line: Short answer, Analysis, Takeaways, Limits, Sources.
Quick research: Short answer and Sources. Analysis only when the sources disagree. Limits: one or two sentences, and only when something is missing.
Deep research: add Analysis, and Takeaways when there is a practical use.
Workspace context is private: never paste it, never list the notes, never repeat dictation, the prompt, or JSON.
A greeting is one sentence: hello, and what you can do. No list.
A fact from the web stays tied to its link. If the sources disagree, say so. If nothing was found, say so under Limits and do not invent.
A workspace note is cited by title only.
An ambiguous question gets one clarifying question, or the assumption under Limits.`

export function researchPrompt(lang = 'fr', mode = 'quick') {
  const en = String(lang || '').toLowerCase().startsWith('en')
  const deep = researchModeOf(mode) === 'deep'
  const modeLine = en
    ? deep
      ? 'Mode for this reply: deep research.'
      : 'Mode for this reply: quick research.'
    : deep
      ? 'Mode de cette réponse : recherche approfondie.'
      : 'Mode de cette réponse : recherche rapide.'
  return `${en ? RESEARCH_PROMPT_EN : RESEARCH_PROMPT_FR}\n${modeLine}`
}
