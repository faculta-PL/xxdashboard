/**
 * HANDOFF
 * Nazix platform foundation. Runtime persistence stays Firestore/local until
 * DATABASE_URL is configured. prisma/schema.prisma is the PostgreSQL source of truth.
 *
 * From flags.js:
 *   LAUNCH_FREE_MODE, PRODUCT_FEATURES, featureEnabled
 * From plans.js:
 *   PLAN_CODES, PLANS, PLAN_SEED, planByCode, limitFor, planAllowsFeature, unknownSeedFeatures
 * From permissions.js:
 *   ACTIONS, WORKSPACE_ROLES, GROUP_ROLES, can, workspaceRole, groupRole,
 *   actorWorkspaceIds, passesWorkspaceIsolation, filterByWorkspace,
 *   isGroupVisible, filterVisibleGroups
 * From contract.js:
 *   HANDLE_RE, RESERVED_HANDLES, validateHandle, hashToken,
 *   INVITE_STATUSES, inviteAllowsAccept, searchPublicUser,
 *   LAUNCH_FREE_MODE, featureEnabled
 */

export { LAUNCH_FREE_MODE, PRODUCT_FEATURES, featureEnabled } from './flags.js'

export {
  PLAN_CODES,
  PLANS,
  PLAN_SEED,
  planByCode,
  limitFor,
  planAllowsFeature,
  unknownSeedFeatures,
} from './plans.js'

export {
  ACTIONS,
  WORKSPACE_ROLES,
  GROUP_ROLES,
  can,
  workspaceRole,
  groupRole,
  actorWorkspaceIds,
  passesWorkspaceIsolation,
  filterByWorkspace,
  isGroupVisible,
  filterVisibleGroups,
} from './permissions.js'

export {
  HANDLE_RE,
  RESERVED_HANDLES,
  validateHandle,
  hashToken,
  INVITE_STATUSES,
  inviteAllowsAccept,
  searchPublicUser,
} from './contract.js'
