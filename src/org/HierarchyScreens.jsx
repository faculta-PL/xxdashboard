import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Building2, Layers, Users } from 'lucide-react'
import { EmptyState, btnGhost, btnPrimary, inputClass } from '../components/ui'
import { InvitationDesk } from '../identity'
import { useI18n } from '../i18n'
import { normalizeEmoji } from '../spaces/model.js'
import { workspaceInitials } from '../spaces/model.js'
import {
  createExtraSpace,
  createTeam,
  listMembersOfOrg,
  placeUserInOrg,
  removeOrgMember,
  selectSpace,
  spaces,
} from '../lib/store'

function ScrollModal({ title, onClose, children, footer }) {
  const { t } = useI18n()
  if (typeof document === 'undefined') return null
  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-ink/45 p-4 pt-[max(1.5rem,env(safe-area-inset-top))]">
      <button type="button" className="absolute inset-0" aria-label={t('common.close')} onClick={onClose} />
      <div className="relative z-10 flex max-h-[min(90vh,40rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-sage-200 bg-sage-50 shadow-2xl">
        <div className="sticky top-0 shrink-0 border-b border-sage-200 bg-sage-50 px-5 py-4">
          <h3 className="font-display text-xl text-sage-900">{title}</h3>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        <div className="sticky bottom-0 flex shrink-0 flex-wrap justify-end gap-2 border-t border-sage-200 bg-sage-50 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {footer}
        </div>
      </div>
    </div>,
    document.body,
  )
}

export function CreateOrgModal({ open, busy, onClose, onSubmit }) {
  const { t } = useI18n()
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [description, setDescription] = useState('')
  const [logo, setLogo] = useState('')
  const [error, setError] = useState('')
  useEffect(() => {
    if (!open) return
    setName('')
    setSlug('')
    setDescription('')
    setLogo('')
    setError('')
  }, [open])
  if (!open) return null
  const submit = (event) => {
    event.preventDefault()
    if (name.trim().length < 2) {
      setError(t('orgs.needName'))
      return
    }
    let emoji = ''
    try {
      emoji = normalizeEmoji(logo)
    } catch (err) {
      setError(err.message || t('orgs.error'))
      return
    }
    onSubmit({ name: name.trim(), slug: slug.trim(), description: description.trim(), emoji })
  }
  return (
    <ScrollModal
      title={t('hier.createOrg')}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={btnGhost} onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="submit" form="create-org-form" className={btnPrimary} disabled={busy}>
            {t('hier.createOrg')}
          </button>
        </>
      }
    >
      <form id="create-org-form" onSubmit={submit} className="space-y-3">
        <p className="text-sm text-sage-600">{t('orgs.createHint')}</p>
        {error ? <p className="text-sm font-medium text-danger">{error}</p> : null}
        <label className="block text-sm font-medium text-sage-800">
          {t('orgs.name')}
          <input className={inputClass + ' mt-1'} value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label className="block text-sm font-medium text-sage-800">
          {t('hier.slug')}
          <input className={inputClass + ' mt-1'} value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="atelier-nord" />
          <span className="mt-1 block text-xs text-sage-500">{t('hier.slugHint')}</span>
        </label>
        <label className="block text-sm font-medium text-sage-800">
          {t('hier.description')} <span className="font-normal text-sage-500">({t('hier.optional')})</span>
          <textarea className={inputClass + ' mt-1'} value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
        </label>
        <label className="block text-sm font-medium text-sage-800">
          {t('hier.logo')} <span className="font-normal text-sage-500">({t('hier.optional')})</span>
          <input className={inputClass + ' mt-1'} value={logo} onChange={(e) => setLogo(e.target.value)} placeholder="🌿" />
          <span className="mt-1 block text-xs text-sage-500">{t('hier.logoHint')}</span>
        </label>
      </form>
    </ScrollModal>
  )
}

export function PersonalBanner({ hasOrg, orgName, onCreate, onOverview }) {
  const { t } = useI18n()
  return (
    <section className="mb-4 rounded-2xl border border-sage-200 bg-white/80 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sage-500">{t('hier.personalTitle')}</p>
      <p className="mt-1 text-sm text-sage-700">{t('hier.personalHint')}</p>
      <p className="mt-1 text-sm text-sage-600">{t('hier.joinHint')}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className={btnPrimary} onClick={onCreate}>
          {t('hier.createOrg')}
        </button>
        {hasOrg ? (
          <button type="button" className={btnGhost} onClick={onOverview}>
            {orgName ? `${t('hier.openOverview')} · ${orgName}` : t('hier.openOverview')}
          </button>
        ) : null}
      </div>
    </section>
  )
}

export function NeedOrg({ onCreate }) {
  const { t } = useI18n()
  return (
    <EmptyState
      title={t('hier.needTitle')}
      hint={t('hier.needHint')}
      icon={Building2}
      action={
        <button type="button" className={btnPrimary + ' mt-4'} onClick={onCreate}>
          {t('hier.createOrg')}
        </button>
      }
    />
  )
}

export function NotesIdeasSwitch({ view, onView }) {
  const { t } = useI18n()
  const tabs = [
    ['notes', t('hier.notesTab')],
    ['ideas', t('hier.ideasTab')],
    ['important', t('hier.importantTab')],
  ]
  return (
    <div className="mb-4 flex flex-wrap gap-2" role="tablist">
      {tabs.map(([id, label]) => (
        <button key={id} type="button" role="tab" aria-selected={view === id} className={view === id ? btnPrimary : btnGhost} onClick={() => onView(id)}>
          {label}
        </button>
      ))}
    </div>
  )
}

export function InviteOffer({ onInvite, onLater }) {
  const { t } = useI18n()
  return (
    <section className="rounded-2xl border border-sage-200 bg-white/80 p-4">
      <p className="font-medium text-sage-900">{t('hier.inviteOffer')}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className={btnPrimary} onClick={onInvite}>
          {t('hier.inviteNext')}
        </button>
        <button type="button" className={btnGhost} onClick={onLater}>
          {t('hier.inviteLater')}
        </button>
      </div>
    </section>
  )
}

function personLabel(users, userId, youId, youLabel) {
  if (userId && userId === youId) return youLabel
  const user = (users || []).find((item) => item.id === userId)
  return user?.fullName || user?.email || userId || '—'
}

export function OrgOverview({ user, db, orgId, onInvite, onOpenSpaces, inviteOffer, onDismissInvite }) {
  const { t } = useI18n()
  const org = db?.xx_orgs?.[orgId]
  const spaces = Object.values(db?.xx_spaces || {}).filter((space) => (space.organizationId || space.orgId) === orgId)
  const general = spaces.find((space) => space.kind === 'general')
  const members = listMembersOfOrg(orgId).filter((member) => member.status !== 'pending' && member.status !== 'revoked')
  const active = db?.xx_spaces?.[db?.activeSpaceId] || general
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sage-500">{t('nav.overview')}</p>
        <h2 className="font-display text-3xl text-sage-900">{org?.name || t('nav.overview')}</h2>
        {org?.description ? <p className="mt-2 text-sm text-sage-700">{org.description}</p> : null}
      </div>
      {inviteOffer ? <InviteOffer onInvite={onInvite} onLater={onDismissInvite} /> : null}
      <div className="grid gap-3 sm:grid-cols-3">
        <article className="rounded-2xl border border-sage-200 bg-white/80 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-sage-500">{t('hier.activeSpace')}</p>
          <p className="mt-1 font-display text-xl text-sage-900">{active?.name || t('hier.general')}</p>
        </article>
        <article className="rounded-2xl border border-sage-200 bg-white/80 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-sage-500">{t('hier.tabMembers')}</p>
          <p className="mt-1 font-display text-xl text-sage-900">{t('hier.countMembers', { n: members.length })}</p>
        </article>
        <article className="rounded-2xl border border-sage-200 bg-white/80 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-sage-500">{t('nav.spaces')}</p>
          <p className="mt-1 font-display text-xl text-sage-900">{t('hier.countSpaces', { n: spaces.length })}</p>
        </article>
      </div>
      {general ? (
        <section className="rounded-2xl border border-sage-200 bg-white/80 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-sage-500">{t('hier.general')}</p>
          <h3 className="font-display text-2xl text-sage-900">{general.name}</h3>
          <p className="mt-1 text-sm text-sage-600">{personLabel(Object.values(db?.xx_users || {}), general.leadUserId, user?.id, t('orgs.you'))}</p>
          <button type="button" className={btnPrimary + ' mt-3'} onClick={onOpenSpaces}>
            {t('nav.spaces')}
          </button>
        </section>
      ) : (
        <EmptyState title={t('hier.overviewEmpty')} hint={t('hier.needHint')} action={null} />
      )}
      <button type="button" className={btnPrimary} onClick={onInvite}>
        {t('hier.overviewAction')}
      </button>
    </div>
  )
}

export function SpacesDesk({ user, db, orgId, users, flash, onOpen }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [leadUserId, setLeadUserId] = useState(user?.id || '')
  const [visibility, setVisibility] = useState('organization')
  const [memberIds, setMemberIds] = useState([])
  const [teamIds, setTeamIds] = useState([])
  const list = Object.values(db?.xx_spaces || {})
    .filter((space) => (space.organizationId || space.orgId) === orgId)
    .sort((a, b) => (a.kind === 'general' ? -1 : b.kind === 'general' ? 1 : String(a.name).localeCompare(String(b.name), 'fr')))
  const projects = Object.values(db?.xx_projects || {}).filter((project) => (project.organizationId || project.orgId) === orgId)
  const members = listMembersOfOrg(orgId).filter((member) => member.userId && member.status !== 'pending')
  const teams = Object.values(db?.xx_groups || {}).filter((group) => {
    const org = group.organizationId || group.orgId
    return org === orgId && !group.isGeneral && group.kind !== 'project' && !group.projectId
  })
  const extras = list.filter((space) => space.kind !== 'general')

  const toggle = (listIds, id, setter) => {
    setter(listIds.includes(id) ? listIds.filter((item) => item !== id) : [...listIds, id])
  }

  const create = async (event) => {
    event.preventDefault()
    setBusy(true)
    try {
      await createExtraSpace(user, { name, description, leadUserId, visibility, memberIds, teamIds })
      setOpen(false)
      setName('')
      setDescription('')
      flash?.(t('hier.saved'))
    } catch (err) {
      flash?.(err.message || t('orgs.error'), 'err')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sage-500">{t('nav.spaces')}</p>
          <h2 className="font-display text-3xl text-sage-900">{t('nav.spaces')}</h2>
        </div>
        <button type="button" className={btnPrimary} onClick={() => setOpen(true)}>
          {t('hier.createSpace')}
        </button>
      </div>
      <ul className="space-y-3">
        {list.map((space) => {
          const linked = projects.filter((project) => project.spaceId === space.id || (!project.spaceId && space.kind === 'general'))
          return (
            <li key={space.id} className="rounded-2xl border border-sage-200 bg-white/80 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-sage-500">{space.kind === 'general' ? t('hier.general') : t('hier.extra')}</p>
                  <h3 className="font-display text-2xl text-sage-900">{space.name}</h3>
                  {space.description ? <p className="mt-1 text-sm text-sage-600">{space.description}</p> : null}
                </div>
                <button
                  type="button"
                  className={btnPrimary}
                  onClick={() => {
                    selectSpace(space.id, user)
                    onOpen?.()
                  }}
                >
                  {t('hier.openSpace')}
                </button>
              </div>
              <p className="mt-3 text-sm font-medium text-sage-800">{t('hier.projectsHere')}</p>
              {linked.length === 0 ? (
                <p className="mt-1 text-sm text-sage-500">{t('hier.noProjects')}</p>
              ) : (
                <ul className="mt-1 list-disc pl-5 text-sm text-sage-700">
                  {linked.map((project) => (
                    <li key={project.id}>{project.title || project.name}</li>
                  ))}
                </ul>
              )}
            </li>
          )
        })}
      </ul>
      {extras.length === 0 ? (
        <EmptyState
          title={t('hier.spaceEmpty')}
          hint={t('hier.spaceEmptyHint')}
          icon={Layers}
          action={
            <button type="button" className={btnPrimary + ' mt-4'} onClick={() => setOpen(true)}>
              {t('hier.createSpace')}
            </button>
          }
        />
      ) : null}
      {open ? (
        <ScrollModal
          title={t('hier.createSpace')}
          onClose={() => setOpen(false)}
          footer={
            <>
              <button type="button" className={btnGhost} onClick={() => setOpen(false)}>
                {t('common.cancel')}
              </button>
              <button type="submit" form="create-space-form" className={btnPrimary} disabled={busy}>
                {t('hier.createSpace')}
              </button>
            </>
          }
        >
          <form id="create-space-form" onSubmit={create} className="space-y-3">
            <label className="block text-sm font-medium text-sage-800">
              {t('hier.spaceName')}
              <input className={inputClass + ' mt-1'} value={name} onChange={(e) => setName(e.target.value)} required />
            </label>
            <label className="block text-sm font-medium text-sage-800">
              {t('hier.description')}
              <textarea className={inputClass + ' mt-1'} value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
            </label>
            <label className="block text-sm font-medium text-sage-800">
              {t('hier.lead')}
              <select className={inputClass + ' mt-1'} value={leadUserId} onChange={(e) => setLeadUserId(e.target.value)}>
                {members.map((member) => (
                  <option key={member.userId} value={member.userId}>
                    {personLabel(users, member.userId, user?.id, t('orgs.you'))}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium text-sage-800">
              {t('hier.visibility')}
              <select className={inputClass + ' mt-1'} value={visibility} onChange={(e) => setVisibility(e.target.value)}>
                <option value="organization">{t('hier.visOrganization')}</option>
                <option value="members">{t('hier.visMembers')}</option>
                <option value="teams">{t('hier.visTeams')}</option>
                <option value="private">{t('hier.visPrivate')}</option>
              </select>
            </label>
            {visibility === 'members' || visibility === 'private' ? (
              <fieldset className="space-y-1">
                <legend className="text-sm font-medium text-sage-800">{t('hier.access')}</legend>
                {members.map((member) => (
                  <label key={member.userId} className="flex items-center gap-2 text-sm text-sage-800">
                    <input type="checkbox" checked={memberIds.includes(member.userId)} onChange={() => toggle(memberIds, member.userId, setMemberIds)} />
                    {personLabel(users, member.userId, user?.id, t('orgs.you'))}
                  </label>
                ))}
              </fieldset>
            ) : null}
            {visibility === 'teams' ? (
              <fieldset className="space-y-1">
                <legend className="text-sm font-medium text-sage-800">{t('hier.access')}</legend>
                {teams.length === 0 ? <p className="text-sm text-sage-500">{t('hier.teamEmpty')}</p> : null}
                {teams.map((team) => (
                  <label key={team.id} className="flex items-center gap-2 text-sm text-sage-800">
                    <input type="checkbox" checked={teamIds.includes(team.id)} onChange={() => toggle(teamIds, team.id, setTeamIds)} />
                    {team.name}
                  </label>
                ))}
              </fieldset>
            ) : null}
          </form>
        </ScrollModal>
      ) : null}
    </div>
  )
}

const ROLE_OPTIONS = ['owner', 'admin', 'member', 'guest']

function roleName(t, role) {
  if (role === 'owner') return t('orgs.owner')
  if (role === 'admin') return t('orgs.admin')
  if (role === 'guest') return t('hier.guest')
  return t('orgs.member')
}

export function MembersDesk({ user, db, orgId, users, allUsers, flash, initialTab = 'members', onUserUpdated, groups }) {
  const { t } = useI18n()
  const [tab, setTab] = useState(initialTab)
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [teamOpen, setTeamOpen] = useState(false)
  const [teamName, setTeamName] = useState('')
  const [teamSpace, setTeamSpace] = useState('')
  const [removeTarget, setRemoveTarget] = useState(null)
  useEffect(() => {
    setTab(initialTab)
  }, [initialTab])

  const members = listMembersOfOrg(orgId).filter((member) => member.status !== 'pending' && member.status !== 'revoked')
  const actor = members.find((member) => member.userId === user?.id)
  const canManage = actor?.role === 'owner' || actor?.role === 'admin'
  const filtered = members.filter((member) => {
    const label = `${personLabel(users, member.userId, '', '')} ${member.email || ''}`.toLowerCase()
    return label.includes(query.trim().toLowerCase())
  })
  const spaceList = Object.values(db?.xx_spaces || {}).filter((space) => (space.organizationId || space.orgId) === orgId)
  const teams = Object.values(db?.xx_groups || {}).filter((group) => {
    const org = group.organizationId || group.orgId
    if (org !== orgId || group.isGeneral || group.kind === 'project' || group.projectId) return false
    const role = actor?.role
    if (role === 'owner' || role === 'admin') return true
    return (group.memberIds || []).includes(user?.id) || group.ownerId === user?.id || group.leadUserId === user?.id
  })

  const tabs = [
    ['members', t('hier.tabMembers')],
    ['teams', t('hier.tabTeams')],
    ['invitations', t('hier.tabInvites')],
    ['permissions', t('hier.tabPermissions')],
  ]

  const changeRole = async (member, role) => {
    try {
      await placeUserInOrg({ orgId, userId: member.userId, email: member.email, role }, user)
      flash?.(t('hier.roleSaved'))
    } catch (err) {
      flash?.(err.message || t('hier.lastOwner'), 'err')
    }
  }

  const confirmRemove = async () => {
    if (!removeTarget) return
    setBusy(true)
    try {
      await removeOrgMember(orgId, removeTarget.userId, user)
      flash?.(t('hier.removed'))
      setRemoveTarget(null)
    } catch (err) {
      flash?.(err.message || t('hier.lastOwner'), 'err')
    } finally {
      setBusy(false)
    }
  }

  const saveTeam = async (event) => {
    event.preventDefault()
    setBusy(true)
    try {
      await createTeam(user, { name: teamName, spaceId: teamSpace })
      setTeamOpen(false)
      setTeamName('')
      setTeamSpace('')
      flash?.(t('hier.teamCreated'))
    } catch (err) {
      flash?.(err.message || t('orgs.error'), 'err')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sage-500">{t('nav.members')}</p>
        <h2 className="font-display text-3xl text-sage-900">{t('nav.members')}</h2>
      </div>
      <div className="flex flex-wrap gap-2" role="tablist">
        {tabs.map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? btnPrimary : btnGhost} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'members' ? (
        <section className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <input className={inputClass + ' max-w-md'} value={query} placeholder={t('hier.searchMembers')} onChange={(e) => setQuery(e.target.value)} />
            <button type="button" className={btnPrimary} onClick={() => setTab('invitations')}>
              {t('hier.inviteNext')}
            </button>
          </div>
          {filtered.length === 0 ? (
            <EmptyState title={t('hier.noMembers')} hint={t('orgs.emptyMembers')} icon={Users} action={null} />
          ) : (
            <ul className="divide-y divide-sage-100 rounded-2xl border border-sage-200 bg-white/80 px-4">
              {filtered.map((member) => (
                <li key={member.id} className="flex flex-wrap items-center gap-2 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-sage-900">{personLabel(users, member.userId, user?.id, t('orgs.you'))}</p>
                    <p className="truncate text-xs text-sage-500">{member.email}</p>
                  </div>
                  <span className="text-xs font-semibold text-sage-700">{roleName(t, member.role)}</span>
                  {canManage ? (
                    <button type="button" className={btnGhost + ' !text-danger'} onClick={() => setRemoveTarget(member)}>
                      {t('hier.remove')}
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {tab === 'teams' ? (
        <section className="space-y-3">
          <button type="button" className={btnPrimary} onClick={() => setTeamOpen(true)}>
            {t('hier.createTeam')}
          </button>
          {teams.length === 0 ? (
            <EmptyState title={t('hier.teamEmpty')} hint={t('hier.teamEmptyHint')} icon={Users} action={null} />
          ) : (
            <ul className="space-y-2">
              {teams.map((team) => (
                <li key={team.id} className="rounded-2xl border border-sage-200 bg-white/80 p-4">
                  <p className="font-display text-xl text-sage-900">{team.name}</p>
                  <p className="text-sm text-sage-600">
                    {t('hier.privateTeam')}
                    {team.spaceId ? ` · ${spaceList.find((space) => space.id === team.spaceId)?.name || ''}` : ''}
                  </p>
                  <p className="mt-1 text-xs text-sage-500">{(team.memberIds || []).length}</p>
                </li>
              ))}
            </ul>
          )}
          {teamOpen ? (
            <ScrollModal
              title={t('hier.createTeam')}
              onClose={() => setTeamOpen(false)}
              footer={
                <>
                  <button type="button" className={btnGhost} onClick={() => setTeamOpen(false)}>
                    {t('common.cancel')}
                  </button>
                  <button type="submit" form="create-team-form" className={btnPrimary} disabled={busy}>
                    {t('hier.createTeam')}
                  </button>
                </>
              }
            >
              <form id="create-team-form" onSubmit={saveTeam} className="space-y-3">
                <label className="block text-sm font-medium text-sage-800">
                  {t('hier.teamName')}
                  <input className={inputClass + ' mt-1'} value={teamName} onChange={(e) => setTeamName(e.target.value)} required />
                </label>
                <label className="block text-sm font-medium text-sage-800">
                  {t('hier.teamSpace')} <span className="font-normal text-sage-500">({t('hier.optional')})</span>
                  <select className={inputClass + ' mt-1'} value={teamSpace} onChange={(e) => setTeamSpace(e.target.value)}>
                    <option value="">{t('hier.teamSpaceNone')}</option>
                    {spaceList.map((space) => (
                      <option key={space.id} value={space.id}>
                        {space.name}
                      </option>
                    ))}
                  </select>
                </label>
              </form>
            </ScrollModal>
          ) : null}
        </section>
      ) : null}

      {tab === 'invitations' ? (
        <InvitationDesk user={user} orgId={orgId} groups={groups} directory={allUsers} flash={flash} onUserUpdated={onUserUpdated} />
      ) : null}

      {tab === 'permissions' ? (
        <section className="space-y-3">
          <ul className="space-y-2 rounded-2xl border border-sage-200 bg-white/80 p-4 text-sm text-sage-700">
            <li>{t('hier.permOwner')}</li>
            <li>{t('hier.permAdmin')}</li>
            <li>{t('hier.permMember')}</li>
            <li>{t('hier.permGuest')}</li>
          </ul>
          <ul className="divide-y divide-sage-100 rounded-2xl border border-sage-200 bg-white/80 px-4">
            {members.map((member) => (
              <li key={member.id} className="flex flex-wrap items-center gap-2 py-3">
                <p className="min-w-0 flex-1 truncate text-sm font-medium text-sage-900">{personLabel(users, member.userId, user?.id, t('orgs.you'))}</p>
                {canManage ? (
                  <select className={inputClass + ' !w-auto'} value={member.role} onChange={(e) => changeRole(member, e.target.value)}>
                    {ROLE_OPTIONS.map((role) => (
                      <option key={role} value={role} disabled={role === 'owner' && actor?.role !== 'owner'}>
                        {roleName(t, role)}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="text-xs font-semibold text-sage-700">{roleName(t, member.role)}</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {removeTarget ? (
        <ScrollModal
          title={t('hier.removeTitle')}
          onClose={() => setRemoveTarget(null)}
          footer={
            <>
              <button type="button" className={btnGhost} onClick={() => setRemoveTarget(null)}>
                {t('common.cancel')}
              </button>
              <button type="button" className={btnPrimary + ' !bg-danger'} disabled={busy} onClick={confirmRemove}>
                {t('hier.remove')}
              </button>
            </>
          }
        >
          <p className="text-sm text-sage-700">{t('hier.removeBody')}</p>
        </ScrollModal>
      ) : null}
    </div>
  )
}

export function OrgSettings({ user, db, orgId, flash, onDeleted }) {
  const { t } = useI18n()
  const org = db?.xx_orgs?.[orgId]
  const members = listMembersOfOrg(orgId)
  const isOwner = members.some((member) => member.userId === user?.id && member.role === 'owner')
  const [name, setName] = useState(org?.name || '')
  const [slug, setSlug] = useState(org?.slug || '')
  const [description, setDescription] = useState(org?.description || '')
  const [emoji, setEmoji] = useState(org?.emoji || org?.logo || '')
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    setName(org?.name || '')
    setSlug(org?.slug || '')
    setDescription(org?.description || '')
    setEmoji(org?.emoji || org?.logo || '')
  }, [org?.id, org?.name, org?.slug, org?.description, org?.emoji, org?.logo])

  const save = async (event) => {
    event.preventDefault()
    setBusy(true)
    try {
      const mark = normalizeEmoji(emoji)
      await spaces.updateWorkspace(user, orgId, { name, slug, description, emoji: mark })
      flash?.(t('hier.settingsSaved'))
    } catch (err) {
      flash?.(err.message || t('orgs.error'), 'err')
    } finally {
      setBusy(false)
    }
  }

  const remove = async (event) => {
    event.preventDefault()
    setBusy(true)
    try {
      await spaces.deleteWorkspace(user, orgId, typed)
      flash?.(t('hier.deleted'))
      onDeleted?.()
    } catch (err) {
      flash?.(err.message || t('orgs.error'), 'err')
    } finally {
      setBusy(false)
    }
  }

  if (!org) return null
  const mark = org.emoji || workspaceInitials(org.name)
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div className="flex items-center gap-3">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-sage-200 text-lg font-semibold text-sage-800">{mark}</span>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sage-500">{t('nav.orgsettings')}</p>
          <h2 className="font-display text-3xl text-sage-900">{org.name}</h2>
        </div>
      </div>
      <form onSubmit={save} className="space-y-3 rounded-2xl border border-sage-200 bg-white/80 p-4">
        <label className="block text-sm font-medium text-sage-800">
          {t('orgs.name')}
          <input className={inputClass + ' mt-1'} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="block text-sm font-medium text-sage-800">
          {t('hier.slug')}
          <input className={inputClass + ' mt-1'} value={slug} onChange={(e) => setSlug(e.target.value)} />
        </label>
        <label className="block text-sm font-medium text-sage-800">
          {t('hier.description')}
          <textarea className={inputClass + ' mt-1'} value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
        </label>
        <label className="block text-sm font-medium text-sage-800">
          {t('hier.logo')}
          <input className={inputClass + ' mt-1'} value={emoji} onChange={(e) => setEmoji(e.target.value)} placeholder="🌿" />
        </label>
        <button type="submit" className={btnPrimary} disabled={busy}>
          {t('common.save')}
        </button>
      </form>
      {isOwner ? (
        <form onSubmit={remove} className="space-y-3 rounded-2xl border border-danger/30 bg-white/80 p-4">
          <h3 className="font-display text-xl text-sage-900">{t('hier.deleteOrg')}</h3>
          <p className="text-sm text-sage-600">{t('hier.deleteHint')}</p>
          <input className={inputClass} value={typed} aria-label={t('hier.typeName')} placeholder={org.name} onChange={(e) => setTyped(e.target.value)} />
          <button type="submit" className={btnPrimary + ' !bg-danger'} disabled={busy || typed.trim() !== org.name}>
            {t('hier.deleteOrg')}
          </button>
        </form>
      ) : null}
    </div>
  )
}

export function useOrgChoices(db, userId) {
  return useMemo(() => {
    if (!db || !userId) return []
    const seen = new Set()
    return Object.values(db.xx_org_members || {})
      .filter((member) => member.userId === userId && member.status !== 'pending' && member.status !== 'revoked')
      .map((member) => db.xx_orgs?.[member.orgId])
      .filter((org) => {
        if (!org?.id || seen.has(org.id)) return false
        seen.add(org.id)
        return true
      })
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'fr'))
  }, [db, userId])
}
