import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { featureAllowed, LAUNCH_FREE_MODE } from '../src/platform/plans.js'
import { searchProfiles, validateHandle } from '../src/platform/handles.js'
import { acceptInvite, createInviteState, declineInvite, inviteDecision, revokeInvite } from '../src/platform/invites.js'
import { filterByWorkspace, visibleItems, visibleMessages } from '../src/platform/isolation.js'
import {
  canPerformAdminOperation,
  canSeeGroupContent,
  hasWorkspaceAdminPowers,
  removeGroupMembershipOnly,
} from '../src/platform/permissions.js'

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

test('workspace isolation keeps other workspace rows out', () => {
  const rows = [
    { id: 'a', orgId: 'ws_a', title: 'A' },
    { id: 'b', orgId: 'ws_b', title: 'B' },
    { id: 'c', title: 'loose' },
  ]
  const onlyA = filterByWorkspace(rows, 'ws_a')
  assert.deepEqual(onlyA.map((row) => row.id), ['a'])
  assert.equal(filterByWorkspace(rows, 'ws_b').some((row) => row.orgId === 'ws_a'), false)
  assert.equal(filterByWorkspace(rows, '').length, 0)
})

test('handle validation blocks format and reserved words', () => {
  assert.equal(validateHandle('@NiatyJunior').ok, false)
  assert.equal(validateHandle('niatyjunior').ok, true)
  assert.equal(validateHandle('niatyjunior').handle, 'niatyjunior')
  assert.equal(validateHandle('Ab').reason, 'format')
  assert.equal(validateHandle('bad-name').reason, 'format')
  assert.equal(validateHandle('Admin').reason, 'reserved')
  assert.equal(validateHandle('nazix').reason, 'reserved')
  assert.equal(validateHandle('billing').reason, 'reserved')
})

test('invite token accept, expiry, revoke and max uses', () => {
  const now = Date.parse('2026-11-17T00:00:00.000Z')
  const tokenHash = sha256('raw-token-not-stored')
  const invite = createInviteState({
    id: tokenHash,
    workspaceId: 'ws_a',
    invitedBy: 'owner',
    role: 'member',
    tokenHash,
    expiresAt: new Date(now + 3 * 86400000).toISOString(),
    maxUses: 2,
    now,
  })
  assert.equal(invite.token, undefined)
  assert.equal(invite.tokenHash, tokenHash)

  const first = acceptInvite(invite, { now: now + 1000, userId: 'u1' })
  assert.equal(first.ok, true)
  assert.equal(first.invite.uses, 1)
  assert.equal(first.invite.status, 'pending')

  const second = acceptInvite(first.invite, { now: now + 2000, userId: 'u2' })
  assert.equal(second.ok, true)
  assert.equal(second.invite.uses, 2)
  assert.equal(second.invite.status, 'accepted')
  assert.equal(acceptInvite(second.invite, { now: now + 3000, userId: 'u3' }).reason, 'exhausted')

  const fresh = createInviteState({
    id: 'inv2',
    workspaceId: 'ws_a',
    invitedBy: 'owner',
    tokenHash: sha256('other'),
    expiresAt: new Date(now - 1000).toISOString(),
    maxUses: 10,
    now: now - 86400000,
  })
  assert.equal(inviteDecision(fresh, now), 'expired')
  assert.equal(acceptInvite(fresh, { now, userId: 'u1' }).reason, 'expired')

  const live = createInviteState({
    id: 'inv3',
    workspaceId: 'ws_a',
    invitedBy: 'owner',
    tokenHash: sha256('live'),
    expiresAt: new Date(now + 86400000).toISOString(),
    maxUses: 10,
    now,
  })
  const revoked = revokeInvite(live, now)
  assert.equal(revoked.ok, true)
  assert.equal(acceptInvite(revoked.invite, { now: now + 1, userId: 'u1' }).reason, 'revoked')
  const declined = declineInvite(
    createInviteState({
      id: 'inv4',
      workspaceId: 'ws_a',
      invitedBy: 'owner',
      tokenHash: sha256('nope'),
      expiresAt: new Date(now + 86400000).toISOString(),
      maxUses: 1,
      now,
    }),
    now,
  )
  assert.equal(declined.invite.status, 'declined')
  assert.equal(acceptInvite(declined.invite, { now: now + 1, userId: 'u9' }).reason, 'declined')
})

test('private group content stays hidden from a non-member', () => {
  const group = {
    id: 'g1',
    orgId: 'ws_a',
    visibility: 'private',
    sealed: true,
    memberIds: ['lead'],
    ownerId: 'lead',
  }
  const items = [
    { id: 'secret', orgId: 'ws_a', groupId: 'g1', title: 'private note' },
    { id: 'open', orgId: 'ws_a', title: 'workspace note' },
    { id: 'other', orgId: 'ws_b', groupId: 'g1', title: 'elsewhere' },
  ]
  const outsider = visibleItems(items, { id: 'member' }, {
    workspaceId: 'ws_a',
    workspaceRole: 'member',
    groups: [group],
    groupMembers: [{ groupId: 'g1', userId: 'lead', role: 'lead' }],
  })
  assert.deepEqual(outsider.map((item) => item.id), ['open'])
  const insider = visibleItems(items, { id: 'lead' }, {
    workspaceId: 'ws_a',
    workspaceRole: 'member',
    groups: [group],
    groupMembers: [{ groupId: 'g1', userId: 'lead', role: 'lead' }],
  })
  assert.ok(insider.some((item) => item.id === 'secret'))
  assert.equal(
    canSeeGroupContent({ id: 'owner' }, group, { workspaceRole: 'owner', groupRole: null }),
    false,
  )
  assert.equal(visibleMessages([{ id: 'm1', groupId: 'g1', body: 'hidden' }], { id: 'member' }, group, {
    workspaceRole: 'member',
    groupRole: null,
  }).length, 0)
  const removed = removeGroupMembershipOnly(
    {
      workspaceMembers: [{ orgId: 'ws_a', userId: 'lead' }],
      groupMembers: [
        { groupId: 'g1', userId: 'lead', role: 'lead' },
        { groupId: 'g2', userId: 'lead', role: 'member' },
      ],
    },
    'g1',
    'lead',
  )
  assert.equal(removed.workspaceMembers.length, 1)
  assert.equal(removed.groupMembers.length, 1)
  assert.equal(removed.groupMembers[0].groupId, 'g2')
})

test('a member cannot perform workspace admin operations', () => {
  assert.equal(canPerformAdminOperation('member', 'invite'), false)
  assert.equal(canPerformAdminOperation('member', 'changeRole'), false)
  assert.equal(canPerformAdminOperation('member', 'deleteWorkspace'), false)
  assert.equal(canPerformAdminOperation('guest', 'invite'), false)
  assert.equal(canPerformAdminOperation('admin', 'invite'), true)
  assert.equal(canPerformAdminOperation('admin', 'deleteWorkspace'), false)
  assert.equal(canPerformAdminOperation('owner', 'deleteWorkspace'), true)
  assert.equal(hasWorkspaceAdminPowers({ workspaceRole: 'member', groupRole: 'admin' }), false)
  assert.equal(canPerformAdminOperation('admin', 'invite') && hasWorkspaceAdminPowers({ workspaceRole: 'member', groupRole: 'admin' }), false)
})

test('launch free mode does not block a feature', () => {
  assert.equal(LAUNCH_FREE_MODE, true)
  assert.equal(featureAllowed('notes'), true)
  assert.equal(featureAllowed('chat'), true)
  assert.equal(featureAllowed('export'), true)
  assert.equal(featureAllowed('calendar'), true)
  const server = readFileSync(new URL('../server/ai-http.mjs', import.meta.url), 'utf8')
  const plans = readFileSync(new URL('../src/platform/plans.js', import.meta.url), 'utf8')
  const flag = (source) => source.match(/LAUNCH_FREE_MODE = (true|false)/)[1]
  assert.equal(flag(plans), 'true')
  assert.equal(flag(server), flag(plans))
})

test('handle search omits email', () => {
  const cards = searchProfiles(
    [
      {
        id: 'u1',
        handle: 'niatyjunior',
        fullName: 'Niaty Junior',
        email: 'secret@example.com',
        passwordHash: 'nope',
        bio: 'Builder',
        discoverable: true,
      },
      {
        id: 'u2',
        handle: 'hidden_one',
        email: 'hidden@example.com',
        discoverable: false,
      },
    ],
    'niaty',
  )
  assert.equal(cards.length, 1)
  assert.equal(cards[0].handle, 'niatyjunior')
  assert.equal(cards[0].displayName, 'Niaty Junior')
  assert.equal(cards[0].bio, 'Builder')
  assert.equal('email' in cards[0], false)
  assert.equal('passwordHash' in cards[0], false)
  assert.equal(JSON.stringify(cards).includes('secret@example.com'), false)
  assert.equal(JSON.stringify(cards).includes('hidden@example.com'), false)
})
