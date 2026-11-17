import { Building2 } from 'lucide-react'
import { useI18n } from '../i18n'
import { workspaceInitials } from './model.js'
import { switcherWorkspaces } from './permissions.js'
import { spacesStatusLabel, spacesT } from './i18n.js'

export function WorkspaceMark({ workspace, className = '' }) {
  const emoji = String(workspace?.emoji || '').trim()
  const letters = workspaceInitials(workspace?.name)
  return (
    <span
      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sage-200 text-sm font-semibold text-sage-800 ${className}`}
      aria-hidden="true"
    >
      {emoji || letters}
    </span>
  )
}

export function WorkspaceSwitcher({ db, user, activeOrgId, onSwitch }) {
  const { lang } = useI18n()
  const t = (key) => spacesT(lang, key)
  const choices = switcherWorkspaces(db, user)
  if (!user) return null
  return (
    <label className="flex min-w-0 items-center gap-2 text-xs font-semibold text-sage-700">
      <Building2 size={16} className="hidden shrink-0 sm:block" aria-hidden="true" />
      <span className="sr-only">{t('switch')}</span>
      <select
        className="max-w-[9.5rem] truncate rounded-lg border border-sage-300 bg-white/90 px-2 py-1.5 text-sm text-sage-900 sm:max-w-[14rem]"
        value={choices.some((workspace) => workspace.id === activeOrgId) ? activeOrgId : ''}
        aria-label={t('switch')}
        onChange={(event) => onSwitch(event.target.value)}
      >
        <option value="">{t('home')}</option>
        {choices.map((workspace) => (
          <option key={workspace.id} value={workspace.id}>
            {`${workspace.emoji || workspaceInitials(workspace.name)} ${workspace.name}${
              workspace.status !== 'active' ? ` · ${spacesStatusLabel(lang, workspace.status)}` : ''
            }`}
          </option>
        ))}
      </select>
    </label>
  )
}
