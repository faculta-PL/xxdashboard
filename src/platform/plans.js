/**
 * Plan catalog for Nazix. This is the only place numeric limits are defined.
 * Do not copy these numbers into product modules.
 *
 * LAUNCH_FREE_MODE (flags.js) does not read this file. While it is true,
 * featureEnabled() stays open even when planAllowsFeature() is false.
 *
 * Seed rows for `plans` and `plan_features` (prisma/migrations/0001_init/migration.sql).
 * Insert order: plans first, then plan_features. Ids are stable.
 *
 * plans
 * | id              | code       | name       | price_cents | currency | interval | active |
 * | plan_free       | free       | Free       | 0           | EUR      | month    | true   |
 * | plan_pro        | pro        | Pro        | 1500        | EUR      | month    | true   |
 * | plan_business   | business   | Business   | 4900        | EUR      | month    | true   |
 * | plan_enterprise | enterprise | Enterprise | 0           | EUR      | custom   | true   |
 *
 * limits JSON (-1 means unlimited). fileBytes stays 20971520 (20 MB) on every plan;
 * that cap is the product rule, not a paid upgrade. Nazix has no payment rail at launch;
 * price_cents is the future amount, and Enterprise is a custom contract (price 0 here).
 *
 * free:       workspaces 1, members 1, guests 0, projects 10, notes 500, ideas 500,
 *             groups 1, storageBytes 104857600, fileBytes 20971520
 * pro:        workspaces 5, members 25, guests 10, projects 200, notes 10000, ideas 10000,
 *             groups 50, storageBytes 21474836480, fileBytes 20971520
 * business:   workspaces 50, members 250, guests 100, projects 2000, notes 100000, ideas 100000,
 *             groups 500, storageBytes 214748364800, fileBytes 20971520
 * enterprise: workspaces -1, members -1, guests -1, projects -1, notes -1, ideas -1,
 *             groups -1, storageBytes -1, fileBytes 20971520
 *
 * plan_features (id, plan_id, feature_key, enabled). One row per PLAN_SEED.features entry.
 * free omits chat, canvas, assistant, share, groups, team, feedback, invite, audit.
 * pro adds chat, canvas, assistant, share, groups, team, feedback.
 * business and enterprise add invite and audit. Enterprise matches the full catalog.
 * The migration inserts these rows with ON CONFLICT DO NOTHING.
 */

import { PRODUCT_FEATURES } from './flags.js'

/** Kept in sync with flags.js. Billing and the launch test read this assignment. */
export const LAUNCH_FREE_MODE = true

const FILE_BYTES = 20 * 1024 * 1024

const SOLO = Object.freeze([
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
])

const PRO = Object.freeze([
  ...SOLO,
  'chat',
  'canvas',
  'assistant',
  'share',
  'groups',
  'team',
  'feedback',
])

const BUSINESS = Object.freeze([...PRO, 'invite', 'audit'])

/** @type {readonly {id: string, code: string, name: string, description: string, priceCents: number, currency: string, interval: string, active: boolean, limits: Readonly<Record<string, number>>, features: readonly string[]}[]} */
export const PLAN_SEED = Object.freeze([
  Object.freeze({
    id: 'plan_free',
    code: 'free',
    name: 'Free',
    description: 'Solo workspace on this device. No payment.',
    priceCents: 0,
    currency: 'EUR',
    interval: 'month',
    active: true,
    limits: Object.freeze({
      workspaces: 1,
      members: 1,
      guests: 0,
      projects: 10,
      notes: 500,
      ideas: 500,
      groups: 1,
      storageBytes: 100 * 1024 * 1024,
      fileBytes: FILE_BYTES,
    }),
    features: SOLO,
  }),
  Object.freeze({
    id: 'plan_pro',
    code: 'pro',
    name: 'Pro',
    description: 'Collaboration for a small team.',
    priceCents: 1500,
    currency: 'EUR',
    interval: 'month',
    active: true,
    limits: Object.freeze({
      workspaces: 5,
      members: 25,
      guests: 10,
      projects: 200,
      notes: 10000,
      ideas: 10000,
      groups: 50,
      storageBytes: 20 * 1024 * 1024 * 1024,
      fileBytes: FILE_BYTES,
    }),
    features: PRO,
  }),
  Object.freeze({
    id: 'plan_business',
    code: 'business',
    name: 'Business',
    description: 'Roles, invites, and audit for a growing organisation.',
    priceCents: 4900,
    currency: 'EUR',
    interval: 'month',
    active: true,
    limits: Object.freeze({
      workspaces: 50,
      members: 250,
      guests: 100,
      projects: 2000,
      notes: 100000,
      ideas: 100000,
      groups: 500,
      storageBytes: 200 * 1024 * 1024 * 1024,
      fileBytes: FILE_BYTES,
    }),
    features: BUSINESS,
  }),
  Object.freeze({
    id: 'plan_enterprise',
    code: 'enterprise',
    name: 'Enterprise',
    description: 'Custom contract. Unlimited limits. No in-app checkout.',
    priceCents: 0,
    currency: 'EUR',
    interval: 'custom',
    active: true,
    limits: Object.freeze({
      workspaces: -1,
      members: -1,
      guests: -1,
      projects: -1,
      notes: -1,
      ideas: -1,
      groups: -1,
      storageBytes: -1,
      fileBytes: FILE_BYTES,
    }),
    features: Object.freeze([...PRODUCT_FEATURES]),
  }),
])

export const PLAN_CODES = Object.freeze(PLAN_SEED.map((plan) => plan.code))

export const PLAN_ORDER = PLAN_CODES

export const PLAN_LIMITS = Object.freeze(
  Object.fromEntries(
    PLAN_SEED.map((plan) => {
      const bytes = plan.limits.storageBytes
      return [
        plan.code,
        Object.freeze({
          ...plan.limits,
          storageMb: bytes < 0 ? null : Math.round(bytes / (1024 * 1024)),
        }),
      ]
    }),
  ),
)

/** Launch mode never paywalls a feature. Empty calls stay open for the billing guard. */
export function featureAllowed() {
  return LAUNCH_FREE_MODE === true
}

export const PLANS = Object.freeze(
  Object.fromEntries(PLAN_SEED.map((plan) => [plan.code, plan])),
)

/**
 * @param {string} code
 */
export function planByCode(code) {
  return PLANS[code] || null
}

/**
 * @param {string} code
 * @param {string} key
 * @returns {number | null}
 */
export function limitFor(code, key) {
  const plan = PLANS[code]
  if (!plan || !key) return null
  const value = plan.limits[key]
  return typeof value === 'number' ? value : null
}

/**
 * Whether a plan's seed includes a feature. This is not the launch gate.
 * @param {string} code
 * @param {string} feature
 */
export function planAllowsFeature(code, feature) {
  const plan = PLANS[code]
  if (!plan || typeof feature !== 'string') return false
  return plan.features.includes(feature)
}

/**
 * @param {readonly string[]} catalog
 * @returns {string[]}
 */
export function unknownSeedFeatures(catalog) {
  const allowed = new Set(catalog)
  const bad = []
  for (const plan of PLAN_SEED) {
    for (const feature of plan.features) {
      if (!allowed.has(feature)) bad.push(`${plan.code}:${feature}`)
    }
  }
  return bad
}
