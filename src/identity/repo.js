const STORAGE_KEY = 'nazix_xx_invitations'
const listeners = new Set()

export function subscribeInvites(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function bump() {
  for (const fn of listeners) fn()
}

export function memoryRepo(initial = []) {
  const map = new Map()
  for (const row of initial) {
    if (row?.id) map.set(row.id, { ...row })
  }
  return {
    list() {
      return [...map.values()].map((row) => ({ ...row }))
    },
    get(id) {
      const row = map.get(id)
      return row ? { ...row } : null
    },
    save(row) {
      map.set(row.id, { ...row })
      return { ...row }
    },
  }
}

export function browserRepo() {
  function read() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
      return parsed && typeof parsed === 'object' ? parsed : {}
    } catch {
      return {}
    }
  }
  function write(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    bump()
  }
  return {
    list() {
      return Object.values(read())
    },
    get(id) {
      return read()[id] || null
    },
    save(row) {
      const all = read()
      all[row.id] = { ...row }
      write(all)
      return { ...row }
    },
  }
}
