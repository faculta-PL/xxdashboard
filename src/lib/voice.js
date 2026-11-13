/** Web Speech API helpers. Never send audio/text to OpenAI from here. */

export const VOICE_DESTS = ['note', 'event', 'budget', 'idea', 'ai']

export function getSpeechRecognitionCtor(globalObj = typeof window !== 'undefined' ? window : undefined) {
  if (!globalObj) return null
  return globalObj.SpeechRecognition || globalObj.webkitSpeechRecognition || null
}

export function speechSupported(globalObj) {
  return Boolean(getSpeechRecognitionCtor(globalObj))
}

export function speechLocale(lang) {
  return String(lang || '').toLowerCase().startsWith('en') ? 'en-US' : 'fr-FR'
}

export function firstLine(text, fallback = '') {
  const t = String(text || '').trim()
  if (!t) return fallback
  const line = t.split(/\n/)[0].trim()
  return (line || fallback).slice(0, 80)
}

export function parseSpeechResult(event) {
  let finalText = ''
  let interim = ''
  const results = event?.results || []
  for (let i = 0; i < results.length; i++) {
    const piece = results[i]?.[0]?.transcript || ''
    if (results[i]?.isFinal) finalText += `${piece} `
    else interim += `${piece} `
  }
  const final = finalText.trim()
  const live = interim.trim()
  return {
    final,
    interim: live,
    combined: [final, live].filter(Boolean).join(' ').trim(),
  }
}

export const DICTATION_LANG_KEY = 'nazix_dictation_lang'

export function readDictationLocale() {
  try {
    const saved = localStorage.getItem(DICTATION_LANG_KEY)
    if (saved === 'en-US' || saved === 'fr-FR') return saved
  } catch {
    /* ignore */
  }
  return 'fr-FR'
}

export function writeDictationLocale(locale) {
  const next = locale === 'en-US' ? 'en-US' : 'fr-FR'
  try {
    localStorage.setItem(DICTATION_LANG_KEY, next)
  } catch {
    /* ignore */
  }
  return next
}

export function createRecognizer({ lang, locale, onResult, onError, onEnd } = {}, globalObj) {
  const Ctor = getSpeechRecognitionCtor(globalObj)
  if (!Ctor) return null
  const rec = new Ctor()
  rec.lang = locale || speechLocale(lang)
  rec.interimResults = true
  rec.continuous = true
  rec.onresult = (event) => onResult?.(parseSpeechResult(event))
  rec.onerror = (event) => onError?.(event)
  rec.onend = () => onEnd?.()
  return rec
}

export function isVoiceDest(value) {
  return VOICE_DESTS.includes(value)
}
