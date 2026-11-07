import { readSoundPref, writeSoundPref, SOUND_KEY } from './notifSound.js'

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

const mem = {}
globalThis.localStorage = {
  getItem: (k) => (Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null),
  setItem: (k, v) => {
    mem[k] = String(v)
  },
  removeItem: (k) => {
    delete mem[k]
  },
}

assert(SOUND_KEY === 'nazix_sound', SOUND_KEY)
assert(readSoundPref() === true, 'default on when missing')
writeSoundPref(false)
assert(mem[SOUND_KEY] === 'off', mem[SOUND_KEY])
assert(readSoundPref() === false, 'off')
writeSoundPref(true)
assert(mem[SOUND_KEY] === 'on', 'persist on')
assert(readSoundPref() === true, 'on')

console.log('notifSound tests ok')
