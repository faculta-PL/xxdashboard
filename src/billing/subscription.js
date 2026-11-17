/** Inactive subscription stored on a workspace. Launch default is free. */

export const FREE_SUBSCRIPTION = { planId: 'free', status: 'free' }

export const ACTIVE_ORG_KEY = 'nazix_active_org'
export const ACTIVE_WORKSPACE_KEY = 'nazix_active_workspace'

export function readWorkspaceId(storage) {
  const store = storage || (typeof localStorage !== 'undefined' ? localStorage : null)
  if (!store) return ''
  try {
    return store.getItem(ACTIVE_ORG_KEY) || store.getItem(ACTIVE_WORKSPACE_KEY) || ''
  } catch {
    return ''
  }
}

export function subscriptionOf(workspace) {
  const sub = workspace?.subscription
  if (sub && sub.planId && sub.status) {
    return { planId: String(sub.planId), status: String(sub.status) }
  }
  return { planId: FREE_SUBSCRIPTION.planId, status: FREE_SUBSCRIPTION.status }
}

export function withFreeSubscription(workspace) {
  const current = workspace && typeof workspace === 'object' ? workspace : {}
  return { ...current, subscription: subscriptionOf(current) }
}
