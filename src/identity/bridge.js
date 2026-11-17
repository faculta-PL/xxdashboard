import { browserRepo } from './repo.js'
import { createInviteService } from './service.js'
import { toInviteRecord } from './model.js'
import {
  canManageOrg,
  inviteToGroup,
  listOrganizations,
  listUsers,
  notifyUsers,
  placeUserInOrg,
} from '../lib/store.js'

function inviteUrl(token) {
  if (typeof window === 'undefined') return `/?invite=${encodeURIComponent(token)}`
  const url = new URL(window.location.href)
  url.hash = ''
  url.search = ''
  url.searchParams.set('invite', token)
  return url.toString()
}

async function mirrorInvite(row) {
  try {
    const { firebaseConfigured, db } = await import('../lib/firebase.js')
    if (!firebaseConfigured || !db || !row?.id) return
    const { doc, setDoc } = await import('firebase/firestore')
    await setDoc(doc(db, 'xx_invitations', row.id), toInviteRecord(row), { merge: true })
  } catch (err) {
    console.warn('invite mirror:', err?.message || err)
  }
}

export function appRepo() {
  const base = browserRepo()
  return {
    list: () => base.list(),
    get: (id) => base.get(id),
    save(row) {
      const saved = base.save(toInviteRecord(row))
      void mirrorInvite(saved)
      return saved
    },
  }
}

export async function hydrateInvites() {
  try {
    const { firebaseConfigured, db } = await import('../lib/firebase.js')
    if (!firebaseConfigured || !db) return
    const { collection, getDocs } = await import('firebase/firestore')
    const snap = await getDocs(collection(db, 'xx_invitations'))
    const repo = browserRepo()
    snap.forEach((item) => {
      const data = item.data() || {}
      repo.save(toInviteRecord({ ...data, id: item.id }))
    })
  } catch (err) {
    console.warn('invite hydrate:', err?.message || err)
  }
}

export function appInviteService() {
  return createInviteService({
    repo: appRepo(),
    users: () => listUsers(),
    orgs: () => listOrganizations(),
    canInvite: (actor, workspaceId) => canManageOrg(actor, workspaceId),
    link: inviteUrl,
    notify: (userId, payload) => notifyUsers([userId], payload),
    addMembership: async (invite, user) => {
      const inviter = listUsers().find((row) => row.id === invite.invitedBy)
      if (!inviter) {
        const err = new Error('invite_inviter')
        err.code = 'invite_inviter'
        throw err
      }
      await placeUserInOrg(
        {
          orgId: invite.workspaceId,
          userId: user.id,
          email: user.email,
          role: invite.role,
        },
        inviter,
      )
      if (invite.groupId) {
        try {
          await inviteToGroup(invite.groupId, [user.id], inviter)
        } catch (err) {
          console.warn('invite group:', err?.message || err)
        }
      }
    },
  })
}
