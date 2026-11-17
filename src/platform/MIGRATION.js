/*
 * AUDIT (read before the migration, November 2026)
 *
 * Routes / views in src/App.jsx
 * - dashboard, projects, notes, important, ideas, calendar, todos, files, budget,
 *   risks, canvas, org, spaces, orgadmin, team, chat, search, export, notifications,
 *   settings, guide, assistant, create, feedback, games, invitations (identity desk).
 *
 * Menu duplicates (src/components/Sidebar.jsx, group "Collaboration")
 * - "Organisation" (view org, OrgHome) and "Organisations" (view orgadmin, OrgAdmin)
 *   both manage organizations. orgadmin is the super-admin list; org is members.
 * - "Espaces" (view spaces, SpacesScreen) treats the organization as the workspace
 *   (workspace id === org id, nazix_active_workspace mirrors nazix_active_org).
 *   Its tabs (settings, people, groups) repeat Organisation, Équipe, and settings.
 * - "Équipe" (view team, TeamView) repeats members already edited on Organisation
 *   and on the Espaces people tab.
 * - "Invitations" is a third members entry (identity desk) beside Organisation.
 *
 * Data
 * - xx_orgs + xx_org_members are the tenant. There is no xx_spaces collection.
 * - xx_groups + xx_group_members are teams and also the general chat and project
 *   conversations. Memberships live on memberIds and xx_group_members.
 * - xx_invitations (identity) store tokenHash only. workspaceId is the org id.
 *   Acceptance is explicit (inviteAllowsAccept). Pending xx_org_members are a
 *   second invite path inside the spaces engine.
 * - Notes, ideas, projects, events, messages carry orgId. They do not carry
 *   organizationId or spaceId.
 * - Permissions: src/platform/permissions.js (can, workspace isolation) and
 *   src/spaces/permissions.js (Firestore-shaped adapter). Guests already need
 *   an explicit share. Private groups are visible to a non-member owner when
 *   they are not sealed; the new read path hides private team content from
 *   non-members, including that owner.
 *
 * What stays
 * - Brand Nazix, sage palette, Vite/React/Tailwind, FR/EN, Firebase + local
 *   fallback, handles, LAUNCH_FREE_MODE, and the tools (tasks, files, budget,
 *   risks, canvas, assistant, games, feedback, mini).
 *
 * MIGRATION (reversible: nothing is deleted)
 * - xx_orgs rows remain organizations.
 * - For each org, ensure exactly one xx_spaces document with kind "general"
 *   (id spc_<orgId>_general). Do not create extra spaces.
 * - Backfill organizationId = orgId and spaceId = that general space on notes,
 *   ideas, projects, events. Keep orgId.
 * - Teams stay in xx_groups. Add organizationId. Link spaceId only on
 *   conversations (general channel and project rooms). Do not drop memberIds
 *   or xx_group_members.
 * - Invitations stay in xx_invitations. organizationId mirrors workspaceId.
 *   spaceId and teamId are optional. Acceptance stays explicit. Token hash only.
 * - nazix_active_org stays the active organization. nazix_active_space is the
 *   open space and defaults to the general space. nazix_active_workspace keeps
 *   mirroring the org id.
 * - Reads go through permissions.js and the store snapshot filter.
 */

import { inviteAllowsAccept } from './contract.js'
import { generalSpaceId } from './permissions.js'

export const PLAN = Object.freeze({
  keepCollections: ['xx_orgs', 'xx_org_members', 'xx_groups', 'xx_group_members', 'xx_invitations'],
  addCollection: 'xx_spaces',
  spaceKinds: ['general', 'extra'],
  contentCollections: ['xx_notes', 'xx_ideas', 'xx_projects', 'xx_events'],
  activeOrgKey: 'nazix_active_org',
  activeSpaceKey: 'nazix_active_space',
  activeWorkspaceMirror: 'nazix_active_workspace',
  reversible: true,
  autoSpaces: 'general-only',
})

export function spaceDisplayName(lang) {
  return lang === 'en' ? 'General space' : 'Espace général'
}

export function buildGeneralSpace(org, lang = 'fr', now = '') {
  if (!org?.id) return null
  return {
    id: generalSpaceId(org.id),
    organizationId: org.id,
    orgId: org.id,
    name: spaceDisplayName(lang),
    description: '',
    leadUserId: org.ownerId || org.createdBy || '',
    visibility: 'organization',
    kind: 'general',
    memberIds: [],
    teamIds: [],
    createdAt: org.createdAt || now || new Date().toISOString(),
  }
}

/**
 * Ensures exactly one general space per organization.
 * Existing general spaces are kept. Extra spaces are never created here.
 */
export function ensureGeneralSpaces(orgs, spaces, lang = 'fr') {
  const list = (Array.isArray(spaces) ? spaces : Object.values(spaces || {})).filter(Boolean)
  const generalByOrg = new Map()
  for (const space of list) {
    const orgId = space.organizationId || space.orgId
    if (space.kind === 'general' && orgId && !generalByOrg.has(orgId)) generalByOrg.set(orgId, space)
  }
  const created = []
  for (const org of orgs || []) {
    if (!org?.id || generalByOrg.has(org.id)) continue
    const space = buildGeneralSpace(org, lang)
    created.push(space)
    generalByOrg.set(org.id, space)
  }
  return { spaces: [...list, ...created], created, generalByOrg }
}

/** Keeps orgId and fills organizationId + spaceId. */
export function backfillDoc(doc, space) {
  if (!doc) return doc
  const orgId = doc.orgId || doc.organizationId || doc.workspaceId || ''
  if (!orgId) return doc
  return {
    ...doc,
    orgId,
    organizationId: doc.organizationId || orgId,
    spaceId: doc.spaceId || space?.id || '',
  }
}

function isConversation(group) {
  return Boolean(group?.isGeneral || group?.kind === 'project' || group?.projectId)
}

/**
 * Pure migration. Returns patches to write. Does not delete organizations,
 * groups, or memberships.
 */
export function planMigration(db, lang = 'fr') {
  const orgs = Object.values(db?.xx_orgs || {})
  const ensured = ensureGeneralSpaces(orgs, db?.xx_spaces || {}, lang)
  const patches = []
  for (const space of ensured.created) patches.push({ col: 'xx_spaces', id: space.id, value: space })
  for (const col of PLAN.contentCollections) {
    for (const row of Object.values(db?.[col] || {})) {
      if (!row?.id) continue
      const orgId = row.orgId || row.organizationId
      if (!orgId) continue
      const space = ensured.generalByOrg.get(orgId)
      if (!space) continue
      if (row.orgId && row.organizationId && row.spaceId) continue
      patches.push({ col, id: row.id, value: backfillDoc(row, space) })
    }
  }
  for (const group of Object.values(db?.xx_groups || {})) {
    if (!group?.id) continue
    const orgId = group.orgId || group.organizationId
    if (!orgId) continue
    const space = ensured.generalByOrg.get(orgId)
    const next = {
      ...group,
      orgId,
      organizationId: group.organizationId || orgId,
    }
    if (isConversation(group) && !group.spaceId && space) next.spaceId = space.id
    if (
      next.organizationId !== group.organizationId ||
      next.orgId !== group.orgId ||
      next.spaceId !== group.spaceId
    ) {
      patches.push({ col: 'xx_groups', id: group.id, value: next })
    }
  }
  return { patches, spaces: ensured.spaces, created: ensured.created }
}

/**
 * An invitation never becomes a membership until it is explicitly accepted
 * and inviteAllowsAccept still says it is open.
 */
export function membershipFromInvite(invite, accepted, now = new Date()) {
  if (!accepted || !invite) return null
  if (!inviteAllowsAccept(invite, now)) return null
  const organizationId = invite.organizationId || invite.workspaceId || ''
  if (!organizationId) return null
  return {
    organizationId,
    orgId: organizationId,
    spaceId: invite.spaceId || null,
    teamId: invite.teamId || invite.groupId || null,
    role: invite.role || 'member',
    status: 'active',
  }
}
