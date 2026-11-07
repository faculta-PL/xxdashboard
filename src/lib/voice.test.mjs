import { firstLine, isVoiceDest, parseSpeechResult, speechLocale, speechSupported } from './voice.js'

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

assert(speechLocale('en') === 'en-US', 'en locale')
assert(speechLocale('fr') === 'fr-FR', 'fr locale')
assert(firstLine('Hello\nworld', 'x') === 'Hello', 'first line')
assert(firstLine('   ', 'Note') === 'Note', 'fallback')
assert(isVoiceDest('note') && isVoiceDest('ai') && !isVoiceDest('hack'), 'dests')
assert(speechSupported({}) === false, 'no ctor')
const parsed = parseSpeechResult({
  results: [
    { 0: { transcript: 'bonjour ' }, isFinal: true },
    { 0: { transcript: 'équipe' }, isFinal: false },
  ],
})
assert(parsed.final === 'bonjour', parsed.final)
assert(parsed.combined.includes('équipe'), parsed.combined)
console.log('voice ok')
