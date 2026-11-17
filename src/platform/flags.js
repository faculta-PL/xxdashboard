/**
 * Single launch switch for Nazix product features.
 * Numeric limits are not defined here. They live in src/platform/plans.js.
 * The Firestore/local runtime does not read this file until a caller imports it.
 */

/** When true, featureEnabled grants every product feature. Billing must not block launch. */
export const LAUNCH_FREE_MODE = true

/** Catalog of product features. Plans reference these keys; they do not redefine them. */
export const PRODUCT_FEATURES = Object.freeze([
  'notes',
  'ideas',
  'projects',
  'calendar',
  'files',
  'export',
  'games',
  'search',
  'notifications',
  'budget',
  'risks',
  'import',
  'chat',
  'canvas',
  'assistant',
  'share',
  'groups',
  'team',
  'feedback',
  'invite',
  'audit',
])

/**
 * @param {string} key
 * @returns {boolean}
 */
export function featureEnabled(key) {
  const name = typeof key === 'string' ? key.trim() : ''
  if (!name) return false
  if (LAUNCH_FREE_MODE) return true
  return false
}
