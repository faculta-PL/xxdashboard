import assert from 'node:assert/strict'
import test from 'node:test'
import { LAUNCH_FREE_MODE, featureEnabled, guardQuota } from './flags.js'
import { PLANS, PLAN_IDS } from './plans.js'
import { canReadModuleItem, filterReadableRows } from './access.js'
import { messageAuditEntry } from './messaging.js'
import { FREE_SUBSCRIPTION, subscriptionOf } from './subscription.js'
import { searchSourcesAreApproved, isApprovedSearchHost, clientPayloadHasNoApiKey } from './searchPolicy.js'
import { billingKeys, billingT } from './i18n.js'

test('free mode does not block', () => {
  assert.equal(LAUNCH_FREE_MODE, true)
  assert.equal(featureEnabled(), true)
  assert.equal(featureEnabled('projects'), true)
  assert.equal(featureEnabled('export'), true)
  assert.equal(guardQuota('free', 'projects', 999).blocked, false)
  assert.equal(guardQuota('free', 'notes', PLANS.free.limits.notes + 10).ok, true)
  assert.deepEqual(PLAN_IDS, ['free', 'pro', 'business', 'enterprise'])
  assert.equal(subscriptionOf(null).planId, FREE_SUBSCRIPTION.planId)
  assert.deepEqual(subscriptionOf({ subscription: { planId: 'free', status: 'free' } }), {
    planId: 'free',
    status: 'free',
  })
})

test('export filter drops unreadable rows', () => {
  const user = { id: 'u1', role: 'Membre' }
  const rows = [
    { id: 'a', title: 'Mine', visibility: 'personal', ownerId: 'u1', content: 'diary' },
    { id: 'b', title: 'Secret', visibility: 'group', groupId: 'g1', ownerId: 'u2', content: 'hidden' },
    { id: 'c', title: 'Workspace', visibility: 'workspace', ownerId: 'u2' },
    { id: 'd', title: 'Shared', visibility: 'shared', ownerId: 'u2', shares: [{ userId: 'u1' }] },
    { id: 'e', title: 'Other personal', visibility: 'personal', ownerId: 'u2', content: 'nope' },
  ]
  const out = filterReadableRows(rows, user, { groups: { g1: { id: 'g1', memberIds: ['u2'] } } })
  assert.deepEqual(out.map((row) => row.id), ['a', 'c', 'd'])
})

test('private group note hidden', () => {
  const author = { id: 'author' }
  const stranger = { id: 'stranger' }
  const admin = { id: 'admin', role: 'Administrateur', email: 'admin@example.com' }
  const personal = { id: 'p', visibility: 'personal', ownerId: 'author', content: 'diary' }
  assert.equal(canReadModuleItem(author, personal), true)
  assert.equal(canReadModuleItem(stranger, personal), false)
  const note = {
    id: 'n',
    visibility: 'group',
    groupId: 'priv',
    ownerId: 'author',
    content: 'secret group note',
  }
  const groups = { priv: { id: 'priv', memberIds: ['author'], private: true } }
  assert.equal(canReadModuleItem(author, note, { groups }), true)
  assert.equal(canReadModuleItem(stranger, note, { groups }), false)
  assert.equal(canReadModuleItem(admin, note, { groups }), false)
  const audit = messageAuditEntry({
    groupId: 'priv',
    authorId: 'author',
    messageId: 'm1',
    body: 'secret group note',
    content: 'secret group note',
  })
  assert.equal(audit.body, undefined)
  assert.equal(audit.content, undefined)
  assert.equal(JSON.stringify(audit).includes('secret'), false)
})

test('search stays on duckduckgo and wikipedia', () => {
  assert.equal(searchSourcesAreApproved(), true)
  assert.equal(isApprovedSearchHost('api.duckduckgo.com'), true)
  assert.equal(isApprovedSearchHost('fr.wikipedia.org'), true)
  assert.equal(isApprovedSearchHost('www.google.com'), false)
  assert.equal(isApprovedSearchHost('www.instagram.com'), false)
  assert.equal(clientPayloadHasNoApiKey({ q: 'nazix' }), true)
  assert.equal(clientPayloadHasNoApiKey({ q: 'nazix', apiKey: 'sk-secret' }), true)
  assert.equal(billingKeys('fr').length, billingKeys('en').length)
  assert.equal(billingT('en', 'billing.banner').toLowerCase().includes('free'), true)
  assert.equal(billingT('fr', 'vis.personal'), 'Personnel')
})
