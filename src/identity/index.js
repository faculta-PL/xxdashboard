/**
 * HANDOFF — identity + invitations (agent IDENTITY)
 *
 * Branch cursor/identity-invites-e810. Do not push main. Do not commit .env.
 *
 * What this module owns
 * - Signup extras on the existing Firebase/local account: display name (fullName),
 *   handle, password confirmation, terms. registerUser / loginUser stay in src/lib/store.js.
 * - Profile fields written with updateProfile: fullName, handle, bio, title, website, discoverable.
 * - Public @handle search. Result is display name, handle, and bio only when discoverable.
 *   Email is never returned (searchPublicUser deletes it).
 * - Email verification banner. A failed resend does not log the user out.
 * - Collection xx_invitations. Only tokenHash is stored. The raw token is returned once,
 *   inside ?invite=TOKEN. Mail is never marked sent.
 * - Channels: email (copy link + in-app notice when the account exists), @handle (accept
 *   required, no membership until accept), link (7 days, 10 uses, revoke).
 * - Accept is idempotent at the membership id (orgId_userId) via placeUserInOrg.
 *   Logged-out visitors stash nazix_pending_invite and return after signup or login.
 *
 * Files
 * - src/platform/contract.js — created only because src/platform was absent. Platform owns
 *   this folder. Keep validateHandle, hashToken, inviteAllowsAccept, searchPublicUser,
 *   LAUNCH_FREE_MODE and featureEnabled().
 * - src/identity/model.js — pure handle, profile, search, invite shape.
 * - src/identity/service.js — invite lifecycle against an injected repo.
 * - src/identity/bridge.js — wires the service to listUsers, updateProfile, notifyUsers,
 *   placeUserInOrg, inviteToGroup. Local key nazix_xx_invitations. Firestore mirror is best-effort.
 * - src/identity/i18n.js — FR/EN via identityT(lang, key).
 * - Mount points in App.jsx are wrapped with IDENTITY-LAYER START / END.
 *
 * Invite record keys, and only these: id, workspaceId, groupId|null, email|null, handle|null,
 * invitedUserId|null, invitedBy, role, tokenHash, expiresAt, maxUses, uses, status, createdAt.
 * Status values: pending, accepted, declined, expired (derived when expiresAt has passed), revoked.
 */
export { identityDict, identityT } from './i18n.js'
export {
  DEFAULT_INVITE_MS,
  DEFAULT_LINK_USES,
  DEFAULT_PERSONAL_USES,
  INVITE_COLLECTION,
  INVITE_FIELDS,
  INVITE_FILTERS,
  clearInviteToken,
  classifyInvite,
  handleAvailability,
  inviteChannel,
  isInviteRecipient,
  readInviteToken,
  searchPublicByHandle,
  stashInviteToken,
  toInviteRecord,
  validateProfileForm,
  validateSignupForm,
} from './model.js'
export { createInviteService } from './service.js'
export { appInviteService, hydrateInvites } from './bridge.js'
export {
  EmailVerifyBanner,
  IdentityProfileCard,
  IdentitySignupFields,
  InvitationDesk,
  InviteAcceptGate,
} from './IdentityScreens.jsx'
export {
  LAUNCH_FREE_MODE,
  featureEnabled,
  hashToken,
  inviteAllowsAccept,
  searchPublicUser,
  validateHandle,
} from '../platform/contract.js'
