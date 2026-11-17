import { useEffect, useMemo, useState } from 'react'
import { Mail, Search, UserPlus } from 'lucide-react'
import { btnGhost, btnPrimary, inputClass } from '../components/ui'
import { useI18n } from '../i18n'
import { isPlatformAdmin } from '../platform/superAdmin.js'
import { canManageOrg, orgRole, resendVerificationEmail, selectOrganization, updateProfile, verifyEmail } from '../lib/store'
import { featureEnabled } from '../platform/contract.js'
import { appInviteService, hydrateInvites } from './bridge.js'
import { identityT } from './i18n.js'
import {
  clearInviteToken,
  handleAvailability,
  inviteChannel,
  readInviteToken,
  searchPublicByHandle,
  stashInviteToken,
  validateProfileForm,
} from './model.js'
import { subscribeInvites } from './repo.js'

function explain(t, err) {
  const code = err?.code || err?.message || 'invite_closed'
  const label = t(code)
  return label === code ? err?.message || t('invite_closed') : label
}

function roleLabel(t, role) {
  return t(`role_${role}`) === `role_${role}` ? role : t(`role_${role}`)
}

export function IdentitySignupFields({ section, form, setForm, directory = [], errors = {} }) {
  const { lang } = useI18n()
  const t = (key, vars) => identityT(lang, key, vars)
  const [checked, setChecked] = useState(null)
  const live = handleAvailability(form.handle, directory)
  const availability = checked || (String(form.handle || '').trim() ? live : null)

  if (section === 'handle') {
    return (
      <label className="mb-3 block text-sm">
        <span className="mb-1 block font-medium text-sage-800">{t('fieldHandle')}</span>
        <div className="flex gap-2">
          <input
            className={inputClass}
            value={form.handle || ''}
            placeholder={t('handlePh')}
            autoComplete="username"
            aria-invalid={Boolean(errors.handle)}
            onChange={(e) => {
              setChecked(null)
              setForm({ ...form, handle: e.target.value })
            }}
          />
          <button
            type="button"
            className={btnGhost}
            onClick={() => setChecked(handleAvailability(form.handle, directory))}
          >
            {t('check')}
          </button>
        </div>
        {errors.handle ? <span className="mt-1 block text-sm font-medium text-red-700">{errors.handle}</span> : null}
        {!errors.handle && availability?.ok ? (
          <span className="mt-1 block text-sm text-sage-700">{t('available')}</span>
        ) : null}
        {!errors.handle && availability && !availability.ok ? (
          <span className="mt-1 block text-sm font-medium text-red-700">{t(`err_${availability.reason}`)}</span>
        ) : null}
      </label>
    )
  }

  return (
    <div className="mb-3 space-y-3">
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-sage-800">{t('fieldConfirm')}</span>
        <input
          type="password"
          className={inputClass}
          value={form.confirm || ''}
          autoComplete="new-password"
          aria-invalid={Boolean(errors.confirm)}
          onChange={(e) => setForm({ ...form, confirm: e.target.value })}
        />
        {errors.confirm ? <span className="mt-1 block text-sm font-medium text-red-700">{errors.confirm}</span> : null}
      </label>
      <label className="flex items-start gap-2 text-sm text-sage-800">
        <input
          type="checkbox"
          className="mt-1 h-4 w-4 accent-sage-700"
          checked={Boolean(form.terms)}
          onChange={(e) => setForm({ ...form, terms: e.target.checked })}
        />
        <span>{t('fieldTerms')}</span>
      </label>
      {errors.terms ? <p className="text-sm font-medium text-red-700">{errors.terms}</p> : null}
    </div>
  )
}

export function EmailVerifyBanner({ user, onUserUpdated }) {
  const { lang } = useI18n()
  const t = (key, vars) => identityT(lang, key, vars)
  const [code, setCode] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  if (!featureEnabled('identity') || !user || user.emailVerified) return null

  const resend = async () => {
    setBusy(true)
    setNote('')
    try {
      await resendVerificationEmail()
      setNote(t('bannerResendOk'))
    } catch {
      setNote(t('bannerResendFail'))
    } finally {
      setBusy(false)
    }
  }

  const verify = async () => {
    setBusy(true)
    setNote('')
    try {
      await verifyEmail(user.id, code)
      await onUserUpdated?.()
    } catch {
      setNote(t('verifyFailed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mb-4 rounded-2xl border border-warn/40 bg-warn/10 px-4 py-3" role="status">
      <p className="flex items-center gap-2 font-semibold text-sage-900">
        <Mail size={16} /> {t('bannerTitle')}
      </p>
      <p className="mt-1 text-sm text-sage-800">{t('bannerBody')}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <input
          className={inputClass + ' w-full max-w-full md:!w-40'}
          value={code}
          inputMode="numeric"
          placeholder={t('bannerCode')}
          aria-label={t('bannerCode')}
          onChange={(e) => setCode(e.target.value)}
        />
        <button type="button" className={btnPrimary} disabled={busy} onClick={verify}>
          {t('bannerVerify')}
        </button>
        <button type="button" className={btnGhost} disabled={busy} onClick={resend}>
          {t('bannerResend')}
        </button>
      </div>
      {note ? <p className="mt-2 text-sm text-sage-800">{note}</p> : null}
    </div>
  )
}

export function IdentityProfileCard({ user, directory = [], onUserUpdated, flash }) {
  const { lang } = useI18n()
  const t = (key, vars) => identityT(lang, key, vars)
  const [form, setForm] = useState(() => ({
    fullName: user?.fullName || '',
    handle: user?.handle || '',
    bio: user?.bio || '',
    title: user?.title || '',
    website: user?.website || '',
    discoverable: user?.discoverable !== false,
  }))
  const [errors, setErrors] = useState({})
  const [checked, setChecked] = useState(null)

  useEffect(() => {
    setForm({
      fullName: user?.fullName || '',
      handle: user?.handle || '',
      bio: user?.bio || '',
      title: user?.title || '',
      website: user?.website || '',
      discoverable: user?.discoverable !== false,
    })
  }, [user])

  if (!featureEnabled('identity') || !user) return null
  const live = checked || (String(form.handle || '').trim() ? handleAvailability(form.handle, directory, user.id) : null)

  const save = async () => {
    const result = validateProfileForm(form, directory, user.id)
    setErrors(result.errors)
    if (!result.ok) return
    try {
      await updateProfile(user.id, result.patch)
      await onUserUpdated?.()
      flash?.(t('profileSaved'))
    } catch (err) {
      flash?.(explain(t, err), 'err')
    }
  }

  const field = (key, label, value, extra = {}) => (
    <label className="block text-sm" key={key}>
      <span className="mb-1 block font-medium text-sage-800">{label}</span>
      <input
        className={inputClass}
        value={value}
        aria-invalid={Boolean(errors[key])}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        {...extra}
      />
      {errors[key] ? <span className="mt-1 block text-sm font-medium text-red-700">{t(`err_${errors[key]}`)}</span> : null}
    </label>
  )

  return (
    <section className="rounded-2xl border border-sage-200 bg-white/80 p-5">
      <h2 className="font-display text-lg text-sage-900">{t('profileTitle')}</h2>
      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
        {field('fullName', t('fieldName'), form.fullName)}
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-sage-800">{t('fieldHandle')}</span>
          <div className="flex gap-2">
            <input
              className={inputClass}
              value={form.handle}
              placeholder={t('handlePh')}
              aria-invalid={Boolean(errors.handle)}
              onChange={(e) => {
                setChecked(null)
                setForm({ ...form, handle: e.target.value })
              }}
            />
            <button
              type="button"
              className={btnGhost}
              onClick={() => setChecked(handleAvailability(form.handle, directory, user.id))}
            >
              {t('check')}
            </button>
          </div>
          {errors.handle ? (
            <span className="mt-1 block text-sm font-medium text-red-700">{t(`err_${errors.handle}`)}</span>
          ) : null}
          {!errors.handle && live?.ok ? <span className="mt-1 block text-sm text-sage-700">{t('available')}</span> : null}
          {!errors.handle && live && !live.ok ? (
            <span className="mt-1 block text-sm font-medium text-red-700">{t(`err_${live.reason}`)}</span>
          ) : null}
        </label>
        {field('title', t('fieldTitle'), form.title)}
        {field('website', t('fieldWebsite'), form.website, { placeholder: t('websitePh'), inputMode: 'url' })}
        <label className="block text-sm md:col-span-2">
          <span className="mb-1 block font-medium text-sage-800">{t('fieldBio')}</span>
          <textarea
            className={inputClass + ' min-h-24'}
            value={form.bio}
            maxLength={280}
            onChange={(e) => setForm({ ...form, bio: e.target.value })}
          />
          {errors.bio ? <span className="mt-1 block text-sm font-medium text-red-700">{t('err_bio')}</span> : null}
        </label>
      </div>
      <label className="mt-3 flex items-start gap-2 text-sm text-sage-800">
        <input
          type="checkbox"
          className="mt-1 h-4 w-4 accent-sage-700"
          checked={form.discoverable}
          onChange={(e) => setForm({ ...form, discoverable: e.target.checked })}
        />
        <span>
          <span className="font-medium">{t('fieldDiscoverable')}</span>
          <span className="mt-0.5 block text-xs text-sage-600">{t('discoverableHint')}</span>
        </span>
      </label>
      <button type="button" className={btnPrimary + ' mt-3'} onClick={save}>
        {t('profileSave')}
      </button>
    </section>
  )
}

function LinkOnce({ fresh, t }) {
  const [copied, setCopied] = useState(false)
  if (!fresh?.link) return null
  return (
    <div className="rounded-xl border border-sage-300 bg-sage-50 p-3">
      <p className="text-sm font-medium text-sage-900">{t('linkOnce')}</p>
      <p className="mt-1 text-sm text-sage-700">{t('mailNotSent')}</p>
      {fresh.noticed ? <p className="mt-1 text-sm text-sage-700">{t('noticed')}</p> : null}
      {!fresh.noticed && fresh.channel === 'email' ? <p className="mt-1 text-sm text-sage-700">{t('notFoundUser')}</p> : null}
      <label className="mt-2 block text-sm">
        <span className="mb-1 block font-medium text-sage-800">{t('linkLabel')}</span>
        <input className={inputClass} readOnly value={fresh.link} aria-label={t('linkLabel')} />
      </label>
      <button
        type="button"
        className={btnGhost + ' mt-2'}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(fresh.link)
            setCopied(true)
          } catch {
            setCopied(false)
          }
        }}
      >
        {copied ? t('copied') : t('copy')}
      </button>
    </div>
  )
}

export function InvitationDesk({ user, orgId, groups = [], directory = [], flash, onUserUpdated }) {
  const { lang } = useI18n()
  const t = (key, vars) => identityT(lang, key, vars)
  const service = useMemo(() => appInviteService(), [])
  const [tick, setTick] = useState(0)
  const [channel, setChannel] = useState('email')
  const [email, setEmail] = useState('')
  const [handle, setHandle] = useState('')
  const [role, setRole] = useState('member')
  const [groupId, setGroupId] = useState('')
  const [filter, setFilter] = useState('pending')
  const [box, setBox] = useState('inbox')
  const [query, setQuery] = useState('')
  const [found, setFound] = useState(undefined)
  const [fresh, setFresh] = useState(null)
  const [busy, setBusy] = useState(false)
  const canInvite = Boolean(user && orgId && canManageOrg(user, orgId))
  const owner = orgRole(user, orgId) === 'owner' || isPlatformAdmin(user)

  useEffect(() => subscribeInvites(() => setTick((n) => n + 1)), [])
  useEffect(() => {
    hydrateInvites()
  }, [])

  if (!featureEnabled('invitations') || !user) return null

  const rows = box === 'sent' ? service.listSent(user, filter) : service.listInbox(user, filter)
  void tick

  const create = async (event) => {
    event.preventDefault()
    setBusy(true)
    try {
      const input = { workspaceId: orgId, role, groupId: groupId || null }
      const result =
        channel === 'email'
          ? await service.createEmailInvite(user, { ...input, email })
          : channel === 'handle'
            ? await service.createHandleInvite(user, { ...input, handle })
            : await service.createLinkInvite(user, input)
      setFresh({ ...result, channel })
      setEmail('')
      setHandle('')
      flash?.(t('saved'))
    } catch (err) {
      flash?.(explain(t, err), 'err')
    } finally {
      setBusy(false)
    }
  }

  const run = async (fn, okKey) => {
    setBusy(true)
    try {
      const result = await fn()
      if (result?.link) setFresh({ ...result, channel: result.invite?.email ? 'email' : result.invite?.handle ? 'handle' : 'link' })
      flash?.(t(okKey))
    } catch (err) {
      flash?.(explain(t, err), 'err')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4 animate-fade-up">
      <div>
        <h2 className="font-display text-2xl text-sage-900">{t('heading')}</h2>
        <p className="mt-1 max-w-2xl text-sm text-sage-700">{t('hint')}</p>
      </div>

      <form
        className="rounded-2xl border border-sage-200 bg-white/80 p-4"
        onSubmit={(event) => {
          event.preventDefault()
          const profile = searchPublicByHandle(directory, query)
          setFound(profile)
        }}
      >
        <h3 className="flex items-center gap-2 font-display text-lg text-sage-900">
          <Search size={18} /> {t('searchLabel')}
        </h3>
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            className={inputClass + ' max-w-sm'}
            value={query}
            placeholder="@pseudo"
            aria-label={t('searchLabel')}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button className={btnPrimary} type="submit">
            {t('searchButton')}
          </button>
        </div>
        {found ? (
          <dl className="mt-3 text-sm text-sage-800">
            <div>
              <dt className="inline font-medium">{t('searchName')} : </dt>
              <dd className="inline">{found.displayName}</dd>
            </div>
            <div>
              <dt className="inline font-medium">{t('searchHandle')} : </dt>
              <dd className="inline">@{found.handle}</dd>
            </div>
            {'bio' in found ? (
              <div>
                <dt className="inline font-medium">{t('searchBio')} : </dt>
                <dd className="inline">{found.bio || '—'}</dd>
              </div>
            ) : null}
          </dl>
        ) : null}
        {found === null ? <p className="mt-2 text-sm text-sage-600">{t('searchEmpty')}</p> : null}
      </form>

      {canInvite ? (
        <form onSubmit={create} className="space-y-3 rounded-2xl border border-sage-200 bg-white/80 p-4">
          <h3 className="flex items-center gap-2 font-display text-lg text-sage-900">
            <UserPlus size={18} /> {t('heading')}
          </h3>
          <div className="grid grid-cols-3 gap-1 rounded-full bg-sage-100 p-1 text-sm">
            {[
              ['email', t('tabEmail')],
              ['handle', t('tabHandle')],
              ['link', t('tabLink')],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={`min-h-10 rounded-full font-medium ${channel === id ? 'bg-sage-800 text-white' : 'text-sage-700'}`}
                onClick={() => setChannel(id)}
              >
                {label}
              </button>
            ))}
          </div>
          {channel === 'email' ? (
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-sage-800">{t('fieldEmail')}</span>
              <input
                type="email"
                required
                className={inputClass}
                value={email}
                placeholder={t('emailPh')}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
          ) : null}
          {channel === 'handle' ? (
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-sage-800">{t('fieldHandle')}</span>
              <input
                required
                className={inputClass}
                value={handle}
                placeholder={t('handlePh')}
                onChange={(e) => setHandle(e.target.value)}
              />
            </label>
          ) : null}
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-sage-800">{t('fieldRole')}</span>
              <select className={inputClass} value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="member">{t('role_member')}</option>
                <option value="admin">{t('role_admin')}</option>
                {owner ? <option value="owner">{t('role_owner')}</option> : null}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-sage-800">{t('fieldGroup')}</span>
              <select className={inputClass} value={groupId} onChange={(e) => setGroupId(e.target.value)}>
                <option value="">{t('groupNone')}</option>
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button className={btnPrimary} disabled={busy} type="submit">
            {channel === 'link' ? t('createLink') : channel === 'handle' ? t('createHandle') : t('createEmail')}
          </button>
          <LinkOnce fresh={fresh} t={t} />
        </form>
      ) : (
        <p className="text-sm text-sage-600">{orgId ? t('invite_forbidden') : t('needOrg')}</p>
      )}

      <section className="rounded-2xl border border-sage-200 bg-white/80 p-4">
        <div className="flex flex-wrap gap-2">
          <button type="button" className={box === 'inbox' ? btnPrimary : btnGhost} onClick={() => setBox('inbox')}>
            {t('inbox')}
          </button>
          <button type="button" className={box === 'sent' ? btnPrimary : btnGhost} onClick={() => setBox('sent')}>
            {t('sent')}
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {['pending', 'accepted', 'declined', 'expired', 'revoked'].map((id) => (
            <button
              key={id}
              type="button"
              className={filter === id ? btnPrimary : btnGhost}
              onClick={() => setFilter(id)}
            >
              {t(`filter${id[0].toUpperCase()}${id.slice(1)}`)}
            </button>
          ))}
        </div>
        {rows.length === 0 ? (
          <p className="mt-3 text-sm text-sage-600">{t('emptyInbox')}</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {rows.map((invite) => (
              <li key={invite.id} className="rounded-xl border border-sage-200 px-3 py-3 text-sm">
                <p className="font-medium text-sage-900">
                  {t(`channel_${inviteChannel(invite)}`)} · {roleLabel(t, invite.role)}
                </p>
                <p className="text-sage-700">
                  {invite.email || (invite.handle ? `@${invite.handle}` : invite.workspaceId)}
                </p>
                <p className="text-xs text-sage-500">
                  {t('uses', { uses: invite.uses, max: invite.maxUses })} ·{' '}
                  {t('expires', { date: invite.expiresAt ? new Date(invite.expiresAt).toLocaleDateString(lang === 'en' ? 'en-GB' : 'fr-FR') : '—' })}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {box === 'inbox' && filter === 'pending' ? (
                    <>
                      <button
                        type="button"
                        className={btnPrimary}
                        disabled={busy}
                        onClick={() =>
                          run(async () => {
                            await service.acceptInvite(user, { inviteId: invite.id })
                            try {
                              await selectOrganization(invite.workspaceId, user)
                            } catch (err) {
                              console.warn('invite org:', err?.message || err)
                            }
                            await onUserUpdated?.()
                            return null
                          }, 'acceptedOk')
                        }
                      >
                        {t('accept')}
                      </button>
                      <button
                        type="button"
                        className={btnGhost}
                        disabled={busy}
                        onClick={() => run(() => service.declineInvite(user, invite.id), 'declinedOk')}
                      >
                        {t('decline')}
                      </button>
                    </>
                  ) : null}
                  {box === 'sent' && (filter === 'pending' || filter === 'expired') ? (
                    <>
                      <button
                        type="button"
                        className={btnGhost}
                        disabled={busy}
                        onClick={() => run(() => service.resendInvite(user, invite.id), 'resentOk')}
                      >
                        {t('resend')}
                      </button>
                      <button
                        type="button"
                        className={btnGhost + ' !text-danger'}
                        disabled={busy}
                        onClick={() => run(() => service.revokeInvite(user, invite.id), 'revokedOk')}
                      >
                        {t('revoke')}
                      </button>
                    </>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

export function InviteAcceptGate({ user, onRequestAuth, onUserUpdated, flash }) {
  const { lang } = useI18n()
  const t = (key, vars) => identityT(lang, key, vars)
  const service = useMemo(() => appInviteService(), [])
  const [token, setToken] = useState(() => readInviteToken())
  const [preview, setPreview] = useState(undefined)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancel = false
    if (!token) {
      setPreview(undefined)
      return undefined
    }
    service.previewInvite(token).then((row) => {
      if (!cancel) setPreview(row)
    })
    return () => {
      cancel = true
    }
  }, [service, token])

  if (!featureEnabled('invitations') || !token) return null

  const dismiss = () => {
    clearInviteToken()
    setToken('')
  }

  const accept = async () => {
    setBusy(true)
    setError('')
    try {
      await service.acceptInvite(user, { token })
      if (preview?.workspaceId) {
        try {
          await selectOrganization(preview.workspaceId, user)
        } catch (err) {
          console.warn('invite org:', err?.message || err)
        }
      }
      dismiss()
      flash?.(t('acceptedOk'))
      await onUserUpdated?.()
    } catch (err) {
      setError(explain(t, err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="mx-auto mb-4 max-w-xl rounded-2xl border border-sage-300 bg-white p-4 shadow-sm">
      <h2 className="font-display text-2xl text-sage-900">{t('acceptTitle')}</h2>
      {preview === undefined ? <p className="mt-2 text-sm text-sage-600">…</p> : null}
      {preview === null ? <p className="mt-2 text-sm text-red-700">{t('invite_missing')}</p> : null}
      {preview ? (
        <dl className="mt-3 space-y-1 text-sm text-sage-800">
          <div>
            <dt className="inline font-medium">{t('acceptWorkspace')} : </dt>
            <dd className="inline">{preview.workspaceName}</dd>
          </div>
          <div>
            <dt className="inline font-medium">{t('acceptInviter')} : </dt>
            <dd className="inline">{preview.inviterName || '—'}</dd>
          </div>
          <div>
            <dt className="inline font-medium">{t('acceptRole')} : </dt>
            <dd className="inline">{roleLabel(t, preview.role)}</dd>
          </div>
        </dl>
      ) : null}
      {error ? <p className="mt-2 text-sm font-medium text-red-700">{error}</p> : null}
      <div className="mt-3 flex flex-wrap gap-2">
        {user ? (
          <button type="button" className={btnPrimary} disabled={busy || !preview?.allowsAccept} onClick={accept}>
            {t('accept')}
          </button>
        ) : (
          <>
            <button
              type="button"
              className={btnPrimary}
              onClick={() => {
                stashInviteToken(token)
                onRequestAuth?.('register')
              }}
            >
              {t('signupToAccept')}
            </button>
            <button
              type="button"
              className={btnGhost}
              onClick={() => {
                stashInviteToken(token)
                onRequestAuth?.('login')
              }}
            >
              {t('loginToAccept')}
            </button>
          </>
        )}
        <button type="button" className={btnGhost} onClick={dismiss}>
          {t('later')}
        </button>
      </div>
    </section>
  )
}
