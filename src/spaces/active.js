/** nazix_active_workspace mirrors nazix_active_org. Same tenant id. */

export const ACTIVE_ORG_KEY = 'nazix_active_org'
export const ACTIVE_WORKSPACE_KEY = 'nazix_active_workspace'

export function writeActiveMirror(storage, orgId) {
  if (!storage) return
  const next = String(orgId || '')
  if (next) {
    storage.setItem(ACTIVE_ORG_KEY, next)
    storage.setItem(ACTIVE_WORKSPACE_KEY, next)
    return
  }
  storage.removeItem(ACTIVE_ORG_KEY)
  storage.removeItem(ACTIVE_WORKSPACE_KEY)
}

export function readMirroredActiveId(storage) {
  if (!storage) return ''
  const org = String(storage.getItem(ACTIVE_ORG_KEY) || '').trim()
  const workspace = String(storage.getItem(ACTIVE_WORKSPACE_KEY) || '').trim()
  const next = org || workspace
  if (next !== org || next !== workspace) writeActiveMirror(storage, next)
  return next
}
