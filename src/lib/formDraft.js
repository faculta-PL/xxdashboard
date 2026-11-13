/** Session drafts and debounced autosave. No blocking dialogs. */

import { useEffect, useRef, useState } from 'react'

export function formDraftKey(formId, orgId) {
  return `nazix:form:${orgId || 'none'}:${formId}`
}

export function clearFormDraft(formId, orgId) {
  try {
    sessionStorage.removeItem(formDraftKey(formId, orgId))
  } catch {
    /* ignore */
  }
}

export function useFormDraft(formId, orgId, serialized, apply) {
  const applyRef = useRef(apply)
  applyRef.current = apply
  const skipRef = useRef(false)
  const [hasDraft, setHasDraft] = useState(false)
  const key = formDraftKey(formId, orgId)

  useEffect(() => {
    skipRef.current = false
    let found = false
    try {
      const raw = sessionStorage.getItem(key)
      if (raw) {
        found = true
        applyRef.current(JSON.parse(raw))
      }
    } catch {
      /* ignore */
    }
    setHasDraft(found)
  }, [key])

  useEffect(() => {
    if (skipRef.current || !serialized) return
    try {
      sessionStorage.setItem(key, serialized)
      setHasDraft(true)
    } catch {
      /* ignore */
    }
  }, [key, serialized])

  const clear = () => {
    skipRef.current = true
    clearFormDraft(formId, orgId)
    setHasDraft(false)
  }

  return { hasDraft, clear }
}

const AUTOSAVE_MIN_CHARS = 80
const AUTOSAVE_DIRTY_MS = 2000
const AUTOSAVE_DEBOUNCE_MS = 600

function recoveryKey(storageKey) {
  return `nazix:autosave:${storageKey || 'draft'}`
}

export function readAutosaveRecovery(storageKey) {
  try {
    return localStorage.getItem(recoveryKey(storageKey)) || ''
  } catch {
    return ''
  }
}

export function useAutosave({ text, enabled, storageKey, onSave }) {
  const [status, setStatus] = useState('idle')
  const [savedAt, setSavedAt] = useState(null)
  const [recovered, setRecovered] = useState('')
  const textRef = useRef(text)
  const onSaveRef = useRef(onSave)
  const savedText = useRef(null)
  const dirtyAt = useRef(0)
  const timer = useRef(null)
  const flight = useRef(false)
  const again = useRef(false)
  textRef.current = text
  onSaveRef.current = onSave

  useEffect(() => {
    const pending = readAutosaveRecovery(storageKey)
    if (pending) setRecovered(pending)
    savedText.current = null
  }, [storageKey])

  const flush = async () => {
    if (!enabled) return
    const current = String(textRef.current || '')
    if (savedText.current !== null && current === savedText.current) {
      setStatus('saved')
      return
    }
    try {
      localStorage.setItem(recoveryKey(storageKey), current)
    } catch {
      /* ignore */
    }
    if (flight.current) {
      again.current = true
      return
    }
    flight.current = true
    setStatus('saving')
    try {
      await onSaveRef.current(current)
      savedText.current = current
      dirtyAt.current = 0
      setStatus('saved')
      setSavedAt(new Date())
      try {
        if (localStorage.getItem(recoveryKey(storageKey)) === current) localStorage.removeItem(recoveryKey(storageKey))
      } catch {
        /* ignore */
      }
      setRecovered('')
    } catch {
      setStatus('unsaved')
    } finally {
      flight.current = false
      if (again.current) {
        again.current = false
        flush()
      }
    }
  }

  useEffect(() => {
    if (!enabled) return undefined
    const current = String(text || '')
    if (savedText.current === null) savedText.current = current
    if (current === savedText.current) return undefined
    if (!dirtyAt.current) dirtyAt.current = Date.now()
    setStatus('unsaved')
    const longEnough = current.trim().length >= AUTOSAVE_MIN_CHARS
    const elapsed = Date.now() - dirtyAt.current
    const ready = longEnough || elapsed >= AUTOSAVE_DIRTY_MS
    const waitMs = ready ? AUTOSAVE_DEBOUNCE_MS : Math.max(50, AUTOSAVE_DIRTY_MS - elapsed)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      const live = String(textRef.current || '').trim()
      const liveElapsed = Date.now() - (dirtyAt.current || Date.now())
      if (live.length >= AUTOSAVE_MIN_CHARS || liveElapsed >= AUTOSAVE_DIRTY_MS) flush()
    }, waitMs)
    return () => clearTimeout(timer.current)
  }, [text, enabled])

  useEffect(() => {
    if (!enabled) return undefined
    const onVis = () => {
      if (document.visibilityState === 'hidden') flush()
    }
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('beforeunload', flush)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('beforeunload', flush)
    }
  }, [enabled, storageKey])

  return { status, savedAt, recovered, flush }
}
