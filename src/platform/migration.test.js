import assert from 'node:assert/strict'
import test from 'node:test'

import { inviteAllowsAccept } from './contract.js'
import {
  membershipFromInvite,
  planMigration,
} from './MIGRATION.js'
import {
  canReadScopedContent,
  passesOrganizationIsolation,
  privateTeamContentHidden,
} from './permissions.js'

test('each organization receives exactly one general space', () => {
  const orgs = [
    { id: 'org_a', name: 'Atelier', ownerId: 'u1', createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'org_b', name: 'Studio', ownerId: 'u2' },
  ]
  const first = planMigration({ xx_orgs: { org_a: orgs[0], org_b: orgs[1] }, xx_spaces: {}, xx_notes: {}, xx_groups: {} }, 'fr')
  const general = first.created.filter((space) => space.kind === 'general')
  assert.equal(general.length, 2)
  assert.equal(general.filter((space) => space.organizationId === 'org_a').length, 1)
  assert.equal(general[0].name, 'Espace général')
  assert.equal(general[0].id, 'spc_org_a_general')

  const again = planMigration(
    {
      xx_orgs: { org_a: orgs[0], org_b: orgs[1] },
      xx_spaces: Object.fromEntries(first.spaces.map((space) => [space.id, space])),
      xx_notes: {},
      xx_groups: {},
    },
    'en',
  )
  assert.equal(again.created.length, 0)
  assert.equal(again.spaces.filter((space) => space.kind === 'general').length, 2)
  assert.equal(again.spaces.filter((space) => space.kind === 'extra').length, 0)
})

test('existing notes keep orgId and land in the general space', () => {
  const org = { id: 'org_a', name: 'Atelier', ownerId: 'u1' }
  const note = { id: 'n1', orgId: 'org_a', title: 'Ancienne note', ownerId: 'u1' }
  const { patches } = planMigration({
    xx_orgs: { org_a: org },
    xx_spaces: {},
    xx_notes: { n1: note },
    xx_ideas: {},
    xx_projects: {},
    xx_events: {},
    xx_groups: {},
  })
  const moved = patches.find((patch) => patch.col === 'xx_notes' && patch.id === 'n1')
  assert.ok(moved)
  assert.equal(moved.value.orgId, 'org_a')
  assert.equal(moved.value.organizationId, 'org_a')
  assert.equal(moved.value.spaceId, 'spc_org_a_general')
  assert.equal(moved.value.title, 'Ancienne note')
})

test('a member of org A does not see org B', () => {
  const rowA = { id: 'a', orgId: 'org_a', organizationId: 'org_a' }
  const rowB = { id: 'b', orgId: 'org_b', organizationId: 'org_b' }
  assert.equal(passesOrganizationIsolation(['org_a'], rowA), true)
  assert.equal(passesOrganizationIsolation(['org_a'], rowB), false)
  assert.equal(passesOrganizationIsolation(['org_a'], { id: 'personal', title: 'Mine' }), true)
})

test('private team content stays hidden from non-members', () => {
  const team = {
    id: 'team_1',
    orgId: 'org_a',
    organizationId: 'org_a',
    type: 'private',
    visibility: 'private',
    sealed: true,
    ownerId: 'member',
    memberIds: ['member'],
  }
  const note = { id: 'secret', orgId: 'org_a', organizationId: 'org_a', groupId: 'team_1', spaceId: 'spc_org_a_general', title: 'Secret' }
  assert.equal(privateTeamContentHidden({ id: 'owner' }, team), true)
  assert.equal(privateTeamContentHidden({ id: 'member' }, team), false)
  assert.equal(canReadScopedContent({ id: 'owner' }, note, { team_1: team }, 'owner'), false)
  assert.equal(canReadScopedContent({ id: 'member' }, note, { team_1: team }, 'member'), true)
  const outsider = { id: 'other', orgId: 'org_b', organizationId: 'org_b', title: 'Ailleurs' }
  assert.equal(canReadScopedContent({ id: 'member' }, outsider, {}, ''), false)
})

test('an invitation still requires an explicit accept', () => {
  const later = new Date('2026-12-01T00:00:00.000Z')
  const invite = {
    status: 'pending',
    uses: 0,
    maxUses: 1,
    expiresAt: '2026-12-31T00:00:00.000Z',
    workspaceId: 'org_a',
    organizationId: 'org_a',
    role: 'member',
    tokenHash: 'hash-only',
  }
  assert.equal(inviteAllowsAccept(invite, later), true)
  assert.equal(membershipFromInvite(invite, false, later), null)
  const joined = membershipFromInvite(invite, true, later)
  assert.equal(joined.orgId, 'org_a')
  assert.equal(joined.status, 'active')
  assert.equal(membershipFromInvite({ ...invite, status: 'accepted' }, true, later), null)
  assert.equal('token' in invite, false)
})
