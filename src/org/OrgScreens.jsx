import { useEffect, useState } from 'react'
import { Building2, Eye, Trash2, UserPlus } from 'lucide-react'
import { useI18n } from '../i18n'
import { isAdmin } from '../lib/rbac'
import {
  canManageOrg,
  createOrganization,
  deleteOrganization,
  listAllFeedback,
  listMembersOfOrg,
  listOrganizations,
  loadOrgPeek,
  placeUserInOrg,
  removeOrgMember,
  selectOrganization,
} from '../lib/store'

const inputClass =
  'w-full min-h-11 rounded-xl border border-sage-300 bg-white px-3 py-2.5 text-sage-900 outline-none ring-sage-400 placeholder:text-sage-400 focus:ring-2'
const btnPrimary =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-sage-700 px-4 py-2.5 text-sm font-semibold text-sage-50 transition hover:bg-sage-800 disabled:opacity-50'
const btnGhost =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-sage-300 bg-white/70 px-3 py-2 text-sm font-medium text-sage-800 transition hover:bg-sage-100'

function roleLabel(t, role) {
  if (role === 'owner') return t('orgs.owner')
  if (role === 'admin') return t('orgs.admin')
  return t('orgs.member')
}

export function OrgSwitcher({ user, activeOrgId, onSwitch }) {
  const { t } = useI18n()
  const orgs = listOrganizations().filter((org) =>
    listMembersOfOrg(org.id).some((m) => m.userId === user?.id),
  )
  const current = orgs.find((org) => org.id === activeOrgId)
  if (!current && orgs.length === 0) return null
  return (
    <label className="hidden min-w-0 items-center gap-2 text-xs font-semibold text-sage-700 sm:flex">
      <Building2 size={16} aria-hidden="true" />
      <span className="sr-only">{t('orgs.current')}</span>
      <select
        className="max-w-[12rem] truncate rounded-lg border border-sage-300 bg-white/90 px-2 py-1.5 text-sm text-sage-900"
        value={activeOrgId || ''}
        aria-label={t('orgs.switch')}
        onChange={(e) => onSwitch(e.target.value)}
      >
        {orgs.map((org) => (
          <option key={org.id} value={org.id}>
            {org.name}
          </option>
        ))}
      </select>
    </label>
  )
}

export function SyncBadge({ status }) {
  const { t } = useI18n()
  const key = status === 'live' || status === 'offline' || status === 'local' ? status : 'local'
  const tone =
    key === 'live' ? 'bg-ok/15 text-ok' : key === 'offline' ? 'bg-warn/15 text-warn' : 'bg-sage-200 text-sage-700'
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-1 text-[11px] font-semibold ${tone}`} title={t('sync.label')}>
      {t(`sync.${key}`)}
    </span>
  )
}

export function OrgGate({ user, memberships, onLogout }) {
  const { t } = useI18n()
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const several = memberships.length > 1

  const create = async (e) => {
    e.preventDefault()
    if (name.trim().length < 2) {
      setError(t('orgs.needName'))
      return
    }
    setBusy(true)
    setError('')
    try {
      await createOrganization(name.trim(), user)
    } catch (err) {
      setError(err.message || t('orgs.error'))
    } finally {
      setBusy(false)
    }
  }

  const enter = async (orgId) => {
    setBusy(true)
    setError('')
    try {
      selectOrganization(orgId, user)
    } catch (err) {
      setError(err.message || t('orgs.error'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-lg flex-col justify-center px-4 py-10">
      <p className="font-display text-3xl text-sage-900">Nazix</p>
      <h1 className="mt-2 font-display text-2xl text-sage-800">{several ? t('orgs.pickTitle') : t('orgs.noneTitle')}</h1>
      <p className="mt-2 text-sm text-sage-600">{several ? t('orgs.pickHint') : t('orgs.noneHint')}</p>
      {error ? (
        <p className="mt-3 text-sm font-medium text-danger" role="alert">
          {error}
        </p>
      ) : null}
      {several ? (
        <ul className="mt-4 space-y-2">
          {memberships.map((m) => {
            const org = listOrganizations().find((o) => o.id === m.orgId)
            return (
              <li key={m.id}>
                <button type="button" className={btnPrimary + ' w-full justify-between'} disabled={busy} onClick={() => enter(m.orgId)}>
                  <span className="truncate">{org?.name || m.orgId}</span>
                  <span className="text-xs opacity-80">{roleLabel(t, m.role)}</span>
                </button>
              </li>
            )
          })}
        </ul>
      ) : (
        <div className="mt-5 space-y-4">
          <form onSubmit={create} className="rounded-2xl border border-sage-200 bg-white/80 p-4">
            <h2 className="font-display text-lg text-sage-900">{t('orgs.create')}</h2>
            <p className="mt-1 text-sm text-sage-600">{t('orgs.createHint')}</p>
            <label className="mt-3 block text-sm font-medium text-sage-800">
              {t('orgs.name')}
              <input className={inputClass + ' mt-1'} value={name} onChange={(e) => setName(e.target.value)} placeholder={t('orgs.namePh')} />
            </label>
            <button type="submit" className={btnPrimary + ' mt-3'} disabled={busy}>
              {t('orgs.create')}
            </button>
          </form>
          <div className="rounded-2xl border border-dashed border-sage-300 p-4">
            <h2 className="font-display text-lg text-sage-900">{t('orgs.wait')}</h2>
            <p className="mt-1 text-sm text-sage-600">{t('orgs.waitHint')}</p>
          </div>
        </div>
      )}
      <button type="button" className={btnGhost + ' mt-6'} onClick={onLogout}>
        {t('nav.logout')}
      </button>
    </div>
  )
}

export function OrgHome({ user, activeOrgId, flash }) {
  const { t } = useI18n()
  const org = listOrganizations().find((o) => o.id === activeOrgId)
  const members = listMembersOfOrg(activeOrgId)
  const manage = canManageOrg(user, activeOrgId)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('member')
  const [busy, setBusy] = useState(false)

  const invite = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      await placeUserInOrg({ orgId: activeOrgId, email, role }, user)
      setEmail('')
      flash(t('orgs.invited'))
    } catch (err) {
      flash(err.message || t('orgs.notFound'), 'err')
    } finally {
      setBusy(false)
    }
  }

  const changeRole = async (member, next) => {
    try {
      await placeUserInOrg({ orgId: activeOrgId, userId: member.userId, email: member.email, role: next }, user)
      flash(t('orgs.saveRole'))
    } catch (err) {
      flash(err.message || t('orgs.error'), 'err')
    }
  }

  const remove = async (member) => {
    try {
      await removeOrgMember(activeOrgId, member.userId, user)
      flash(t('orgs.removed'))
    } catch (err) {
      flash(err.message || t('orgs.lastOwner'), 'err')
    }
  }

  return (
    <div className="space-y-4 animate-fade-up">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sage-500">{t('orgs.title')}</p>
        <h2 className="font-display text-2xl text-sage-900">{org?.name || t('orgs.title')}</h2>
      </div>
      {manage && (
        <form onSubmit={invite} className="rounded-2xl border border-sage-200 bg-white/80 p-4">
          <h3 className="flex items-center gap-2 font-display text-lg text-sage-900">
            <UserPlus size={18} /> {t('orgs.invite')}
          </h3>
          <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_10rem_auto]">
            <input className={inputClass} type="email" required value={email} placeholder={t('orgs.invitePh')} onChange={(e) => setEmail(e.target.value)} />
            <select className={inputClass} value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="member">{t('orgs.member')}</option>
              <option value="admin">{t('orgs.admin')}</option>
              {orgRoleIsOwner(user, activeOrgId) || isAdmin(user) ? <option value="owner">{t('orgs.owner')}</option> : null}
            </select>
            <button className={btnPrimary} disabled={busy} type="submit">
              {t('orgs.invite')}
            </button>
          </div>
        </form>
      )}
      <section className="rounded-2xl border border-sage-200 bg-white/80 p-4">
        <h3 className="font-display text-lg text-sage-900">{t('orgs.members')}</h3>
        {members.length === 0 ? (
          <p className="mt-2 text-sm text-sage-500">{t('orgs.emptyMembers')}</p>
        ) : (
          <ul className="mt-2 divide-y divide-sage-100">
            {members.map((member) => (
              <li key={member.id} className="flex flex-wrap items-center gap-2 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-sage-900">{member.email}</p>
                  <p className="text-xs text-sage-500">{member.userId === user.id ? t('orgs.you') : roleLabel(t, member.role)}</p>
                </div>
                {manage && (
                  <>
                    <select className={inputClass + ' !w-auto'} value={member.role} onChange={(e) => changeRole(member, e.target.value)}>
                      <option value="member">{t('orgs.member')}</option>
                      <option value="admin">{t('orgs.admin')}</option>
                      <option value="owner">{t('orgs.owner')}</option>
                    </select>
                    <button type="button" className={btnGhost + ' !text-danger'} onClick={() => remove(member)}>
                      {t('orgs.remove')}
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function orgRoleIsOwner(user, orgId) {
  return listMembersOfOrg(orgId).some((m) => m.userId === user.id && m.role === 'owner')
}

export function OrgAdmin({ user, flash, peek }) {
  const { t } = useI18n()
  const orgs = listOrganizations()
  const [email, setEmail] = useState('')
  const [orgId, setOrgId] = useState(orgs[0]?.id || '')
  const [role, setRole] = useState('member')
  const [confirmName, setConfirmName] = useState('')
  const [deleteId, setDeleteId] = useState('')
  const [busy, setBusy] = useState(false)
  if (!isAdmin(user)) return null

  const place = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      await placeUserInOrg({ orgId, email, role }, user)
      setEmail('')
      flash(t('orgs.invited'))
    } catch (err) {
      flash(err.message || t('orgs.notFound'), 'err')
    } finally {
      setBusy(false)
    }
  }

  const remove = async (org, member) => {
    try {
      await removeOrgMember(org, member.userId, user)
      flash(t('orgs.removed'))
    } catch (err) {
      flash(err.message || t('orgs.error'), 'err')
    }
  }

  const destroy = async (org) => {
    if (confirmName.trim() !== org.name) {
      flash(t('orgs.typeName'), 'err')
      return
    }
    setBusy(true)
    try {
      await deleteOrganization(org.id, user)
      setDeleteId('')
      setConfirmName('')
      flash(t('orgs.deleted'))
    } catch (err) {
      flash(err.message || t('orgs.error'), 'err')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4 animate-fade-up">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sage-500">{t('nav.orgadmin')}</p>
        <h2 className="font-display text-2xl text-sage-900">{t('orgs.superTitle')}</h2>
        <p className="mt-1 text-sm text-sage-600">{t('orgs.superHint')}</p>
      </div>
      <section className="rounded-2xl border border-sage-200 bg-white/80 p-4">
        <h3 className="font-display text-lg">{t('feedback.inbox')}</h3>
        <p className="mt-1 text-sm text-sage-600">{t('feedback.inboxHint')}</p>
        <ul className="mt-3 space-y-2">
          {listAllFeedback()
            .slice()
            .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
            .slice(0, 40)
            .map((item) => (
              <li key={item.id} className="rounded-xl bg-sage-50 px-3 py-2 text-sm">
                <p className="font-semibold text-sage-900">{item.title}</p>
                <p className="text-xs text-sage-600">
                  {t('feedback.orgLabel')} {listOrganizations().find((org) => org.id === item.orgId)?.name || item.orgId || '—'} · {item.status} · {item.module || '—'}
                </p>
              </li>
            ))}
        </ul>
      </section>
      <form onSubmit={place} className="rounded-2xl border border-sage-200 bg-white/80 p-4">
        <h3 className="font-display text-lg">{t('orgs.place')}</h3>
        <div className="mt-3 grid gap-2 md:grid-cols-4">
          <select className={inputClass} value={orgId} onChange={(e) => setOrgId(e.target.value)}>
            {orgs.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </select>
          <input className={inputClass} type="email" required placeholder={t('orgs.placeUser')} value={email} onChange={(e) => setEmail(e.target.value)} />
          <select className={inputClass} value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="member">{t('orgs.member')}</option>
            <option value="admin">{t('orgs.admin')}</option>
            <option value="owner">{t('orgs.owner')}</option>
          </select>
          <button className={btnPrimary} disabled={busy || !orgId}>
            {t('orgs.place')}
          </button>
        </div>
      </form>
      {orgs.length === 0 ? (
        <p className="text-sm text-sage-500">{t('empty.orgHint')}</p>
      ) : (
        orgs.map((org) => {
          const members = listMembersOfOrg(org.id)
          const openPeek = peek?.orgId === org.id
          return (
            <section key={org.id} className="rounded-2xl border border-sage-200 bg-white/80 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-display text-lg text-sage-900">{org.name}</h3>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className={btnGhost} onClick={() => loadOrgPeek(openPeek ? '' : org.id)}>
                    <Eye size={16} /> {openPeek ? t('orgs.peekClose') : t('orgs.peek')}
                  </button>
                  <button type="button" className={btnGhost + ' !text-danger'} onClick={() => setDeleteId(deleteId === org.id ? '' : org.id)}>
                    <Trash2 size={16} /> {t('orgs.delete')}
                  </button>
                </div>
              </div>
              <p className="mt-1 text-xs text-sage-500">{t('orgs.peekHint')}</p>
              {members.length === 0 ? (
                <p className="mt-2 text-sm text-sage-500">{t('orgs.emptyMembers')}</p>
              ) : (
                <ul className="mt-2 divide-y divide-sage-100 text-sm">
                  {members.map((member) => (
                    <li key={member.id} className="flex items-center justify-between gap-2 py-2">
                      <span className="min-w-0 truncate">
                        {member.email} · {roleLabel(t, member.role)}
                      </span>
                      <button type="button" className={btnGhost + ' !min-h-9'} onClick={() => remove(org.id, member)}>
                        {t('orgs.remove')}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {openPeek && (
                <div className="mt-3 rounded-xl border border-warn/40 bg-warn/10 p-3 text-sm">
                  <p className="font-semibold text-sage-900">{t('orgs.peek')}</p>
                  {peek?.loading ? <p>{t('orgs.loading')}</p> : null}
                  {peek?.error ? <p className="text-danger">{peek.error}</p> : null}
                  {['xx_notes', 'xx_projects', 'xx_todos', 'xx_events', 'xx_feedback'].map((col) => (
                    <p key={col} className="mt-1 text-sage-700">
                      {col.replace('xx_', '')}: {(peek?.rows?.[col] || []).map((row) => row.title).filter(Boolean).slice(0, 8).join(' · ') || '—'}
                    </p>
                  ))}
                </div>
              )}
              {deleteId === org.id && (
                <div className="mt-3 rounded-xl border border-danger/30 p-3">
                  <p className="text-sm text-sage-800">{t('orgs.deleteConfirm', { name: org.name })}</p>
                  <p className="mt-1 text-xs text-sage-500">{t('orgs.deleteHint')}</p>
                  <input className={inputClass + ' mt-2'} value={confirmName} placeholder={t('orgs.typeName')} onChange={(e) => setConfirmName(e.target.value)} />
                  <button type="button" className={btnPrimary + ' mt-2 !bg-danger'} disabled={busy} onClick={() => destroy(org)}>
                    {t('orgs.delete')}
                  </button>
                </div>
              )}
            </section>
          )
        })
      )}
    </div>
  )
}

export function InstallBanner() {
  const { t } = useI18n()
  const [prompt, setPrompt] = useState(null)
  const [hidden, setHidden] = useState(() => {
    try {
      return sessionStorage.getItem('nazix_install_hide') === '1'
    } catch {
      return false
    }
  })
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const onPrompt = (event) => {
      event.preventDefault()
      setPrompt(event)
      setReady(true)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    const standalone = window.matchMedia?.('(display-mode: standalone)')?.matches
    if (standalone) setHidden(true)
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  if (hidden) return null
  const dismiss = () => {
    setHidden(true)
    try {
      sessionStorage.setItem('nazix_install_hide', '1')
    } catch {
      /* ignore */
    }
  }
  const install = async () => {
    if (!prompt) return
    prompt.prompt()
    try {
      await prompt.userChoice
    } catch {
      /* ignore */
    }
    setPrompt(null)
    dismiss()
  }

  return (
    <div className="mb-4 rounded-2xl border border-sage-300 bg-white/90 p-4">
      <p className="font-display text-lg text-sage-900">{t('mini.install')}</p>
      <p className="mt-1 text-sm text-sage-600">{t('mini.installHint')}</p>
      <p className="mt-1 text-sm text-sage-700">{t('mini.steps')}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {ready && prompt ? (
          <button type="button" className={btnPrimary} onClick={install}>
            {t('mini.installNow')}
          </button>
        ) : null}
        <button type="button" className={btnGhost} onClick={dismiss}>
          {t('mini.later')}
        </button>
      </div>
    </div>
  )
}
