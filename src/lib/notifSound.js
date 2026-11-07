/** Son discret à l’arrivée d’une notification. Préférence : localStorage nazix_sound. */

export const SOUND_KEY = 'nazix_sound'

let audioCtx = null
let unlocked = false

export function readSoundPref() {
  try {
    const raw = localStorage.getItem(SOUND_KEY)
    if (raw == null || raw === '') return true
    return raw === 'on' || raw === '1' || raw === 'true'
  } catch {
    return true
  }
}

export function writeSoundPref(on) {
  try {
    localStorage.setItem(SOUND_KEY, on ? 'on' : 'off')
  } catch {
    /* ignore */
  }
}

export function unlockNotifAudio() {
  try {
    const Ctx = globalThis.AudioContext || globalThis.webkitAudioContext
    if (!Ctx) return
    if (!audioCtx) audioCtx = new Ctx()
    if (audioCtx.state === 'suspended') audioCtx.resume()
    unlocked = true
  } catch {
    /* autoplay */
  }
}

function ensureCtx() {
  const Ctx = globalThis.AudioContext || globalThis.webkitAudioContext
  if (!Ctx) return null
  if (!audioCtx) audioCtx = new Ctx()
  return audioCtx
}

/** Bip court (Web Audio), seulement si le son n’est pas coupé. */
export function playNotifBeep() {
  if (!readSoundPref()) return false
  try {
    const ctx = ensureCtx()
    if (!ctx) return false
    if (ctx.state === 'suspended') {
      ctx.resume()
      if (!unlocked) return false
    }
    const t = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(880, t)
    osc.frequency.exponentialRampToValueAtTime(660, t + 0.12)
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(0.045, t + 0.012)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.16)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(t)
    osc.stop(t + 0.18)
    return true
  } catch {
    return false
  }
}

export function bindNotifAudioUnlock() {
  if (typeof window === 'undefined') return () => {}
  const onFirst = () => {
    unlockNotifAudio()
    window.removeEventListener('pointerdown', onFirst)
    window.removeEventListener('keydown', onFirst)
  }
  window.addEventListener('pointerdown', onFirst)
  window.addEventListener('keydown', onFirst)
  return () => {
    window.removeEventListener('pointerdown', onFirst)
    window.removeEventListener('keydown', onFirst)
  }
}
