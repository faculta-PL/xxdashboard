/** Append-only audit shape. Message bodies and secrets are dropped. */

const DROP = /password|token|secret|body|message|hash|email/i

export function buildAuditLog(input = {}) {
  const entry = {
    actorId: input.actorId || null,
    workspaceId: input.workspaceId || null,
    action: String(input.action || ''),
    resourceType: String(input.resourceType || ''),
    resourceId: input.resourceId ? String(input.resourceId) : null,
    at: input.at || new Date().toISOString(),
  }
  for (const key of Object.keys(entry)) {
    if (DROP.test(key) && key !== 'actorId' && key !== 'workspaceId' && key !== 'resourceId' && key !== 'resourceType' && key !== 'action') {
      delete entry[key]
    }
  }
  return entry
}
