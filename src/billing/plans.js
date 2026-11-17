/** Plan catalog for the billing screen. Numbers come from src/platform/plans.js. */

import { PLAN_LIMITS, PLAN_ORDER } from '../platform/plans.js'

export const PLAN_IDS = PLAN_ORDER

function limitsFor(id) {
  const base = PLAN_LIMITS[id] || PLAN_LIMITS.free
  return {
    members: base.members,
    projects: base.projects,
    notes: base.projects == null ? null : base.projects * 20,
    storageMb: base.storageMb,
    groups: base.groups,
    workspaces: base.workspaces,
  }
}

export const PLANS = Object.fromEntries(PLAN_IDS.map((id) => [id, { id, limits: limitsFor(id) }]))

export function listPlans() {
  return PLAN_IDS.map((id) => PLANS[id])
}

export function planById(id) {
  return PLANS[id] || PLANS.free
}
