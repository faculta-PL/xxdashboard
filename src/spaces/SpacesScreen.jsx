import { useState } from 'react'
import { StableChatPane } from '../chat'
import { btnGhost, btnPrimary, inputClass } from '../components/ui'
import { useI18n } from '../i18n'
import { spaces } from '../lib/store'
import { asWorkspace } from './model.js'
import {
  canArchiveGroup,
  canArchiveWorkspace,
  canCreateGroup,
  canDeleteWorkspace,
  canEditGroup,
  canEditWorkspaceProfile,
  canManageGroupRoster,
  canManageWorkspaceMembers,
  canPostInGroup,
  canSeeGroupContent,
  directoryOf,
  groupMembersOf,
  manageableGroups,
  visibleGroupMessages,
  visibleGroupNotes,
  visibleGroups,
  workspaceRole,
} from './permissions.js'
import { spacesRoleLabel, spacesStatusLabel, spacesT } from './i18n.js'
import { WorkspaceMark } from './WorkspaceSwitcher.jsx'

function personName(users, member, youId, youLabel) {
  if (member.userId && member.userId === youId) return youLabel
  const user = (users || []).find((item) => item.id === member.userId)
  return user?.fullName || member.email || member.userId || '—'
}

export function SpacesScreen({ user, db, orgId, users = [], flash }) {
  const { lang } = useI18n()
  const t = (key) => spacesT(lang, key)
  const workspace = asWorkspace(db?.xx_orgs?.[orgId], directoryOf(db, orgId))
  const role = workspaceRole(db, user?.id, orgId)
  const [tab, setTab] = useState('groups')
  const [busy, setBusy] = useState(false)
  const directory = directoryOf(db, orgId)
  const visible = visibleGroups(db, user, orgId)
  const managed = manageableGroups(db, user, orgId)
  const groups = [...managed, ...visible.filter((group) => !managed.some((item) => item.id === group.id))]

  const run = async (action, ok) => {
    setBusy(true)
    try {
      await action()
      if (ok) flash?.(ok)
    } catch (err) {
      flash?.(err.message || t('needName'), 'err')
    } finally {
      setBusy(false)
    }
  }

  if (!workspace) return null

  const tabs = [
    ['settings', t('settings')],
    ['people', t('people')],
    ['groups', t('groups')],
  ]

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex items-center gap-3">
        <WorkspaceMark workspace={workspace} />
        <div className="min-w-0">
          <h2 className="truncate font-display text-2xl text-sage-900">{workspace.name}</h2>
          <p className="text-sm text-sage-600">
            {spacesStatusLabel(lang, workspace.status)} · {spacesRoleLabel(lang, role)}
          </p>
        </div>
      </div>
      {role === 'guest' ? <p className="text-sm text-sage-600">{t('guestLimited')}</p> : null}
      {workspace.status !== 'active' ? <p className="text-sm text-sage-600">{t('archivedHide')}</p> : null}
      <div className="flex flex-wrap gap-2" role="tablist">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={tab === id ? btnPrimary : btnGhost}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 'settings' ? (
        <SettingsPane key={workspace.id} workspace={workspace} user={user} busy={busy} run={run} t={t} db={db} />
      ) : null}
      {tab === 'people' ? (
        <DirectoryPane
          directory={directory}
          users={users}
          user={user}
          orgId={orgId}
          busy={busy}
          run={run}
          t={t}
          lang={lang}
          db={db}
        />
      ) : null}
      {tab === 'groups' ? (
        <GroupsPane
          groups={groups}
          directory={directory}
          users={users}
          user={user}
          orgId={orgId}
          db={db}
          busy={busy}
          run={run}
          t={t}
          lang={lang}
        />
      ) : null}
    </div>
  )
}

function SettingsPane({ workspace, user, busy, run, t, db }) {
  const [name, setName] = useState(workspace.name || '')
  const [slug, setSlug] = useState(workspace.slug || '')
  const [description, setDescription] = useState(workspace.description || '')
  const [emoji, setEmoji] = useState(workspace.emoji || '')
  const [typed, setTyped] = useState('')
  const canEdit = canEditWorkspaceProfile(db, user, workspace.id)
  const owner = canArchiveWorkspace(db, user, workspace.id)

  return (
    <div className="space-y-4">
      <form
        className="rounded-2xl border border-sage-200 bg-white/80 p-4"
        onSubmit={(event) => {
          event.preventDefault()
          run(() => spaces.updateWorkspace(user, workspace.id, { name, slug, description, emoji }), t('saved'))
        }}
      >
        <label className="block text-sm font-medium text-sage-800">
          {t('name')}
          <input className={inputClass + ' mt-1'} value={name} disabled={!canEdit} onChange={(event) => setName(event.target.value)} />
        </label>
        <label className="mt-3 block text-sm font-medium text-sage-800">
          {t('slug')}
          <input className={inputClass + ' mt-1'} value={slug} disabled={!canEdit} onChange={(event) => setSlug(event.target.value)} />
        </label>
        <label className="mt-3 block text-sm font-medium text-sage-800">
          {t('description')}
          <textarea className={inputClass + ' mt-1'} value={description} disabled={!canEdit} onChange={(event) => setDescription(event.target.value)} />
        </label>
        <label className="mt-3 block text-sm font-medium text-sage-800">
          {t('emoji')}
          <input className={inputClass + ' mt-1'} value={emoji} disabled={!canEdit} onChange={(event) => setEmoji(event.target.value)} placeholder="🌿" />
        </label>
        <p className="mt-1 text-xs text-sage-500">{t('emojiHint')}</p>
        {canEdit ? (
          <button className={btnPrimary + ' mt-3'} disabled={busy} type="submit">
            {t('save')}
          </button>
        ) : null}
      </form>
      {owner ? (
        <div className="flex flex-wrap gap-2">
          {workspace.status === 'active' ? (
            <button type="button" className={btnGhost} disabled={busy} onClick={() => run(() => spaces.archiveWorkspace(user, workspace.id), t('saved'))}>
              {t('archive')}
            </button>
          ) : (
            <button type="button" className={btnGhost} disabled={busy} onClick={() => run(() => spaces.restoreWorkspace(user, workspace.id), t('saved'))}>
              {t('restore')}
            </button>
          )}
          {workspace.status !== 'suspended' ? (
            <button type="button" className={btnGhost} disabled={busy} onClick={() => run(() => spaces.suspendWorkspace(user, workspace.id), t('saved'))}>
              {t('suspend')}
            </button>
          ) : null}
        </div>
      ) : null}
      {canDeleteWorkspace(db, user, workspace.id) ? (
        <form
          className="rounded-2xl border border-danger/30 bg-white/80 p-4"
          onSubmit={(event) => {
            event.preventDefault()
            run(() => spaces.deleteWorkspace(user, workspace.id, typed), t('saved'))
          }}
        >
          <h3 className="font-display text-lg text-sage-900">{t('delete')}</h3>
          <p className="mt-1 text-sm text-sage-600">{t('deleteHint')}</p>
          <input
            className={inputClass + ' mt-3'}
            value={typed}
            aria-label={t('typedName')}
            onChange={(event) => setTyped(event.target.value)}
          />
          <button className={btnPrimary + ' mt-3 !bg-danger'} disabled={busy || typed.trim() !== workspace.name} type="submit">
            {t('delete')}
          </button>
        </form>
      ) : null}
    </div>
  )
}

function DirectoryPane({ directory, users, user, orgId, busy, run, t, lang, db }) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('member')
  const manage = canManageWorkspaceMembers(db, user, orgId)
  const actor = workspaceRole(db, user?.id, orgId)

  return (
    <div className="space-y-4">
      <p className="text-sm text-sage-600">{t('directoryHint')}</p>
      {manage ? (
        <form
          className="rounded-2xl border border-sage-200 bg-white/80 p-4"
          onSubmit={(event) => {
            event.preventDefault()
            run(async () => {
              await spaces.inviteMember(user, { orgId, email, role })
              setEmail('')
            }, t('invited'))
          }}
        >
          <div className="grid gap-2 sm:grid-cols-[1fr_10rem_auto]">
            <input className={inputClass} type="email" required value={email} placeholder={t('email')} onChange={(event) => setEmail(event.target.value)} />
            <select className={inputClass} value={role} aria-label={t('role')} onChange={(event) => setRole(event.target.value)}>
              <option value="guest">{t('role_guest')}</option>
              <option value="member">{t('role_member')}</option>
              <option value="admin">{t('role_admin')}</option>
              {actor === 'owner' ? <option value="owner">{t('role_owner')}</option> : null}
            </select>
            <button className={btnPrimary} disabled={busy} type="submit">
              {t('invite')}
            </button>
          </div>
        </form>
      ) : null}
      <ul className="divide-y divide-sage-100 rounded-2xl border border-sage-200 bg-white/80 px-4">
        {directory.map((member) => (
          <li key={member.id} className="flex flex-wrap items-center gap-2 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-sage-900">{personName(users, member, user.id, t('you'))}</p>
              <p className="text-xs text-sage-500">
                {spacesRoleLabel(lang, member.role)}
                {member.status === 'pending' ? ` · ${t('pending')}` : ''}
              </p>
            </div>
            {manage && member.userId ? (
              <select
                className={inputClass + ' !w-auto'}
                value={member.role}
                aria-label={t('role')}
                onChange={(event) => run(() => spaces.updateMemberRole(user, orgId, member.userId, event.target.value), t('saved'))}
              >
                <option value="guest">{t('role_guest')}</option>
                <option value="member">{t('role_member')}</option>
                <option value="admin">{t('role_admin')}</option>
                {actor === 'owner' || member.role === 'owner' ? <option value="owner">{t('role_owner')}</option> : null}
              </select>
            ) : null}
            {actor === 'owner' && member.userId && member.userId !== user.id && member.role !== 'guest' && member.status !== 'pending' ? (
              <button type="button" className={btnGhost} disabled={busy} onClick={() => run(() => spaces.transferOwnership(user, orgId, member.userId), t('transferred'))}>
                {t('transfer')}
              </button>
            ) : null}
            {manage ? (
              <button type="button" className={btnGhost + ' !text-danger'} disabled={busy} onClick={() => run(() => spaces.removeMember(user, orgId, member.userId), t('removedSpace'))}>
                {t('remove')}
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  )
}

function GroupsPane({ groups, directory, users, user, orgId, db, busy, run, t, lang }) {
  const [selectedId, setSelectedId] = useState(groups[0]?.id || '')
  const [name, setName] = useState('')
  const [type, setType] = useState('private')
  const [projectId, setProjectId] = useState('')
  const selected = groups.find((group) => group.id === selectedId) || null
  const canCreate = canCreateGroup(db, user, orgId)

  return (
    <div className="grid gap-4 lg:grid-cols-[16rem_minmax(0,1fr)]">
      <div className="space-y-3">
        {canCreate ? (
          <form
            className="rounded-2xl border border-sage-200 bg-white/80 p-3"
            onSubmit={(event) => {
              event.preventDefault()
              run(async () => {
                const group = await spaces.createGroup(user, { orgId, name, type, projectId })
                setName('')
                setProjectId('')
                setSelectedId(group.id)
              }, t('saved'))
            }}
          >
            <h3 className="font-display text-lg text-sage-900">{t('newGroup')}</h3>
            <input className={inputClass + ' mt-2'} value={name} placeholder={t('groupName')} onChange={(event) => setName(event.target.value)} />
            <select className={inputClass + ' mt-2'} value={type} aria-label={t('groupType')} onChange={(event) => setType(event.target.value)}>
              <option value="private">{t('type_private')}</option>
              <option value="internal">{t('type_internal')}</option>
              <option value="project">{t('type_project')}</option>
            </select>
            {type === 'project' ? (
              <input className={inputClass + ' mt-2'} value={projectId} placeholder={t('projectId')} onChange={(event) => setProjectId(event.target.value)} />
            ) : null}
            <button className={btnPrimary + ' mt-2'} disabled={busy} type="submit">
              {t('newGroup')}
            </button>
          </form>
        ) : null}
        {groups.length === 0 ? <p className="text-sm text-sage-500">{t('emptyGroups')}</p> : null}
        <ul className="max-h-[min(32rem,calc(100dvh-14rem))] space-y-1 overflow-y-auto overscroll-contain xx-scroll [overflow-anchor:none]">
          {groups.map((group) => (
            <li key={group.id}>
              <button
                type="button"
                className={`flex min-h-11 w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm ${
                  selectedId === group.id ? 'bg-sage-200 text-sage-900' : 'hover:bg-sage-100'
                }`}
                onClick={() => setSelectedId(group.id)}
              >
                <span className="truncate">{group.name}</span>
                <span className="text-[11px] uppercase text-sage-500">{t(`type_${group.type || 'private'}`)}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      {selected ? (
        <GroupDesk key={selected.id} group={selected} directory={directory} users={users} user={user} db={db} busy={busy} run={run} t={t} lang={lang} />
      ) : null}
    </div>
  )
}

function GroupDesk({ group, directory, users, user, db, busy, run, t, lang }) {
  const [draft, setDraft] = useState('')
  const [noteTitle, setNoteTitle] = useState('')
  const [noteBody, setNoteBody] = useState('')
  const [editName, setEditName] = useState(group.name || '')
  const [pick, setPick] = useState('')
  const [pickRole, setPickRole] = useState('member')
  const see = canSeeGroupContent(db, user, group)
  const post = canPostInGroup(db, user, group)
  const roster = canManageGroupRoster(db, user, group)
  const edit = canEditGroup(db, user, group)
  const archive = canArchiveGroup(db, user, group)
  const members = groupMembersOf(db, group.id)
  const notes = visibleGroupNotes(db, user, group.id)
  const messages = visibleGroupMessages(db, user, group.id)
  const candidates = directory.filter(
    (member) => member.userId && member.status !== 'pending' && member.status !== 'revoked' && !members.some((item) => item.userId === member.userId),
  )

  return (
    <div className="space-y-4">
      <form
        className="rounded-2xl border border-sage-200 bg-white/80 p-4"
        onSubmit={(event) => {
          event.preventDefault()
          run(() => spaces.updateGroup(user, group.id, { name: editName }), t('saved'))
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-display text-lg text-sage-900">{group.name}</h3>
          <span className="text-xs font-semibold uppercase text-sage-500">
            {t(`type_${group.type || 'private'}`)} · {spacesStatusLabel(lang, group.status === 'archived' ? 'archived' : 'active')}
          </span>
        </div>
        {edit || archive ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {edit ? (
              <input className={inputClass + ' max-w-xs'} value={editName} onChange={(event) => setEditName(event.target.value)} />
            ) : null}
            {edit ? (
              <button className={btnGhost} disabled={busy} type="submit">
                {t('edit')}
              </button>
            ) : null}
            {archive && group.status === 'archived' ? (
              <button type="button" className={btnGhost} disabled={busy} onClick={() => run(() => spaces.restoreGroup(user, group.id), t('saved'))}>
                {t('restore')}
              </button>
            ) : null}
            {archive && group.status !== 'archived' ? (
              <button type="button" className={btnGhost} disabled={busy} onClick={() => run(() => spaces.archiveGroup(user, group.id), t('saved'))}>
                {t('archive')}
              </button>
            ) : null}
          </div>
        ) : null}
      </form>

      <section className="rounded-2xl border border-sage-200 bg-white/80 p-4">
        <h3 className="font-display text-lg text-sage-900">{t('manageMembers')}</h3>
        <p className="mt-1 text-xs text-sage-500">{t('stayMember')}</p>
        <ul className="mt-2 divide-y divide-sage-100">
          {members.map((member) => (
            <li key={member.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
              <span className="min-w-0 flex-1 truncate">{personName(users, member, user.id, t('you'))}</span>
              <span className="text-xs text-sage-500">{spacesRoleLabel(lang, member.role)}</span>
              {roster ? (
                <button
                  type="button"
                  className={btnGhost + ' !min-h-9'}
                  disabled={busy}
                  onClick={() => run(() => spaces.removeGroupMember(user, group.id, member.userId), t('removedGroup'))}
                >
                  {t('remove')}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
        {roster ? (
          <form
            className="mt-3 grid gap-2 sm:grid-cols-[1fr_10rem_auto]"
            onSubmit={(event) => {
              event.preventDefault()
              if (!pick) return
              run(() => spaces.addGroupMember(user, group.id, pick, pickRole), t('saved'))
            }}
          >
            <select className={inputClass} value={pick} aria-label={t('addMember')} onChange={(event) => setPick(event.target.value)}>
              <option value="">{t('addMember')}</option>
              {candidates.map((member) => (
                <option key={member.id} value={member.userId}>
                  {personName(users, member, user.id, t('you'))}
                </option>
              ))}
            </select>
            <select className={inputClass} value={pickRole} aria-label={t('role')} onChange={(event) => setPickRole(event.target.value)}>
              <option value="lead">{t('role_lead')}</option>
              <option value="admin">{t('role_admin')}</option>
              <option value="member">{t('role_member')}</option>
              <option value="observer">{t('role_observer')}</option>
            </select>
            <button className={btnPrimary} disabled={busy || !pick} type="submit">
              {t('addMember')}
            </button>
          </form>
        ) : null}
      </section>

      {see ? (
        <>
          <section className="rounded-2xl border border-sage-200 bg-white/80 p-4">
            <h3 className="font-display text-lg text-sage-900">{t('notes')}</h3>
            {notes.length === 0 ? <p className="mt-2 text-sm text-sage-500">{t('emptyNotes')}</p> : null}
            <ul className="mt-2 space-y-2">
              {notes.map((note) => (
                <li key={note.id} className="rounded-xl bg-sage-50 px-3 py-2">
                  <p className="font-medium text-sage-900">{note.title}</p>
                  <p className="whitespace-pre-wrap text-sm text-sage-700">{note.content || note.body}</p>
                </li>
              ))}
            </ul>
            {post ? (
              <form
                className="mt-3 space-y-2"
                onSubmit={(event) => {
                  event.preventDefault()
                  run(async () => {
                    await spaces.postGroupNote(user, group.id, { title: noteTitle, body: noteBody })
                    setNoteTitle('')
                    setNoteBody('')
                  }, t('saved'))
                }}
              >
                <input className={inputClass} value={noteTitle} placeholder={t('noteTitle')} onChange={(event) => setNoteTitle(event.target.value)} />
                <textarea className={inputClass} value={noteBody} placeholder={t('noteBody')} onChange={(event) => setNoteBody(event.target.value)} />
                <button className={btnPrimary} disabled={busy} type="submit">
                  {t('publish')}
                </button>
              </form>
            ) : (
              <p className="mt-2 text-sm text-sage-500">{t('observerHint')}</p>
            )}
          </section>
          <section className="rounded-2xl border border-sage-200 bg-white/80 p-2 [overflow-anchor:none]">
            <h3 className="px-2 pt-2 font-display text-lg text-sage-900">{t('chat')}</h3>
            <StableChatPane
              threadKey={group.id}
              messages={messages}
              draft={draft}
              onDraftChange={setDraft}
              busy={busy}
              disabled={!post}
              placeholder={t('chatPlaceholder')}
              sendLabel={t('send')}
              emptyLabel={t('emptyChat')}
              hint={post ? t('chatHint') : t('observerHint')}
              onSend={() =>
                run(async () => {
                  await spaces.postMessage(user, group.id, draft)
                  setDraft('')
                })
              }
              renderMessage={(message) => {
                const mine = message.authorId === user.id
                return (
                  <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${mine ? 'bg-sage-700 text-sage-50' : 'bg-sage-100 text-sage-900'}`}>
                      {!mine ? <p className="mb-0.5 text-[11px] font-semibold opacity-80">{message.authorName}</p> : null}
                      <p className="whitespace-pre-wrap break-words">{message.body}</p>
                    </div>
                  </div>
                )
              }}
            />
          </section>
        </>
      ) : (
        <p className="rounded-2xl border border-dashed border-sage-300 p-4 text-sm text-sage-600">{t('privateHint')}</p>
      )}
    </div>
  )
}
