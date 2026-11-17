/**
 * HANDOFF — modules layer (agent MODULES)
 *
 * Finished, in order:
 * 6. Notes and projects keep their screens and gain an optional groupId.
 *    Visibility is personal | workspace | group | shared (legacy Privée / Partagée / Équipe / Publique still works).
 *    A group item is hidden from anyone who is not in that group's memberIds.
 *    A personal note stays visible to its author (ownerId / authorId / createdBy / userId).
 * 7. Group conversations and the project conversation (grp_project_<id>) are readable and writable
 *    only by their members. Invite, mention (@Full name or @userId) and new-message notifications
 *    go through notifyUsers / xx_notifications. xx_audit stores the event without body, text, content or message.
 * 8. An event stores workspaceId (and orgId) plus an optional projectId.
 *    Export still uses src/lib/export.js (no new export library). filterReadableRows drops rows the user cannot read.
 * 9. Server search remains DuckDuckGo + Wikipedia (server/ai-http.mjs and functions/ai-http.mjs).
 *    Google and Instagram are not fetched. Results stay links. The client never sends an API key.
 * 10. Billing is prepared and inactive. Limits exist only in src/billing/plans.js
 *     (free, pro, business, enterprise). LAUNCH_FREE_MODE is true and featureEnabled() is true,
 *     so nothing is blocked and there is no Stripe, card form or paywall.
 *     A workspace may store subscription { planId: 'free', status: 'free' }.
 *     The super-admin screen lists plans, shows the free-launch banner, and counts only.
 *
 * Workspace id: localStorage nazix_active_org, mirrored to nazix_active_workspace.
 * Copy: src/billing/i18n.js billingT(lang, key). UI hooks are marked MODULES-LAYER START/END.
 * Do not turn LAUNCH_FREE_MODE off without a product decision. Do not add a payment provider here.
 */

export { PLAN_IDS, PLANS, listPlans, planById } from './plans.js'
export { LAUNCH_FREE_MODE, featureEnabled, guardQuota } from './flags.js'
export { billingLang, billingT, billingKeys } from './i18n.js'
export {
  FREE_SUBSCRIPTION,
  ACTIVE_ORG_KEY,
  ACTIVE_WORKSPACE_KEY,
  readWorkspaceId,
  subscriptionOf,
  withFreeSubscription,
} from './subscription.js'
export {
  MODULE_VISIBILITY,
  setGroupsProvider,
  isModuleVisibility,
  isItemAuthor,
  moduleVisibilityOf,
  groupOf,
  moduleReadDecision,
  canReadModuleItem,
  sharesForVisibility,
  stampModuleItem,
  filterReadableRows,
  moduleCounts,
} from './access.js'
export {
  projectConversationId,
  projectMemberIds,
  canAccessConversation,
  mentionUserIds,
  auditWithoutBody,
  messageAuditEntry,
} from './messaging.js'
export {
  SEARCH_SOURCES,
  isApprovedSearchHost,
  assertApprovedSearchUrl,
  searchSourcesAreApproved,
  stripClientSecrets,
  clientPayloadHasNoApiKey,
  sanitizeSearchResults,
} from './searchPolicy.js'

export const HANDOFF = {
  agent: 'MODULES',
  branch: 'cursor/modules-billing-e810',
  billing: 'inactive',
  launchFreeMode: true,
  visibility: ['personal', 'workspace', 'group', 'shared'],
  workspaceKeys: ['nazix_active_org', 'nazix_active_workspace'],
  search: ['DuckDuckGo', 'Wikipedia'],
  limits: 'src/billing/plans.js',
}
