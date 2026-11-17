import { useEffect } from 'react'
import { useI18n } from '../i18n.jsx'
import { getStoreSnapshot, ensureFreeSubscriptions } from '../lib/store.js'
import { listPlans } from './plans.js'
import { LAUNCH_FREE_MODE } from './flags.js'
import { billingT } from './i18n.js'
import { moduleCounts } from './access.js'
import { subscriptionOf } from './subscription.js'

const STAT_KEYS = [
  ['users', 'stats.users'],
  ['workspaces', 'stats.workspaces'],
  ['groups', 'stats.groups'],
  ['projects', 'stats.projects'],
  ['pendingInvites', 'stats.pending'],
]

function limitLabel(lang, key, value) {
  if (value == null) return billingT(lang, 'billing.unlimited')
  if (key === 'storageMb') return billingT(lang, 'billing.storage', { n: value })
  return String(value)
}

export function BillingPanel({ user, activeOrgId }) {
  const { lang } = useI18n()
  const snapshot = getStoreSnapshot()
  const counts = moduleCounts(snapshot, activeOrgId)
  const plans = listPlans()
  const current = subscriptionOf(snapshot.xx_orgs?.[activeOrgId])

  useEffect(() => {
    ensureFreeSubscriptions(user).catch(() => {})
  }, [user])

  return (
    <section className="rounded-2xl border border-sage-200 bg-white/80 p-4" data-testid="billing-panel">
      <p
        className="rounded-xl border border-sage-300 bg-sage-50 px-3 py-2 text-sm font-medium text-sage-900"
        data-testid="billing-free-banner"
        role="status"
      >
        {billingT(lang, 'billing.banner')}
      </p>
      <div className="mt-4 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-display text-lg text-sage-900">{billingT(lang, 'billing.title')}</h3>
        <p className="text-xs font-semibold uppercase tracking-wide text-sage-500">
          {LAUNCH_FREE_MODE ? billingT(lang, 'billing.freeMode') : billingT(lang, 'billing.inactive')}
          {' · '}
          {billingT(lang, 'billing.inactive')}
          {' · '}
          {current.planId} / {current.status}
        </p>
      </div>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {plans.map((plan) => (
          <li key={plan.id} className="rounded-xl border border-sage-200 bg-sage-50/80 px-3 py-2 text-sm">
            <p className="font-semibold text-sage-900">{billingT(lang, `plan.${plan.id}`)}</p>
            <ul className="mt-1 space-y-0.5 text-xs text-sage-600">
              {Object.entries(plan.limits).map(([key, value]) => (
                <li key={key}>
                  {billingT(lang, `limit.${key}`)}: {limitLabel(lang, key, value)}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
      <div className="mt-4" data-testid="module-stats">
        <h3 className="font-display text-lg text-sage-900">{billingT(lang, 'stats.title')}</h3>
        <p className="mt-1 text-xs text-sage-500">{billingT(lang, 'stats.hint')}</p>
        <ul className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {STAT_KEYS.map(([key, label]) => (
            <li key={key} className="rounded-xl bg-sage-50 px-3 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-sage-500">{billingT(lang, label)}</p>
              <p className="font-display text-xl text-sage-900">{counts[key]}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
