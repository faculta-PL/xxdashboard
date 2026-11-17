import { useState } from 'react'
import { useI18n } from '../i18n'
import { selectOrganization, spaces } from '../lib/store'
import { homeSummary } from './permissions.js'
import { spacesRoleLabel, spacesT } from './i18n.js'
import { WorkspaceMark } from './WorkspaceSwitcher.jsx'

const inputClass =
  'w-full min-h-11 rounded-xl border border-sage-300 bg-white px-3 py-2.5 text-sage-900 outline-none ring-sage-400 placeholder:text-sage-400 focus:ring-2'
const btnPrimary =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-sage-700 px-4 py-2.5 text-sm font-semibold text-sage-50 transition hover:bg-sage-800 disabled:opacity-50'
const btnGhost =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-sage-300 bg-white/70 px-3 py-2 text-sm font-medium text-sage-800 transition hover:bg-sage-100'

export function PersonalHome({ user, db, onLogout }) {
  const { lang } = useI18n()
  const t = (key) => spacesT(lang, key)
  const home = homeSummary(db, user)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [emoji, setEmoji] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const run = async (action) => {
    setBusy(true)
    setError('')
    try {
      await action()
    } catch (err) {
      setError(err.message || t('needName'))
    } finally {
      setBusy(false)
    }
  }

  const create = (event) => {
    event.preventDefault()
    if (name.trim().length < 2) {
      setError(t('needName'))
      return
    }
    run(() => spaces.createWorkspace(user, { name: name.trim(), description, emoji }))
  }

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-xl flex-col justify-center px-4 py-10">
      <p className="font-display text-3xl text-sage-900">Nazix</p>
      <h1 className="mt-2 font-display text-2xl text-sage-800">{t('homeTitle')}</h1>
      <p className="mt-2 text-sm text-sage-600">{t('homeHint')}</p>
      {error ? (
        <p className="mt-3 text-sm font-medium text-danger" role="alert">
          {error}
        </p>
      ) : null}

      <section className="mt-5">
        <h2 className="font-display text-lg text-sage-900">{t('spacesNav')}</h2>
        {home.spaces.length === 0 ? (
          <p className="mt-2 text-sm text-sage-500">{t('noSpaces')}</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {home.spaces.map((workspace) => (
              <li key={workspace.id}>
                <button
                  type="button"
                  className={btnPrimary + ' w-full justify-between'}
                  disabled={busy}
                  onClick={() => run(() => selectOrganization(workspace.id, user))}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <WorkspaceMark workspace={workspace} className="!bg-sage-600 !text-sage-50" />
                    <span className="truncate">{workspace.name}</span>
                  </span>
                  <span className="text-xs opacity-80">{spacesRoleLabel(lang, workspace.role)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-5">
        <h2 className="font-display text-lg text-sage-900">{t('pending')}</h2>
        {home.invites.length === 0 ? (
          <p className="mt-2 text-sm text-sage-500">{t('noInvites')}</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {home.invites.map((invite) => (
              <li key={invite.id} className="rounded-2xl border border-sage-200 bg-white/80 p-3">
                <p className="font-medium text-sage-900">{invite.workspace?.name || invite.orgId}</p>
                <p className="text-xs text-sage-500">{spacesRoleLabel(lang, invite.role)}</p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    className={btnPrimary}
                    disabled={busy}
                    onClick={() =>
                      run(async () => {
                        await spaces.acceptInvite(user, invite.orgId)
                        try {
                          selectOrganization(invite.orgId, user)
                        } catch (err) {
                          setError(err.message || '')
                        }
                      })
                    }
                  >
                    {t('accept')}
                  </button>
                  <button
                    type="button"
                    className={btnGhost}
                    disabled={busy}
                    onClick={() => run(() => spaces.declineInvite(user, invite.orgId))}
                  >
                    {t('decline')}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <form onSubmit={create} className="mt-5 rounded-2xl border border-sage-200 bg-white/80 p-4">
        <h2 className="font-display text-lg text-sage-900">{t('create')}</h2>
        <p className="mt-1 text-sm text-sage-600">{t('createOptional')}</p>
        <label className="mt-3 block text-sm font-medium text-sage-800">
          {t('name')}
          <input className={inputClass + ' mt-1'} value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label className="mt-3 block text-sm font-medium text-sage-800">
          {t('description')}
          <input className={inputClass + ' mt-1'} value={description} onChange={(event) => setDescription(event.target.value)} />
        </label>
        <label className="mt-3 block text-sm font-medium text-sage-800">
          {t('emoji')}
          <input className={inputClass + ' mt-1'} value={emoji} onChange={(event) => setEmoji(event.target.value)} placeholder="🌿" />
        </label>
        <p className="mt-1 text-xs text-sage-500">{t('emojiHint')}</p>
        <button type="submit" className={btnPrimary + ' mt-3'} disabled={busy}>
          {t('create')}
        </button>
      </form>

      <button type="button" className={btnGhost + ' mt-6'} onClick={onLogout}>
        {t('logout')}
      </button>
    </div>
  )
}
