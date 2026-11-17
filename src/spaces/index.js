/**
 * HANDOFF — spaces / groups
 *
 * Tenant id: workspace id === org id. Records stay in xx_orgs and xx_org_members.
 * nazix_active_workspace is written as a mirror of nazix_active_org (src/spaces/active.js).
 * There is no second tenant id and no xx_workspaces collection.
 *
 * src/platform/permissions.js is not on this branch. The same workspace, guest,
 * and group rules are enforced locally in src/spaces/permissions.js. That file is
 * a deliberate duplicate until a platform module lands — keep the rules aligned,
 * do not fork another tenant id.
 *
 * Groups live inside one workspace: xx_groups and xx_group_members, both stamped
 * with orgId. Private notes and chat are for group members. The workspace owner
 * can manage that membership without reading the private content. Removing a
 * person from a group does not remove their workspace membership. The last owner
 * stays until ownership is transferred. Archive hides a workspace from members;
 * the owner can restore it. Delete asks for the workspace name.
 */

export { ACTIVE_ORG_KEY, ACTIVE_WORKSPACE_KEY, readMirroredActiveId, writeActiveMirror } from './active.js'
export { createSpacesEngine } from './engine.js'
export { spacesRoleLabel, spacesStatusLabel, spacesT } from './i18n.js'
export {
  asWorkspace,
  groupMemberId,
  normalizeEmoji,
  orgMemberId,
  slugify,
  uniqueSlug,
  workspaceInitials,
} from './model.js'
export {
  canPostInGroup,
  canSeeGroupContent,
  canSeeItem,
  directoryOf,
  enterBlock,
  guestCanReadItem,
  homeSummary,
  showInSwitcher,
  switcherWorkspaces,
} from './permissions.js'
export { PersonalHome } from './PersonalHome.jsx'
export { SpacesScreen } from './SpacesScreen.jsx'
export { WorkspaceMark, WorkspaceSwitcher } from './WorkspaceSwitcher.jsx'
