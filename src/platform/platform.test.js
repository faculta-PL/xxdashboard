import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import * as contract from './contract.js'
import {
  HANDLE_RE,
  INVITE_STATUSES,
  featureEnabled,
  hashToken,
  inviteAllowsAccept,
  searchPublicUser,
  validateHandle,
} from './contract.js'
import { LAUNCH_FREE_MODE, PRODUCT_FEATURES } from './flags.js'
import {
  PLAN_SEED,
  limitFor,
  planAllowsFeature,
  unknownSeedFeatures,
} from './plans.js'
import {
  can,
  filterByWorkspace,
  filterVisibleGroups,
  isGroupVisible,
  passesWorkspaceIsolation,
} from './permissions.js'
import * as platform from './index.js'

const CONTRACT_EXPORTS = [
  'HANDLE_RE',
  'RESERVED_HANDLES',
  'validateHandle',
  'hashToken',
  'INVITE_STATUSES',
  'inviteAllowsAccept',
  'searchPublicUser',
  'LAUNCH_FREE_MODE',
  'featureEnabled',
]

const root = new URL('../../', import.meta.url)
const schema = readFileSync(new URL('prisma/schema.prisma', root), 'utf8')
const migration = readFileSync(new URL('prisma/migrations/0001_init/migration.sql', root), 'utf8')

const TABLES = [
  'users',
  'user_settings',
  'workspaces',
  'workspace_members',
  'groups',
  'group_members',
  'invitations',
  'projects',
  'project_members',
  'notes',
  'ideas',
  'note_shares',
  'conversations',
  'conversation_members',
  'messages',
  'events',
  'event_participants',
  'plans',
  'plan_features',
  'subscriptions',
  'invoices',
  'transactions',
  'notifications',
  'audit_logs',
]

function actor(partial) {
  return {
    id: 'user',
    memberships: [],
    groupMemberships: [],
    conversationMemberships: [],
    ...partial,
  }
}

test('contract exports the shared surface', () => {
  assert.deepEqual(Object.keys(contract).sort(), [...CONTRACT_EXPORTS].sort())
  assert.equal(platform.HANDLE_RE, contract.HANDLE_RE)
  assert.equal(platform.validateHandle, contract.validateHandle)
  assert.equal(platform.hashToken, contract.hashToken)
  assert.equal(platform.featureEnabled, contract.featureEnabled)
  assert.equal(platform.LAUNCH_FREE_MODE, true)
  assert.equal(String(HANDLE_RE), String(/^[a-z0-9_]{3,20}$/))
  assert.deepEqual(INVITE_STATUSES, ['pending', 'accepted', 'declined', 'expired', 'revoked'])
})

test('handles are normalized, reserved names are rejected', () => {
  assert.deepEqual(validateHandle('  Ab_1 '), { ok: true, handle: 'ab_1', error: null, reason: 'ok' })
  assert.equal(validateHandle('ada').ok, true)
  assert.deepEqual(validateHandle(''), { ok: false, handle: '', error: 'required', reason: 'format' })
  assert.deepEqual(validateHandle('   '), { ok: false, handle: '', error: 'required', reason: 'format' })
  assert.equal(validateHandle('ab').error, 'invalid')
  assert.equal(validateHandle('bad-name').error, 'invalid')
  assert.equal(validateHandle('a'.repeat(21)).error, 'invalid')
  assert.equal(validateHandle('has space').error, 'invalid')
  assert.equal(validateHandle('ADMIN').error, 'reserved')
  assert.equal(validateHandle('Nazix').error, 'reserved')
  assert.equal(validateHandle('___').ok, true)
})

test('invite accept respects status, expiry, revoke, and maxUses', () => {
  const now = new Date('2026-11-17T12:00:00.000Z')
  const later = '2026-11-18T12:00:00.000Z'
  const earlier = '2026-11-17T11:00:00.000Z'
  assert.equal(inviteAllowsAccept({ status: 'pending', expiresAt: later, uses: 0, maxUses: 1 }, now), true)
  assert.equal(inviteAllowsAccept({ status: 'pending', expiresAt: earlier, uses: 0, maxUses: 1 }, now), false)
  assert.equal(inviteAllowsAccept({ status: 'pending', expiresAt: now.toISOString(), uses: 0, maxUses: 1 }, now), false)
  assert.equal(inviteAllowsAccept({ status: 'expired', expiresAt: later, uses: 0, maxUses: 1 }, now), false)
  assert.equal(inviteAllowsAccept({ status: 'revoked', expiresAt: later, uses: 0, maxUses: 1 }, now), false)
  assert.equal(inviteAllowsAccept({ status: 'declined', expiresAt: later, uses: 0, maxUses: 1 }, now), false)
  assert.equal(inviteAllowsAccept({ status: 'accepted', expiresAt: later, uses: 1, maxUses: 2 }, now), false)
  assert.equal(inviteAllowsAccept({ status: 'pending', expiresAt: later, uses: 2, maxUses: 2 }, now), false)
  assert.equal(inviteAllowsAccept({ status: 'pending', expiresAt: later, uses: 1, maxUses: 2 }, now), true)
  assert.equal(inviteAllowsAccept({ status: 'pending', uses: 40, maxUses: null }, now), true)
  assert.equal(inviteAllowsAccept({ status: 'pending', uses: 0, maxUses: 0 }, now), false)
  assert.equal(inviteAllowsAccept({ status: 'pending' }, now), true)
})

test('hashToken is sha256 hex, including the browser fallback', () => {
  const raw = 'invite-token'
  const expected = createHash('sha256').update(raw, 'utf8').digest('hex')
  assert.equal(hashToken(raw), expected)
  assert.equal(expected.length, 64)
  const original = process.getBuiltinModule
  process.getBuiltinModule = () => null
  try {
    assert.equal(hashToken(raw), expected)
    assert.equal(hashToken(''), createHash('sha256').update('', 'utf8').digest('hex'))
  } finally {
    process.getBuiltinModule = original
  }
})

test('public search omits email and credentials', () => {
  const email = 'ada@secret.test'
  const result = searchPublicUser({
    id: 'u1',
    handle: 'ada',
    displayName: 'Ada',
    email,
    passwordHash: 'secret-hash',
    tokenHash: 'abc',
  })
  assert.equal(result.email, undefined)
  assert.equal(result.passwordHash, undefined)
  assert.equal(result.tokenHash, undefined)
  assert.equal(result.handle, 'ada')
  assert.equal(JSON.stringify(result).includes(email), false)
  assert.equal(searchPublicUser(null), null)
})

test('launch free mode does not block features the free plan omits', () => {
  assert.equal(LAUNCH_FREE_MODE, true)
  assert.equal(planAllowsFeature('free', 'invite'), false)
  assert.equal(planAllowsFeature('free', 'audit'), false)
  assert.equal(planAllowsFeature('business', 'invite'), true)
  assert.equal(featureEnabled('invite'), true)
  assert.equal(featureEnabled('audit'), true)
  for (const key of PRODUCT_FEATURES) assert.equal(featureEnabled(key), true, key)
  assert.equal(featureEnabled('not-yet-a-module'), true)
  assert.equal(featureEnabled(''), false)
  assert.equal(featureEnabled(null), false)
  assert.equal(limitFor('free', 'members'), 1)
  assert.equal(limitFor('enterprise', 'workspaces'), -1)
  assert.deepEqual(unknownSeedFeatures(PRODUCT_FEATURES), [])
  const flags = readFileSync(new URL('./flags.js', import.meta.url), 'utf8')
  const permissions = readFileSync(new URL('./permissions.js', import.meta.url), 'utf8')
  assert.equal(flags.includes('storageBytes'), false)
  assert.equal(flags.includes('priceCents'), false)
  assert.equal(permissions.includes('LAUNCH_FREE_MODE'), false)
  assert.equal(permissions.includes('storageBytes'), false)
})

test('workspace isolation drops other workspaces', () => {
  const member = actor({
    id: 'mem',
    memberships: [{ workspaceId: 'w1', role: 'member' }],
  })
  const rows = [
    { id: 'n1', workspaceId: 'w1' },
    { id: 'n2', workspaceId: 'w2' },
    { id: 'loose' },
  ]
  assert.deepEqual(filterByWorkspace(member, rows).map((row) => row.id), ['n1'])
  assert.equal(passesWorkspaceIsolation(member, rows[1]), false)
  assert.equal(
    can(member, 'read', { type: 'note', id: 'n2', workspaceId: 'w2', visibility: 'workspace', ownerId: 'mem' }),
    false,
  )
  assert.equal(can(member, 'admin', { type: 'workspace', workspaceId: 'w2' }), false)
  const leaked = actor({
    id: 'mem',
    memberships: [{ workspaceId: 'w1', role: 'member' }],
    groupMemberships: [{ groupId: 'g-secret', workspaceId: 'w2', role: 'lead' }],
  })
  assert.equal(
    isGroupVisible(leaked, { id: 'g-secret', workspaceId: 'w2', visibility: 'private' }),
    false,
  )
})

test('guests read only explicitly shared items', () => {
  const guest = actor({
    id: 'gst',
    memberships: [{ workspaceId: 'w1', role: 'guest' }],
  })
  const shared = {
    type: 'note',
    id: 'n1',
    workspaceId: 'w1',
    visibility: 'private',
    ownerId: 'mem',
    shares: [{ userId: 'gst', permission: 'read' }],
  }
  const team = {
    type: 'note',
    id: 'n2',
    workspaceId: 'w1',
    visibility: 'workspace',
    ownerId: 'mem',
    shares: [],
  }
  assert.equal(can(guest, 'read', shared), true)
  assert.equal(can(guest, 'update', shared), false)
  assert.equal(can(guest, 'read', team), false)
  assert.equal(can(guest, 'create', { type: 'note', workspaceId: 'w1' }), false)
  assert.equal(can(guest, 'invite', { type: 'invitation', workspaceId: 'w1' }), false)
})

test('members cannot invite or change roles; admins can', () => {
  const member = actor({
    id: 'mem',
    memberships: [{ workspaceId: 'w1', role: 'member' }],
    groupMemberships: [{ groupId: 'g1', workspaceId: 'w1', role: 'admin' }],
  })
  const admin = actor({
    id: 'adm',
    memberships: [{ workspaceId: 'w1', role: 'admin' }],
  })
  const owner = actor({
    id: 'own',
    memberships: [{ workspaceId: 'w1', role: 'owner' }],
  })
  assert.equal(can(member, 'invite', { type: 'invitation', workspaceId: 'w1' }), false)
  assert.equal(can(member, 'invite', { type: 'workspace', workspaceId: 'w1' }), false)
  assert.equal(can(member, 'admin', { type: 'workspace_member', workspaceId: 'w1', targetRole: 'member' }), false)
  assert.equal(can(member, 'admin', { type: 'workspace', workspaceId: 'w1' }), false)
  assert.equal(can(admin, 'invite', { type: 'invitation', workspaceId: 'w1' }), true)
  assert.equal(can(admin, 'admin', { type: 'workspace_member', workspaceId: 'w1', targetRole: 'member' }), true)
  assert.equal(can(admin, 'admin', { type: 'workspace_member', workspaceId: 'w1', targetRole: 'owner' }), false)
  assert.equal(can(owner, 'admin', { type: 'workspace_member', workspaceId: 'w1', targetRole: 'owner' }), true)
  assert.equal(can(owner, 'delete', { type: 'workspace', workspaceId: 'w1' }), true)
  assert.equal(can(admin, 'delete', { type: 'workspace', workspaceId: 'w1' }), false)
  assert.equal(can(member, 'create', { type: 'note', workspaceId: 'w1' }), true)
  assert.equal(
    can(member, 'update', { type: 'note', workspaceId: 'w1', ownerId: 'mem', visibility: 'private' }),
    true,
  )
  assert.equal(
    can(member, 'update', { type: 'note', workspaceId: 'w1', ownerId: 'other', visibility: 'workspace' }),
    false,
  )
  assert.equal(
    can(member, 'update', {
      type: 'note',
      workspaceId: 'w1',
      ownerId: 'other',
      visibility: 'private',
      shares: [{ userId: 'mem', permission: 'edit' }],
    }),
    true,
  )
  assert.equal(
    can(admin, 'update', { type: 'note', workspaceId: 'w1', ownerId: 'other', visibility: 'private' }),
    true,
  )
})

test('a group admin is not a workspace admin, and private groups stay hidden', () => {
  const groupAdmin = actor({
    id: 'mem',
    memberships: [{ workspaceId: 'w1', role: 'member' }],
    groupMemberships: [{ groupId: 'g1', workspaceId: 'w1', role: 'admin' }],
  })
  assert.equal(can(groupAdmin, 'admin', { type: 'group', id: 'g1', workspaceId: 'w1', visibility: 'private' }), true)
  assert.equal(can(groupAdmin, 'invite', { type: 'group', id: 'g1', workspaceId: 'w1', visibility: 'private' }), true)
  assert.equal(can(groupAdmin, 'admin', { type: 'workspace', workspaceId: 'w1' }), false)
  assert.equal(can(groupAdmin, 'invite', { type: 'workspace', workspaceId: 'w1' }), false)

  const workspaceAdmin = actor({
    id: 'adm',
    memberships: [{ workspaceId: 'w1', role: 'admin' }],
  })
  const groups = [
    { id: 'pub', workspaceId: 'w1', visibility: 'workspace' },
    { id: 'sec', workspaceId: 'w1', visibility: 'private' },
    { id: 'else', workspaceId: 'w2', visibility: 'workspace' },
  ]
  assert.deepEqual(filterVisibleGroups(workspaceAdmin, groups).map((group) => group.id), ['pub'])
  assert.equal(isGroupVisible(workspaceAdmin, groups[1]), false)
  assert.equal(can(workspaceAdmin, 'read', { type: 'group', id: 'sec', workspaceId: 'w1', visibility: 'private' }), false)

  const observer = actor({
    id: 'obs',
    memberships: [{ workspaceId: 'w1', role: 'member' }],
    groupMemberships: [{ groupId: 'sec', workspaceId: 'w1', role: 'observer' }],
  })
  assert.deepEqual(filterVisibleGroups(observer, groups).map((group) => group.id), ['pub', 'sec'])
  const message = {
    type: 'message',
    workspaceId: 'w1',
    groupId: 'sec',
    groupVisibility: 'private',
    conversationId: 'c1',
  }
  assert.equal(can(observer, 'read', message), true)
  assert.equal(can(observer, 'create', message), false)
  const poster = actor({
    id: 'mem',
    memberships: [{ workspaceId: 'w1', role: 'member' }],
    groupMemberships: [{ groupId: 'sec', workspaceId: 'w1', role: 'member' }],
  })
  assert.equal(can(poster, 'create', message), true)
  assert.equal(can(workspaceAdmin, 'create', message), false)

  const guest = actor({
    id: 'gst',
    memberships: [{ workspaceId: 'w1', role: 'guest' }],
  })
  assert.equal(isGroupVisible(guest, groups[0]), false)
  assert.equal(
    isGroupVisible(guest, { ...groups[0], shares: [{ userId: 'gst', permission: 'read' }] }),
    true,
  )
})

test('direct messages stay inside the conversation', () => {
  const admin = actor({
    id: 'adm',
    memberships: [{ workspaceId: 'w1', role: 'admin' }],
  })
  const message = { type: 'message', workspaceId: 'w1', conversationId: 'dm1', authorId: 'mem' }
  assert.equal(can(admin, 'read', message), false)
  const member = actor({
    id: 'mem',
    memberships: [{ workspaceId: 'w1', role: 'member' }],
    conversationMemberships: [{ conversationId: 'dm1' }],
  })
  assert.equal(can(member, 'read', message), true)
  assert.equal(can(member, 'create', { ...message, authorId: 'mem' }), true)
})

test('schema is the source of truth for every entity', () => {
  for (const table of TABLES) {
    assert.match(schema, new RegExp(`@@map\\("${table}"\\)`))
    assert.match(migration, new RegExp(`CREATE TABLE "${table}"`))
  }
  assert.match(schema, /handle\s+String\s+@unique/)
  assert.match(migration, /CREATE UNIQUE INDEX "users_handle_key"/)
  assert.match(schema, /tokenHash\s+String\s+@unique/)
  assert.match(migration, /CREATE UNIQUE INDEX "invitations_token_hash_key"/)
  assert.equal(migration.includes('REFERENCES "workspace_members"'), false)
  assert.match(
    migration,
    /workspace_members_workspace_id_fkey" FOREIGN KEY \("workspace_id"\) REFERENCES "workspaces"\("id"\) ON DELETE CASCADE/,
  )
  assert.match(
    migration,
    /workspaces_created_by_id_fkey" FOREIGN KEY \("created_by_id"\) REFERENCES "users"\("id"\) ON DELETE SET NULL/,
  )
  const workspaceBlock = schema.slice(schema.indexOf('model Workspace {'), schema.indexOf('model WorkspaceMember'))
  assert.match(workspaceBlock, /onDelete:\s*SetNull/)
  assert.doesNotMatch(workspaceBlock, /onDelete:\s*Cascade/)

  const indexed = [
    ['workspace_members', 'workspace_id'],
    ['workspace_members', 'user_id'],
    ['groups', 'workspace_id'],
    ['group_members', 'workspace_id'],
    ['group_members', 'user_id'],
    ['invitations', 'workspace_id'],
    ['invitations', 'token_hash'],
    ['projects', 'workspace_id'],
    ['notes', 'workspace_id'],
    ['notes', 'author_id'],
    ['ideas', 'workspace_id'],
    ['note_shares', 'workspace_id'],
    ['conversations', 'workspace_id'],
    ['messages', 'workspace_id'],
    ['messages', 'author_id'],
    ['events', 'workspace_id'],
    ['subscriptions', 'workspace_id'],
    ['invoices', 'workspace_id'],
    ['transactions', 'workspace_id'],
    ['notifications', 'workspace_id'],
    ['audit_logs', 'workspace_id'],
    ['audit_logs', 'actor_id'],
  ]
  for (const [table, column] of indexed) {
    assert.match(migration, new RegExp(`ON "${table}"\\([^)]*"${column}"`), `${table}.${column}`)
  }

  for (const plan of PLAN_SEED) {
    assert.match(migration, new RegExp(`'${plan.id}', '${plan.code}'`))
    assert.match(migration, new RegExp(`"workspaces":${plan.limits.workspaces}`))
    for (const feature of plan.features) {
      assert.match(migration, new RegExp(`'${plan.id}', '${feature}'`))
    }
  }
  assert.match(readFileSync(new URL('./plans.js', import.meta.url), 'utf8'), /Seed rows/)
  assert.match(readFileSync(new URL('./index.js', import.meta.url), 'utf8'), /HANDOFF/)
})
