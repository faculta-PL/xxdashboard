import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import test from 'node:test'
import {
  LAUNCH_FREE_MODE,
  featureEnabled,
  hashToken,
  inviteAllowsAccept,
  searchPublicUser,
  validateHandle,
} from '../platform/contract.js'
import {
  INVITE_FIELDS,
  handleAvailability,
  searchPublicByHandle,
  validateProfileForm,
  validateSignupForm,
} from './model.js'
import { memoryRepo } from './repo.js'
import { createInviteService } from './service.js'

const NOW = new Date('2026-11-17T12:00:00.000Z')

test('handle rules: lowercase, length, reserved', () => {
  const ok = validateHandle('Ab_c')
  assert.equal(ok.ok, true)
  assert.equal(ok.handle, 'ab_c')
  assert.equal(validateHandle('good_name').ok, true)
  assert.equal(validateHandle('ab').ok, false)
  assert.equal(validateHandle('ab').reason, 'format')
  assert.equal(validateHandle('has space').reason, 'format')
  assert.equal(validateHandle('bad!').reason, 'format')
  assert.equal(validateHandle('a'.repeat(21)).reason, 'format')
  for (const reserved of ['admin', 'NAZIX', 'Support', 'root', 'system', 'HELP', 'billing']) {
    const result = validateHandle(reserved)
    assert.equal(result.ok, false, reserved)
    assert.equal(result.reason, 'reserved', reserved)
  }
})

test('handle is free only when unused, including the current profile', () => {
  const users = [
    { id: 'u1', handle: 'ada' },
    { id: 'u2', handle: 'mina' },
  ]
  assert.equal(handleAvailability('ada', users).reason, 'taken')
  assert.equal(handleAvailability('@Mina', users, 'u2').ok, true)
  assert.equal(handleAvailability('nova', users).ok, true)
  const keep = validateProfileForm(
    { fullName: 'Mina', handle: 'mina', bio: '', title: '', website: '', discoverable: false },
    users,
    'u2',
  )
  assert.equal(keep.ok, true)
  assert.equal(keep.patch.handle, 'mina')
  const steal = validateProfileForm(
    { fullName: 'Mina', handle: 'Ada', bio: '', title: '', website: 'https://mina.example' },
    users,
    'u2',
  )
  assert.equal(steal.ok, false)
  assert.equal(steal.errors.handle, 'taken')
})

test('signup requires name, handle, matching password and terms', () => {
  const users = [{ id: 'u1', handle: 'ada' }]
  const bad = validateSignupForm(
    { fullName: '', email: 'nope', handle: 'ad', password: 'short', confirm: 'other', terms: false },
    { users, minPassword: 8 },
  )
  assert.equal(bad.ok, false)
  assert.equal(bad.errors.fullName, 'name')
  assert.equal(bad.errors.email, 'email')
  assert.equal(bad.errors.handle, 'format')
  assert.equal(bad.errors.password, 'password')
  assert.equal(bad.errors.confirm, 'confirm')
  assert.equal(bad.errors.terms, 'terms')
  const taken = validateSignupForm(
    { fullName: 'Awa', email: 'awa@example.com', handle: 'Ada', password: 'long-enough', confirm: 'long-enough', terms: true },
    { users, minPassword: 8 },
  )
  assert.equal(taken.errors.handle, 'taken')
  const good = validateSignupForm(
    { displayName: 'Awa', fullName: 'Awa', email: 'Awa@Example.com', handle: 'awa_k', password: 'long-enough', confirm: 'long-enough', terms: true },
    { users, minPassword: 8 },
  )
  assert.equal(good.ok, true)
  assert.equal(good.handle, 'awa_k')
})

test('public search returns display name, handle and bio, never email', () => {
  const stripped = searchPublicUser({
    email: 'secret@example.com',
    fullName: 'Awa',
    handle: 'awa',
    passwordHash: 'nope',
  })
  assert.equal('email' in stripped, false)
  assert.equal(stripped.fullName, 'Awa')
  assert.equal(searchPublicUser(null), null)

  const users = [
    { id: '1', email: 'secret@example.com', fullName: 'Awa Dia', handle: 'awa', bio: 'Bonjour', discoverable: true, passwordHash: 'x' },
    { id: '2', email: 'hidden@example.com', fullName: 'Hidden', handle: 'hidden', bio: 'private', discoverable: false },
  ]
  const found = searchPublicByHandle(users, '@Awa')
  assert.deepEqual(found, { displayName: 'Awa Dia', handle: 'awa', bio: 'Bonjour' })
  assert.equal('email' in found, false)
  assert.equal(JSON.stringify(found).includes('secret@'), false)
  assert.equal(searchPublicByHandle(users, 'hidden'), null)
  assert.equal(searchPublicByHandle(users, 'admin'), null)
  assert.equal(searchPublicByHandle(users, 'nope'), null)
})

test('invite lifecycle: hash only, accept once, filters, revoke, expiry, resend', async () => {
  assert.equal(LAUNCH_FREE_MODE, true)
  assert.equal(featureEnabled('invitations'), true)
  assert.equal(await hashToken('token-one'), createHash('sha256').update('token-one').digest('hex'))

  const repo = memoryRepo()
  const notices = []
  const members = []
  let seq = 0
  const tokens = ['email-token', 'handle-token', 'link-token', 'stale-token', 'resend-token']
  const users = [
    { id: 'owner', fullName: 'Awa Dia', email: 'awa@example.com', handle: 'awa' },
    { id: 'guest', fullName: 'Mina', email: 'mina@example.com', handle: 'mina' },
    { id: 'other', fullName: 'Other', email: 'other@example.com', handle: 'other' },
  ]
  const service = createInviteService({
    repo,
    now: () => NOW,
    users: () => users,
    orgs: () => [{ id: 'org1', name: 'Atelier Nazix' }],
    randomToken: () => tokens[seq++] || `extra-${seq}`,
    newId: () => `inv_${seq}`,
    link: (token) => `https://nazix.local/?invite=${token}`,
    notify: async (userId, payload) => {
      notices.push({ userId, payload })
    },
    addMembership: async (invite, user) => {
      const key = `${invite.workspaceId}:${user.id}`
      if (!members.some((row) => row.key === key)) {
        members.push({ key, role: invite.role, groupId: invite.groupId })
      }
    },
  })
  const owner = users[0]

  const emailInvite = await service.createEmailInvite(owner, {
    workspaceId: 'org1',
    email: 'Mina@Example.com',
    role: 'member',
    groupId: 'grp1',
  })
  assert.equal(emailInvite.mailSent, false)
  assert.equal(emailInvite.noticed, true)
  assert.equal(emailInvite.token, 'email-token')
  assert.equal(emailInvite.link, 'https://nazix.local/?invite=email-token')
  assert.equal(emailInvite.invite.tokenHash, await hashToken('email-token'))
  assert.equal('token' in emailInvite.invite, false)
  assert.deepEqual(Object.keys(emailInvite.invite).sort(), [...INVITE_FIELDS].sort())
  assert.equal(emailInvite.invite.email, 'mina@example.com')
  assert.equal(emailInvite.invite.invitedUserId, 'guest')
  assert.equal(emailInvite.invite.maxUses, 1)
  assert.equal(emailInvite.invite.uses, 0)
  assert.equal(emailInvite.invite.status, 'pending')
  assert.equal(emailInvite.invite.groupId, 'grp1')
  assert.equal(members.length, 0)
  assert.equal(JSON.stringify(repo.list()).includes('email-token'), false)
  assert.equal(JSON.stringify(notices).includes('email-token'), false)
  assert.equal(notices[0].payload.mailSent, false)
  assert.equal(notices[0].userId, 'guest')

  const preview = await service.previewInvite('email-token')
  assert.equal(preview.workspaceName, 'Atelier Nazix')
  assert.equal(preview.inviterName, 'Awa Dia')
  assert.equal(preview.role, 'member')
  assert.equal(preview.email, undefined)
  assert.equal('email' in preview, false)

  await assert.rejects(() => service.acceptInvite(users[2], { token: 'email-token' }), /invite_audience/)
  const accepted = await service.acceptInvite(users[1], { inviteId: emailInvite.invite.id })
  assert.equal(accepted.status, 'accepted')
  assert.equal(accepted.uses, 1)
  assert.equal(members.length, 1)
  assert.equal(members[0].groupId, 'grp1')
  await assert.rejects(() => service.acceptInvite(users[1], { token: 'email-token' }), /invite_full|invite_accepted|invite_closed/)
  assert.equal(members.length, 1)

  const pendingBefore = service.listInbox(users[1], 'pending')
  assert.equal(pendingBefore.length, 0)
  assert.equal(service.listInbox(users[1], 'accepted').length, 1)

  const handleInvite = await service.createHandleInvite(owner, {
    workspaceId: 'org1',
    handle: '@other',
    role: 'admin',
  })
  assert.equal(handleInvite.mailSent, false)
  assert.equal(handleInvite.noticed, true)
  assert.equal(handleInvite.invite.status, 'pending')
  assert.equal(members.length, 1)
  assert.equal(service.listInbox(users[2], 'pending').length, 1)
  const declined = service.declineInvite(users[2], handleInvite.invite.id)
  assert.equal(declined.status, 'declined')
  await assert.rejects(() => service.acceptInvite(users[2], { inviteId: handleInvite.invite.id }), /invite_declined|invite_closed/)
  assert.equal(service.listInbox(users[2], 'declined').length, 1)

  const link = await service.createLinkInvite(owner, { workspaceId: 'org1', role: 'member' })
  const exp = new Date(link.invite.expiresAt).getTime() - NOW.getTime()
  assert.equal(link.invite.maxUses, 10)
  assert.equal(link.invite.email, null)
  assert.equal(link.invite.handle, null)
  assert.ok(exp === 7 * 24 * 60 * 60 * 1000)
  assert.equal(link.token, 'link-token')
  assert.equal(link.mailSent, false)
  assert.equal(link.noticed, false)
  await service.acceptInvite(users[2], { token: 'link-token' })
  assert.equal(members.filter((row) => row.key === 'org1:other').length, 1)
  assert.equal(service.listSent(owner, 'pending').some((row) => row.id === link.invite.id), true)

  const revoked = service.revokeInvite(owner, link.invite.id)
  assert.equal(revoked.status, 'revoked')
  await assert.rejects(() => service.acceptInvite(users[1], { token: 'link-token' }), /invite_revoked/)
  assert.equal(service.listSent(owner, 'revoked').some((row) => row.id === link.invite.id), true)
  assert.equal(inviteAllowsAccept(revoked, NOW), false)

  const stale = await service.createEmailInvite(owner, {
    workspaceId: 'org1',
    email: 'nobody@example.com',
    role: 'member',
    expiresAt: '2026-11-01T00:00:00.000Z',
  })
  assert.equal(stale.noticed, false)
  assert.equal(stale.mailSent, false)
  assert.equal(inviteAllowsAccept(stale.invite, NOW), false)
  await assert.rejects(() => service.acceptInvite({ id: 'new', email: 'nobody@example.com' }, { token: stale.token }), /invite_expired/)
  assert.equal(service.listSent(owner, 'expired').some((row) => row.id === stale.invite.id), true)

  const renewed = await service.resendInvite(owner, stale.invite.id)
  assert.equal(renewed.mailSent, false)
  assert.equal(renewed.token, 'resend-token')
  assert.notEqual(renewed.invite.tokenHash, stale.invite.tokenHash)
  assert.equal(JSON.stringify(repo.get(stale.invite.id)).includes('resend-token'), false)
  assert.equal(await service.previewInvite(stale.token), null)
  const again = await service.previewInvite('resend-token')
  assert.equal(again.allowsAccept, true)
  assert.equal(again.inviterName, 'Awa Dia')

  const full = {
    ...renewed.invite,
    uses: renewed.invite.maxUses,
    status: 'pending',
  }
  assert.equal(inviteAllowsAccept(full, NOW), false)
  assert.equal(inviteAllowsAccept({ ...renewed.invite, status: 'revoked' }, NOW), false)
  assert.equal(inviteAllowsAccept({ ...renewed.invite, status: 'accepted' }, NOW), false)
})
