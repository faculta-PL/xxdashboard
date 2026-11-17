import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readMirroredActiveId, writeActiveMirror } from './active.js'
import { createSpacesEngine } from './engine.js'
import { normalizeEmoji, workspaceInitials } from './model.js'
import {
  canSeeGroupContent,
  canSeeItem,
  groupRole,
  guestCanReadItem,
  homeSummary,
  removeGroupMembershipOnly,
  workspaceRole,
} from './permissions.js'

function memoryStorage() {
  const map = new Map()
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
  }
}

function harness() {
  let n = 0
  const db = {
    xx_orgs: {},
    xx_org_members: {},
    xx_groups: {},
    xx_group_members: {},
    xx_notes: {},
    xx_messages: {},
    xx_users: {},
    activeOrgId: '',
  }
  const storage = memoryStorage()
  const engine = createSpacesEngine({
    getDb: () => db,
    persist: async (col, id, value) => {
      if (!db[col]) db[col] = {}
      db[col][id] = value
    },
    remove: async (col, id) => {
      if (db[col]) delete db[col][id]
    },
    newId: (prefix) => `${prefix}_${++n}`,
    now: () => '2026-11-17T12:00:00.000Z',
    getActive: () => db.activeOrgId || '',
    setActive: (id) => {
      db.activeOrgId = id || ''
      writeActiveMirror(storage, id || '')
    },
  })
  const user = (id, email, fullName = id) => {
    const row = { id, email, fullName }
    db.xx_users[id] = row
    return row
  }
  return { db, storage, engine, user }
}

describe('workspaces share the org id', () => {
  it('does not invent a second tenant and mirrors the active id', async () => {
    const { db, storage, engine, user } = harness()
    const alice = user('alice', 'alice@nazix.test', 'Alice Martin')
    assert.deepEqual(homeSummary(db, alice), { spaces: [], invites: [] })
    const first = await engine.createWorkspace(alice, { name: 'Atelier Nord', description: 'Notes', emoji: '🌿' })
    const second = await engine.createWorkspace(alice, { name: 'Atelier Sud' })
    assert.equal(first.id, db.xx_orgs[first.id].id)
    assert.equal(second.ownerId, alice.id)
    assert.equal(db.xx_workspaces, undefined)
    assert.equal(storage.getItem('nazix_active_org'), second.id)
    assert.equal(storage.getItem('nazix_active_workspace'), second.id)
    assert.equal(engine.home(alice).spaces.length, 2)
    db.xx_notes.a = { id: 'a', orgId: first.id, ownerId: alice.id, title: 'Nord', visibility: 'Équipe', shares: [] }
    db.xx_notes.b = { id: 'b', orgId: second.id, ownerId: alice.id, title: 'Sud', visibility: 'Équipe', shares: [] }
    assert.deepEqual(engine.visibleNotes(alice, first.id).map((note) => note.id), ['a'])
    assert.deepEqual(engine.visibleNotes(alice, second.id).map((note) => note.id), ['b'])
    assert.equal(workspaceInitials('Atelier Nord'), 'AN')
    assert.throws(() => normalizeEmoji('s3://bucket/logo.png'), (err) => err.code === 'emoji')
  })

  it('fills the workspace mirror from the org key', () => {
    const storage = memoryStorage()
    storage.setItem('nazix_active_org', 'org_9')
    assert.equal(readMirroredActiveId(storage), 'org_9')
    assert.equal(storage.getItem('nazix_active_workspace'), 'org_9')
  })
})

describe('guest and workspace isolation', () => {
  it('hides another workspace and limits guests to explicit shares', async () => {
    const { db, engine, user } = harness()
    const alice = user('alice', 'alice@nazix.test')
    const bob = user('bob', 'bob@nazix.test')
    const guest = user('guest', 'guest@nazix.test')
    const alpha = await engine.createWorkspace(alice, { name: 'Alpha' })
    const beta = await engine.createWorkspace(bob, { name: 'Beta' })
    db.xx_notes.team = {
      id: 'team',
      orgId: alpha.id,
      ownerId: alice.id,
      title: 'Équipe',
      visibility: 'Équipe',
      shares: [],
    }
    db.xx_notes.shared = {
      id: 'shared',
      orgId: alpha.id,
      ownerId: alice.id,
      title: 'Pour l’invité',
      visibility: 'Privée',
      shares: [{ userId: guest.id, permission: 'Lecture' }],
    }
    db.xx_notes.own = { id: 'own', orgId: alpha.id, ownerId: guest.id, title: 'Moi', visibility: 'Privée', shares: [] }
    db.xx_notes.beta = { id: 'beta', orgId: beta.id, ownerId: bob.id, title: 'Ailleurs', visibility: 'Équipe', shares: [] }
    assert.equal(canSeeItem(db, bob, db.xx_notes.team), false)
    assert.equal(engine.visibleNotes(bob, alpha.id).length, 0)
    await engine.inviteMember(alice, { orgId: alpha.id, email: guest.email, role: 'guest' })
    assert.equal(engine.home(guest).invites.length, 1)
    assert.equal(engine.home(guest).spaces.length, 0)
    await engine.acceptInvite(guest, alpha.id)
    assert.equal(workspaceRole(db, guest.id, alpha.id), 'guest')
    assert.equal(guestCanReadItem(guest, db.xx_notes.team), false)
    assert.equal(canSeeItem(db, guest, db.xx_notes.team), false)
    assert.equal(canSeeItem(db, guest, db.xx_notes.shared), true)
    assert.equal(canSeeItem(db, guest, db.xx_notes.own), true)
    assert.equal(canSeeItem(db, guest, db.xx_notes.beta), false)
    await assert.rejects(() => engine.createGroup(guest, { orgId: alpha.id, name: 'Nope', type: 'internal' }), (err) => err.code === 'permission')
    await assert.rejects(() => engine.archiveWorkspace(guest, alpha.id), (err) => err.code === 'permission')
  })
})

describe('group privacy and roles', () => {
  it('does not leak private notes or chat, and keeps workspace membership', async () => {
    const { db, engine, user } = harness()
    const owner = user('owner', 'owner@nazix.test')
    const member = user('member', 'member@nazix.test', 'Membre')
    const outsider = user('outsider', 'out@nazix.test')
    const observer = user('observer', 'observer@nazix.test')
    const org = await engine.createWorkspace(owner, { name: 'Studio' })
    await engine.inviteMember(owner, { orgId: org.id, userId: member.id, role: 'member' })
    await engine.acceptInvite(member, org.id)
    await engine.inviteMember(owner, { orgId: org.id, userId: outsider.id, role: 'member' })
    await engine.acceptInvite(outsider, org.id)
    await engine.inviteMember(owner, { orgId: org.id, userId: observer.id, role: 'member' })
    await engine.acceptInvite(observer, org.id)

    const secret = await engine.createGroup(member, { orgId: org.id, name: 'Secret', type: 'private' })
    const note = await engine.postGroupNote(member, secret.id, { title: 'Brief', body: 'Ne pas diffuser' })
    const message = await engine.postMessage(member, secret.id, 'seulement ici')
    assert.equal(canSeeGroupContent(db, outsider, secret), false)
    assert.equal(canSeeGroupContent(db, owner, secret), false)
    assert.equal(canSeeItem(db, outsider, note), false)
    assert.equal(canSeeItem(db, owner, note), false)
    assert.equal(engine.groupMessages(outsider, secret.id).length, 0)
    assert.equal(engine.groupMessages(owner, secret.id).length, 0)
    assert.equal(engine.groupNotes(member, secret.id).length, 1)
    assert.equal(engine.groupMessages(member, secret.id)[0].id, message.id)
    assert.equal(engine.manageableGroups(owner, org.id).some((group) => group.id === secret.id), true)

    const salon = await engine.createGroup(owner, { orgId: org.id, name: 'Salon', type: 'internal' })
    const project = await engine.createGroup(owner, { orgId: org.id, name: 'Chantier', type: 'project', projectId: 'prj_1' })
    const publicNote = await engine.postGroupNote(owner, salon.id, { title: 'Allo', body: 'visible' })
    assert.equal(canSeeItem(db, outsider, publicNote), true)
    assert.equal(canSeeGroupContent(db, member, project), true)
    assert.equal(groupRole(db, salon, outsider.id), '')

    await engine.addGroupMember(member, secret.id, observer.id, 'observer')
    assert.equal(canSeeGroupContent(db, observer, secret), true)
    await assert.rejects(() => engine.postMessage(observer, secret.id, 'non'), (err) => err.code === 'observer')
    await assert.rejects(() => engine.postGroupNote(observer, secret.id, { title: 'x', body: 'y' }), (err) => err.code === 'observer')
    const posted = await engine.postMessage(member, secret.id, 'oui')
    assert.equal(posted.groupId, secret.id)

    const other = await engine.createGroup(owner, { orgId: org.id, name: 'Autre', type: 'internal' })
    await engine.addGroupMember(owner, other.id, member.id, 'member')
    await engine.addGroupMember(owner, salon.id, member.id, 'member')
    assert.equal(groupRole(db, other, member.id), 'member')
    assert.equal(groupRole(db, salon, member.id), 'member')
    await engine.removeGroupMember(owner, salon.id, member.id)
    assert.equal(groupRole(db, salon, member.id), '')
    assert.equal(groupRole(db, other, member.id), 'member')
    assert.equal(workspaceRole(db, member.id, org.id), 'member')
    const kept = removeGroupMembershipOnly(
      {
        workspaceMembers: [{ orgId: org.id, userId: member.id, role: 'member' }],
        groupMembers: [
          { groupId: salon.id, userId: member.id },
          { groupId: other.id, userId: member.id },
        ],
      },
      salon.id,
      member.id,
    )
    assert.equal(kept.workspaceMembers.length, 1)
    assert.equal(kept.groupMembers.length, 1)
  })

  it('guards the last owner, archive, and delete', async () => {
    const { db, engine, user } = harness()
    const owner = user('owner', 'owner@nazix.test')
    const admin = user('admin', 'admin@nazix.test')
    const member = user('member', 'member@nazix.test')
    const org = await engine.createWorkspace(owner, { name: 'Maison' })
    await engine.inviteMember(owner, { orgId: org.id, userId: admin.id, role: 'admin' })
    await engine.acceptInvite(admin, org.id)
    await engine.inviteMember(owner, { orgId: org.id, userId: member.id, role: 'member' })
    await engine.acceptInvite(member, org.id)

    await assert.rejects(() => engine.removeMember(owner, org.id, owner.id), (err) => err.code === 'last_owner')
    await assert.rejects(() => engine.updateMemberRole(owner, org.id, owner.id, 'admin'), (err) => err.code === 'last_owner')
    await assert.rejects(() => engine.removeMember(admin, org.id, owner.id), (err) => err.code === 'permission')
    await assert.rejects(() => engine.deleteWorkspace(admin, org.id, 'Maison'), (err) => err.code === 'permission')
    await assert.rejects(() => engine.archiveWorkspace(member, org.id), (err) => err.code === 'permission')
    await assert.rejects(() => engine.updateMemberRole(admin, org.id, member.id, 'owner'), (err) => err.code === 'permission')

    await engine.archiveWorkspace(owner, org.id)
    assert.equal(engine.switcher(member).some((workspace) => workspace.id === org.id), false)
    assert.equal(engine.switcher(owner).some((workspace) => workspace.id === org.id), true)
    await assert.rejects(() => engine.selectWorkspace(member, org.id), (err) => err.code === 'archived')
    await engine.selectWorkspace(owner, org.id)
    await engine.restoreWorkspace(owner, org.id)
    assert.equal(engine.switcher(member).some((workspace) => workspace.id === org.id), true)

    await engine.suspendWorkspace(owner, org.id)
    assert.equal(engine.switcher(member).some((workspace) => workspace.id === org.id), false)
    await engine.restoreWorkspace(owner, org.id)

    await engine.transferOwnership(owner, org.id, member.id)
    assert.equal(workspaceRole(db, member.id, org.id), 'owner')
    assert.equal(workspaceRole(db, owner.id, org.id), 'admin')
    assert.equal(db.xx_orgs[org.id].ownerId, member.id)
    await engine.removeMember(member, org.id, owner.id)
    assert.equal(workspaceRole(db, owner.id, org.id), '')
    assert.equal(workspaceRole(db, member.id, org.id), 'owner')

    await assert.rejects(() => engine.deleteWorkspace(member, org.id, 'maison'), (err) => err.code === 'confirm_name')
    await engine.deleteWorkspace(member, org.id, 'Maison')
    assert.equal(db.xx_orgs[org.id], undefined)
    assert.equal(db.xx_org_members[`${org.id}_${member.id}`], undefined)
    assert.equal(engine.home(member).spaces.length, 0)
  })
})
