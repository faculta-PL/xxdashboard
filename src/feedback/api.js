/** Create, import, vote once, and change status. Never deletes a feedback doc. */
import { uid } from '../lib/crypto'
import { isAdmin } from '../lib/rbac'
import { getStoreSnapshot, notifyUsers, writeFeedbackDoc } from '../lib/store'
import { FEEDBACK_STATUSES } from './model.js'
import { isOrgAdmin, isOrgMember } from './org.js'

function coded(code) {
  const err = new Error(code)
  err.code = code
  return err
}

function authorName(user) {
  return String(user?.fullName || user?.email || 'Membre').trim().slice(0, 120)
}

function requireUser(user) {
  if (!user?.id) throw coded('forbidden')
}

async function createFeedbackDoc({ title, detail, module, source }, user, orgId) {
  requireUser(user)
  const db = getStoreSnapshot()
  if (!isOrgMember(user, orgId, db)) throw coded('not_member')
  const cleanTitle = String(title || '').replace(/\s+/g, ' ').trim().slice(0, 200)
  const cleanDetail = String(detail || '').trim().slice(0, 8000)
  if (!cleanTitle || !cleanDetail) throw coded('need_fields')
  const moduleName = String(module || '').replace(/\s+/g, ' ').trim().slice(0, 80)
  const now = new Date().toISOString()
  const row = {
    id: uid('fbk'),
    title: cleanTitle,
    detail: cleanDetail,
    body: cleanDetail,
    module: moduleName || null,
    status: 'new',
    votes: [],
    author: authorName(user),
    authorId: user.id,
    userId: user.id,
    ownerId: user.id,
    createdAt: now,
    source: source === 'import' ? 'import' : 'app',
    orgId: String(orgId || ''),
  }
  await writeFeedbackDoc(row)
  return row
}

async function notifyAdmins(user, payload) {
  const db = getStoreSnapshot()
  const adminIds = Object.values(db.xx_users || {})
    .filter((account) => account?.id && account.id !== user.id && isAdmin(account))
    .map((account) => account.id)
  if (!adminIds.length) return
  await notifyUsers(adminIds, payload)
}

export async function submitFeedback(input, user, orgId) {
  const row = await createFeedbackDoc({ ...input, source: 'app' }, user, orgId)
  await notifyAdmins(user, {
    type: 'feedback',
    title: 'Nouveau retour',
    body: `${authorName(user)} : ${row.title}`,
    meta: { feedbackId: row.id, orgId: row.orgId },
  })
  return row
}

export async function importFeedbackItems(items, user, orgId) {
  requireUser(user)
  const list = Array.isArray(items) ? items : []
  if (!list.length) throw coded('import_empty')
  const db = getStoreSnapshot()
  if (!isOrgMember(user, orgId, db)) throw coded('not_member')
  const created = []
  for (const item of list) {
    created.push(await createFeedbackDoc({ ...item, source: 'import' }, user, orgId))
  }
  await notifyAdmins(user, {
    type: 'feedback',
    title: 'Retours importés',
    body: `${authorName(user)} a importé ${created.length} retour(s).`,
    meta: { orgId: String(orgId || ''), count: created.length },
  })
  return created
}

export async function voteFeedbackOnce(id, user) {
  requireUser(user)
  const db = getStoreSnapshot()
  const existing = db.xx_feedback?.[id]
  if (!existing) throw coded('missing')
  const legacy = existing.orgId == null
  if (legacy) {
    const owns = existing.userId === user.id || existing.ownerId === user.id || existing.authorId === user.id
    if (!owns && !isAdmin(user)) throw coded('forbidden')
  } else if (!isOrgMember(user, existing.orgId || '', db)) {
    throw coded('not_member')
  }
  const votes = Array.isArray(existing.votes) ? existing.votes.map((voteId) => String(voteId)) : []
  if (votes.includes(user.id)) throw coded('vote_once')
  votes.push(user.id)
  await writeFeedbackDoc({ id, votes })
  return votes
}

export async function setFeedbackStatus(id, status, user) {
  requireUser(user)
  if (!FEEDBACK_STATUSES.includes(status)) throw coded('bad_status')
  const db = getStoreSnapshot()
  const existing = db.xx_feedback?.[id]
  if (!existing) throw coded('missing')
  const orgId = existing.orgId || ''
  if (!isOrgAdmin(user, orgId, db)) throw coded('admin_only')
  await writeFeedbackDoc({ id, status })
  return status
}
