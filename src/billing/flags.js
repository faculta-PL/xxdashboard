/** Launch stays free: every feature stays enabled and nothing is billed. */

import { planById } from './plans.js'
import { LAUNCH_FREE_MODE, featureAllowed } from '../platform/plans.js'

export { LAUNCH_FREE_MODE }

export function featureEnabled(feature) {
  return featureAllowed(feature)
}

/** While launch mode is on, quotas never block. */
export function guardQuota(planId, resource, count) {
  if (featureEnabled(resource)) return { ok: true, blocked: false }
  const limit = planById(planId).limits?.[resource]
  if (limit == null) return { ok: true, blocked: false }
  if (Number(count) >= limit) return { ok: false, blocked: true, limit }
  return { ok: true, blocked: false }
}
