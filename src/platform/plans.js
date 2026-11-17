/** Plan limits live here only. Launch does not bill or block features. */

export const LAUNCH_FREE_MODE = true

export const PLAN_ORDER = ['free', 'pro', 'business', 'enterprise']

export const PLAN_LIMITS = {
  free: { workspaces: 3, members: 15, groups: 10, projects: 20, storageMb: 200 },
  pro: { workspaces: 10, members: 50, groups: 40, projects: 100, storageMb: 5000 },
  business: { workspaces: 30, members: 200, groups: 150, projects: 500, storageMb: 20000 },
  enterprise: { workspaces: 200, members: 2000, groups: 1000, projects: 5000, storageMb: 200000 },
}

export const PLAN_CATALOG = PLAN_ORDER.map((id) => ({
  id,
  name: id,
  limits: PLAN_LIMITS[id],
  status: 'prepared',
}))

export function featureAllowed() {
  if (LAUNCH_FREE_MODE) return true
  return false
}

export function subscriptionForWorkspace(workspaceId, now = new Date().toISOString()) {
  return {
    id: `sub_${workspaceId}`,
    workspaceId,
    orgId: workspaceId,
    planId: 'free',
    status: 'free',
    createdAt: now,
  }
}
