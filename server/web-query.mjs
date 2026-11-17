/** Pure helpers for public web search. No secrets, no network. */

const INTERNET_INTENT =
  /cherche|recherche|sur (le |internet|le web)|google|duckduckgo|wikipedia|what is|who is|qui est|qu['’]est-ce|définition|definition|look up|search the web|en ligne/i

const BARE_INTERNET =
  /^(?:(?:peux-tu|pouvez-vous|tu peux|can you|please|stp|svp)\s+)?(?:regarde(?:r|z)?|cherche(?:r|z)?|recherche(?:r)?|search|look(?:\s+it)?\s+up)(?:\s+(?:donc|alors|maintenant|please|stp|for me|pour moi))?(?:\s+sur)?(?:\s+(?:internet|le web|google|en ligne|online|the web))?[\s.!?…]*$/i

const ENCYCLOPEDIC =
  /c['’]est quoi|c quoi|qu['’]est[- ]ce|what is|who is|qui est|quelle est|quel est|d[ée]finition|definition|capitale|capital of|histoire de|biographie|biography/i

const NO_INTERNET =
  /n['’]ai pas acc[eè]s [àa] (?:l['’]\s*)?internet|pas acc[eè]s [àa] internet|do not have (?:access to )?(?:the )?internet|don't have (?:access to )?(?:the )?internet|cannot (?:access|browse|search) the (?:internet|web)|uniquement vous aider avec les informations disponibles dans votre espace|only help with (?:the )?information available in your (?:nazix )?workspace|pas trouv[ée].{0,120}contexte|dans le contexte nazix|only (?:the )?nazix (?:context|workspace)|could not find.{0,60}nazix/i

export function userAskedForWeb(query) {
  return INTERNET_INTENT.test(String(query || ''))
}

export function isBareInternetAsk(query) {
  return BARE_INTERNET.test(String(query || '').trim())
}

export function normalizeWebQuery(text) {
  let q = String(text || '').replace(/\s+/g, ' ').trim()
  q = q.replace(/regarde(?:r|z)?(?:\s+\w+){0,2}\s+sur\s+(?:internet|le web)/gi, ' ')
  q = q.replace(/cherche(?:r|z)?(?:\s+(?:moi|nous|donc))?\s+sur\s+(?:le web|internet|google)/gi, ' ')
  q = q.replace(/search the web(?: for)?/gi, ' ')
  q = q.replace(/look (?:it )?up(?: online| on the web)?/gi, ' ')
  q = q.replace(/\b(?:sur internet|sur le web|en ligne|online)\b/gi, ' ')
  q = q.replace(/^(?:s'il te pla[iî]t|s'il vous pla[iî]t|please|stp|svp|peux-tu|pouvez-vous|can you)\s+/i, '')
  q = q.replace(
    /^(?:dis[- ]moi|c['’]est quoi|c quoi|qu['’]est[- ]ce que|qu['’]est[- ]ce qu['’]|what is|who is|who['’]s|what['’]s|qui est|quelle est|quel est)\s+/i,
    '',
  )
  q = q.replace(/^(?:la |le |les |l['’]|un |une |des |du |de la |de l['’])/i, '')
  q = q.replace(/[?？!！.。,;:]+/g, ' ')
  q = q.replace(/\s+/g, ' ').trim()
  return q
}

export function isEncyclopedicQuery(raw) {
  const text = String(raw || '').trim()
  if (!text) return false
  if (ENCYCLOPEDIC.test(text)) return true
  const words = normalizeWebQuery(text).split(/\s+/).filter(Boolean)
  return words.length > 0 && words.length <= 4
}

/** Current turn, or the previous user turn when this message only asks to look online. */
export function resolveWebQuery(current, priorUserTexts = []) {
  const raw = String(current || '').trim()
  if (raw && !isBareInternetAsk(raw)) {
    const q = normalizeWebQuery(raw)
    if (q) return q
  }
  const prior = Array.isArray(priorUserTexts) ? priorUserTexts : []
  for (let i = prior.length - 1; i >= 0; i -= 1) {
    const text = String(prior[i] || '').trim()
    if (!text || isBareInternetAsk(text)) continue
    const q = normalizeWebQuery(text)
    if (q) return q
  }
  return normalizeWebQuery(raw)
}

export function searchFailureMessage(lang, err) {
  const status = Number(err?.status || 0)
  const en = String(lang || '').toLowerCase().startsWith('en')
  const code = status > 0 ? `HTTP ${status}` : en ? 'network' : 'réseau'
  return en ? `Web search failed (${code}).` : `La recherche web a échoué (${code}).`
}

export function answerFromSources(sources, lang = 'fr') {
  const list = (sources || []).filter((s) => s && (s.title || s.url)).slice(0, 5)
  const top = list[0] || {}
  const snippet = String(top.snippet || '').trim()
  const links = list.map((s) => `- ${s.title || s.url} — ${s.url || ''}`.trim()).join('\n')
  const en = String(lang || '').toLowerCase().startsWith('en')
  const lead = snippet || top.title || (en ? 'Public source' : 'Source publique')
  return en ? `${lead}\n\nSources:\n${links}` : `${lead}\n\nSources :\n${links}`
}

/** Drop a “no internet” refusal when public sources exist, and keep the links under the answer. */
export function ensureSourceReply(text, sources, lang = 'fr') {
  const list = (sources || []).filter((s) => s && (s.title || s.url)).slice(0, 5)
  if (!list.length) return String(text || '')
  let out = String(text || '').trim()
  if (!out || NO_INTERNET.test(out)) out = answerFromSources(list, lang).trim()
  const missing = list.filter((s) => s.url && !out.includes(s.url))
  if (missing.length) {
    const en = String(lang || '').toLowerCase().startsWith('en')
    const heading = en ? 'Sources:' : 'Sources :'
    const links = list.map((s) => `- ${s.title || s.url} — ${s.url || ''}`.trim()).join('\n')
    if (!out.includes(heading)) out = `${out}\n\n${heading}\n${links}`
  }
  return out.trim()
}
