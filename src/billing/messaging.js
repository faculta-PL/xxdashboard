/** Group and project conversations: members only. Audit never keeps a message body. */

const BODY_KEYS = new Set(['body', 'text', 'content', 'message', 'snippet'])

export function projectConversationId(projectId) {
  return projectId ? `grp_project_${projectId}` : ''
}

export function projectMemberIds(project, extra = []) {
  return [...new Set([project?.ownerId, project?.leadId, ...(project?.memberIds || []), ...extra].filter(Boolean))]
}

export function canAccessConversation(user, conversation, ctx = {}) {
  if (!user?.id || !conversation) return false
  if (conversation.projectId || conversation.kind === 'project') {
    const project = ctx.project || ctx.projects?.[conversation.projectId] || null
    const members = new Set([...(conversation.memberIds || []), ...projectMemberIds(project)])
    return members.has(user.id)
  }
  if (conversation.isGeneral && Array.isArray(ctx.orgMemberIds)) {
    return ctx.orgMemberIds.includes(user.id)
  }
  return Array.isArray(conversation.memberIds) && conversation.memberIds.includes(user.id)
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function mentionUserIds(text, users) {
  const raw = String(text || '')
  const ids = []
  for (const user of users || []) {
    if (!user?.id) continue
    const name = String(user.fullName || '').trim()
    const named = name.length > 1 && new RegExp(`(^|\\s)@${escapeRegExp(name)}\\b`, 'i').test(raw)
    const byId = raw.includes(`@${user.id}`)
    if (named || byId) ids.push(user.id)
  }
  return [...new Set(ids)]
}

export function auditWithoutBody(entry) {
  if (!entry || typeof entry !== 'object') return {}
  const out = Array.isArray(entry) ? [] : {}
  for (const [key, value] of Object.entries(entry)) {
    if (BODY_KEYS.has(key)) continue
    if (value && typeof value === 'object') out[key] = auditWithoutBody(value)
    else out[key] = value
  }
  return out
}

export function messageAuditEntry(entry) {
  return auditWithoutBody({ type: 'message', ...entry })
}
