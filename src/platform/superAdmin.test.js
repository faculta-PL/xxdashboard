import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { applyLocalAccountSeed, LOCAL_SEEDED_USERS } from './localAccounts.js'
import {
  SUPER_ADMIN_EMAIL,
  buildPlatformDirectory,
  isPlatformAdmin,
  isPlatformAdminEmail,
} from './superAdmin.js'
import { SUPER_ADMIN_EMAIL as exportedEmail, isPlatformAdmin as exportedCheck } from './index.js'

const root = new URL('../../', import.meta.url)

test('only facultamalika@gmail.com is the platform super admin', () => {
  assert.equal(SUPER_ADMIN_EMAIL, 'facultamalika@gmail.com')
  assert.equal(exportedEmail, SUPER_ADMIN_EMAIL)
  assert.equal(exportedCheck, isPlatformAdmin)
  assert.equal(isPlatformAdminEmail('  FacultaMalika@gmail.com '), true)
  assert.equal(isPlatformAdmin({ email: 'facultamalika@gmail.com', role: 'Membre' }), true)
  assert.equal(isPlatformAdmin({ email: 'admin@example.com', role: 'Administrateur' }), false)
  assert.equal(isPlatformAdmin({ email: 'owner@nazix.app', role: 'owner' }), false)
  assert.equal(isPlatformAdmin({ role: 'Administrateur' }), false)
  assert.equal(isPlatformAdmin({ email: 'testeur@nazix.app', role: 'Administrateur' }), false)
  assert.equal(isPlatformAdmin({ email: 'testeur@nazix.app', role: 'Membre' }), false)
  assert.equal(isPlatformAdmin(null), false)
})

test('testeur@nazix.app is a normal local member and not platform admin', () => {
  const seed = LOCAL_SEEDED_USERS.find((user) => user.email === 'testeur@nazix.app')
  assert.ok(seed)
  assert.equal(seed.fullName, 'Testeur')
  assert.equal(seed.handle, 'testeur')
  assert.equal(seed.role, 'Membre')
  assert.equal(seed.status, 'active')
  assert.match(seed.passwordHash, /^[a-f0-9]{64}$/)
  assert.equal(isPlatformAdmin(seed), false)
  const source = readFileSync(new URL('./localAccounts.js', import.meta.url), 'utf8')
  assert.equal(source.includes('Nazix-Test'), false)
  const db = { xx_users: {}, xx_org_members: { keep: { id: 'keep', orgId: 'org_other', userId: 'someone' } } }
  assert.equal(applyLocalAccountSeed(db), true)
  assert.equal(db.xx_users[seed.id].email, 'testeur@nazix.app')
  assert.equal(Object.keys(db.xx_org_members).join(','), 'keep')
  db.xx_users.other = { id: 'other', email: 'stranger@example.com', passwordHash: 'abc', role: 'Membre' }
  applyLocalAccountSeed(db)
  assert.equal(db.xx_users.other.passwordHash, 'abc')
})

test('the platform directory shows structure and hides private messages', () => {
  const actor = { id: 'sa', email: SUPER_ADMIN_EMAIL }
  const stranger = { id: 'tu', email: 'testeur@nazix.app', role: 'Administrateur' }
  const state = {
    xx_users: {
      sa: { id: 'sa', email: SUPER_ADMIN_EMAIL, fullName: 'Malika', handle: 'malika', passwordHash: 'secret', status: 'active' },
      tu: { id: 'tu', email: 'testeur@nazix.app', fullName: 'Testeur', handle: 'testeur', role: 'Membre', passwordHash: 'hidden' },
    },
    xx_orgs: { org_a: { id: 'org_a', name: 'Atelier' } },
    xx_org_members: { m1: { id: 'm1', orgId: 'org_a', userId: 'tu', email: 'testeur@nazix.app', role: 'member' } },
    xx_groups: { g1: { id: 'g1', name: 'Équipe nord', orgId: 'org_a', memberIds: ['tu'] } },
    xx_group_members: { gm: { id: 'gm', groupId: 'g1', userId: 'sa', status: 'active' } },
    xx_messages: { msg: { id: 'msg', groupId: 'g1', body: 'secret-message-body', text: 'also-secret' } },
    xx_invitations: {
      inv: { id: 'inv', email: 'ada@example.com', handle: 'ada', status: 'pending', role: 'member', workspaceId: 'org_a', tokenHash: 'hash', token: 'raw' },
    },
  }
  assert.equal(buildPlatformDirectory(state, stranger), null)
  const directory = buildPlatformDirectory(state, actor)
  const encoded = JSON.stringify(directory)
  assert.equal(encoded.includes('secret-message-body'), false)
  assert.equal(encoded.includes('also-secret'), false)
  assert.equal(encoded.includes('passwordHash'), false)
  assert.equal(encoded.includes('tokenHash'), false)
  assert.equal(encoded.includes('"token"'), false)
  assert.equal(directory.users.map((user) => user.email).sort().join(','), 'facultamalika@gmail.com,testeur@nazix.app')
  assert.equal(directory.orgs[0].name, 'Atelier')
  assert.equal(directory.groups[0].name, 'Équipe nord')
  assert.deepEqual(
    directory.groups[0].members.map((member) => member.email).sort(),
    ['facultamalika@gmail.com', 'testeur@nazix.app'],
  )
  assert.equal(directory.invitations[0].email, 'ada@example.com')
  assert.equal(directory.orgMembers[0].handle, 'testeur')
})

test('firestore and storage rules grant platform admin to one email', () => {
  const firestore = readFileSync(new URL('firestore.rules', root), 'utf8')
  const storage = readFileSync(new URL('storage.rules', root), 'utf8')
  for (const rules of [firestore, storage]) {
    assert.match(rules, /authEmail\(\) == 'facultamalika@gmail.com'/)
    assert.equal(/admin@example\.com/.test(rules), false)
    assert.equal(/role\s*==\s*'Administrateur'/.test(rules), false)
  }
  assert.match(firestore, /allow list: if isAdmin\(\);/)
  assert.equal(firestore.includes('allow read, write: if true'), false)
})
