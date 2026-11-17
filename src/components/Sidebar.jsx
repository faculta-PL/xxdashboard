import { useEffect, useRef, useState } from 'react'
import {
  LayoutDashboard,
  StickyNote,
  FolderKanban,
  CalendarDays,
  ListTodo,
  Search,
  Download,
  Bell,
  Settings,
  LogOut,
  X,
  Users,
  MessageCircle,
  FolderOpen,
  Wallet,
  ShieldAlert,
  BoxSelect,
  Sparkles,
  Gamepad2,
  Building2,
  Layers,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronDown,
  BookOpen,
  Wand2,
  MessageSquarePlus,
  UserPlus,
  Plus,
  Check,
} from 'lucide-react'
import { getBackendMode } from '../lib/store'
import { organizationTitle } from '../lib/orgName.js'
import { isPlatformAdmin } from '../platform/superAdmin.js'
import { useI18n } from '../i18n'

export const NAV_GROUPS = [
  {
    id: 'personal',
    label: 'Personnel',
    items: [{ id: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard }],
  },
  {
    id: 'org',
    label: 'Organisation',
    items: [
      { id: 'overview', label: 'Vue d’ensemble', icon: Building2 },
      { id: 'spaces', label: 'Espaces', icon: Layers },
      { id: 'teams', label: 'Équipes', icon: Users },
      { id: 'projects', label: 'Projets', icon: FolderKanban },
      { id: 'notes', label: 'Notes', icon: StickyNote },
      { id: 'chat', label: 'Discussions', icon: MessageCircle },
      { id: 'calendar', label: 'Calendrier', icon: CalendarDays },
      { id: 'files', label: 'Documents', icon: FolderOpen },
    ],
  },
  {
    id: 'manage',
    label: 'Gestion',
    items: [
      { id: 'members', label: 'Membres', icon: UserPlus, labelKey: 'nav.menuMembers' },
      { id: 'orgsettings', label: 'Paramètres', icon: Settings, labelKey: 'nav.menuOrgSettings' },
    ],
  },
  {
    id: 'tools',
    label: 'Outils',
    items: [
      { id: 'todos', label: 'Tâches', icon: ListTodo },
      { id: 'budget', label: 'Budget', icon: Wallet },
      { id: 'risks', label: 'Risques', icon: ShieldAlert },
      { id: 'canvas', label: 'Espace visuel', icon: BoxSelect },
      { id: 'assistant', label: 'Assistant', icon: Sparkles, labelKey: 'nav.menuAssistant' },
      { id: 'games', label: 'Jeux', icon: Gamepad2 },
      { id: 'feedback', label: 'Retours', icon: MessageSquarePlus },
      { id: 'search', label: 'Recherche', icon: Search },
      { id: 'export', label: 'Exports', icon: Download },
      { id: 'create', label: 'Création', icon: Wand2 },
      { id: 'notifications', label: 'Notifications', icon: Bell },
      { id: 'guide', label: 'Guide', icon: BookOpen },
    ],
  },
]

export const NAV_FLAT = [
  ...NAV_GROUPS.flatMap((g) => g.items),
  { id: 'settings', label: 'Paramètres', icon: Settings },
]

const TOOL_IDS = new Set(NAV_GROUPS.find((group) => group.id === 'tools').items.map((item) => item.id))
const GROUPS_KEY = 'nazix_nav_groups'
const COLLAPSE_KEY = 'nazix_nav_collapsed'

function readToolsClosed() {
  try {
    const raw = JSON.parse(localStorage.getItem(GROUPS_KEY) || '{}')
    if (raw && typeof raw === 'object' && raw.tools === false) return false
  } catch {
    /* ignore */
  }
  return true
}

const GROUP_I18N = {
  personal: 'nav.groupPersonal',
  org: 'nav.groupOrg',
  manage: 'nav.groupManage',
  tools: 'nav.groupTools',
}

function navLabel(t, item) {
  const key = item.labelKey || `nav.${item.id}`
  const translated = t(key)
  return translated === key ? item.label : translated
}

function OrgSwitcher({
  user,
  collapsed,
  organizations,
  activeOrgId,
  onOrganization,
  onCreateOrganization,
  onManageOrganizations,
  onAdminOrganizations,
  onCloseMobile,
}) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)
  const active = organizations.find((org) => org.id === activeOrgId) || null
  const closedLabel = activeOrgId
    ? organizationTitle(active, user?.role) || t('hier.orgUntitled')
    : t('hier.personalOption')
  const showAllOrgs = Boolean(onAdminOrganizations) && isPlatformAdmin(user)

  useEffect(() => {
    if (!open) return undefined
    const onPointer = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false)
    }
    const onKey = (event) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const choose = (action) => {
    setOpen(false)
    action?.()
    onCloseMobile?.()
  }

  const rowClass = (selected) =>
    `flex min-h-11 w-full items-center gap-2 rounded-lg px-2 text-left text-sm ${
      selected ? 'bg-sage-700 font-semibold text-white' : 'text-sage-900 hover:bg-sage-100'
    }`

  return (
    <div ref={rootRef} className={`relative mb-3 ${collapsed ? 'lg:px-0' : ''}`}>
      <button
        type="button"
        className={`flex min-h-11 w-full items-center gap-2 rounded-xl border border-sage-500 bg-white px-3 text-sm font-medium text-sage-900 ${
          collapsed ? 'lg:justify-center lg:px-0' : ''
        }`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${t('hier.switch')} : ${closedLabel}`}
        onClick={() => setOpen((value) => !value)}
      >
        <Building2 size={16} className="shrink-0 text-sage-700" aria-hidden="true" />
        <span className={`min-w-0 flex-1 truncate text-left ${collapsed ? 'lg:hidden' : ''}`}>{closedLabel}</span>
        <ChevronDown
          size={16}
          className={`shrink-0 text-sage-600 transition ${open ? 'rotate-180' : ''} ${collapsed ? 'lg:hidden' : ''}`}
          aria-hidden="true"
        />
      </button>
      {open ? (
        <div
          role="menu"
          aria-label={t('hier.switch')}
          className={`absolute z-50 max-h-[min(24rem,70vh)] overflow-y-auto xx-scroll rounded-xl border border-sage-200 bg-white p-1 text-sage-900 shadow-lg ${
            collapsed
              ? 'left-0 right-0 top-full mt-1 lg:left-full lg:right-auto lg:top-0 lg:mt-0 lg:ml-2 lg:w-64'
              : 'left-0 right-0 top-full mt-1'
          }`}
        >
          <button
            type="button"
            role="menuitemradio"
            aria-checked={!activeOrgId}
            className={rowClass(!activeOrgId)}
            onClick={() => choose(() => onOrganization?.(''))}
          >
            <span className="min-w-0 flex-1 truncate">{t('hier.personalOption')}</span>
            {!activeOrgId ? <Check size={16} className="shrink-0" aria-hidden="true" /> : null}
          </button>
          {organizations.map((org) => {
            const selected = org.id === activeOrgId
            const label = organizationTitle(org, user?.role) || t('hier.orgUntitled')
            return (
              <button
                key={org.id}
                type="button"
                role="menuitemradio"
                aria-checked={selected}
                className={rowClass(selected)}
                onClick={() => choose(() => onOrganization?.(org.id))}
              >
                <span className="min-w-0 flex-1 truncate">{label}</span>
                {selected ? <Check size={16} className="shrink-0" aria-hidden="true" /> : null}
              </button>
            )
          })}
          <div className="my-1 border-t border-sage-200" />
          <button type="button" role="menuitem" className={rowClass(false)} onClick={() => choose(onCreateOrganization)}>
            <Plus size={16} className="shrink-0" aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate">{t('hier.createOrg')}</span>
          </button>
          <button type="button" role="menuitem" className={rowClass(false)} onClick={() => choose(onManageOrganizations)}>
            <Settings size={16} className="shrink-0" aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate">{t('hier.manage')}</span>
          </button>
          {showAllOrgs ? (
            <button type="button" role="menuitem" className={rowClass(false)} onClick={() => choose(onAdminOrganizations)}>
              <Building2 size={16} className="shrink-0" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate">{t('hier.adminOrgs')}</span>
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

export function Sidebar({
  user,
  view,
  onView,
  onCloseMobile,
  onLogout,
  unread,
  chatUnread,
  collapsed,
  onCollapsed,
  organizations = [],
  activeOrgId = '',
  onOrganization,
  onCreateOrganization,
  onManageOrganizations,
  onAdminOrganizations,
}) {
  const { t } = useI18n()
  const preferClosed = useRef(readToolsClosed())
  const [toolsClosed, setToolsClosed] = useState(() => readToolsClosed() && !TOOL_IDS.has(view))

  useEffect(() => {
    if (TOOL_IDS.has(view)) setToolsClosed(false)
    else setToolsClosed(preferClosed.current)
  }, [view])

  const toggleTools = () => {
    setToolsClosed((prev) => {
      const next = !prev
      preferClosed.current = next
      try {
        localStorage.setItem(GROUPS_KEY, JSON.stringify({ tools: next }))
      } catch {
        /* ignore */
      }
      return next
    })
  }

  const toggleRail = () => {
    const next = !collapsed
    onCollapsed(next)
    try {
      localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0')
    } catch {
      /* ignore */
    }
  }

  const orgActive = Boolean(activeOrgId)
  const groups = NAV_GROUPS.filter((group) => orgActive || (group.id !== 'org' && group.id !== 'manage'))

  return (
    <aside className="flex h-full w-[min(260px,100vw)] flex-col border-r border-sage-200 bg-sage-800 text-sage-50 lg:w-full">
      <div className="flex h-full flex-col p-3 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className={`mb-4 flex items-center gap-2 px-1 pt-1 ${collapsed ? 'lg:justify-center' : 'justify-between'}`}>
          <div className={`min-w-0 ${collapsed ? 'lg:hidden' : ''}`}>
            <p className="font-display text-2xl leading-none">Nazix</p>
            <p className="mt-1 truncate text-xs text-sage-300">
              {getBackendMode() === 'firebase' ? t('nav.firebase') : t('nav.localMode')}
            </p>
          </div>
          <button
            type="button"
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg hover:bg-sage-700 lg:hidden"
            onClick={onCloseMobile}
            aria-label={t('nav.closeMenu')}
          >
            <X size={20} />
          </button>
          <button
            type="button"
            className="hidden min-h-11 min-w-11 items-center justify-center rounded-lg hover:bg-sage-700 lg:inline-flex"
            onClick={toggleRail}
            aria-label={collapsed ? t('nav.expand') : t('nav.collapse')}
            aria-pressed={collapsed}
            title={collapsed ? t('nav.expand') : t('nav.collapse')}
          >
            {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
        </div>

        <OrgSwitcher
          user={user}
          collapsed={collapsed}
          organizations={organizations}
          activeOrgId={activeOrgId}
          onOrganization={onOrganization}
          onCreateOrganization={onCreateOrganization}
          onManageOrganizations={onManageOrganizations}
          onAdminOrganizations={onAdminOrganizations}
          onCloseMobile={onCloseMobile}
        />

        <nav className="flex-1 space-y-3 overflow-y-auto xx-scroll" aria-label={t('nav.primary')}>
          {groups.map((group) => {
            const groupLabel = t(GROUP_I18N[group.id] || group.label)
            const collapsible = group.id === 'tools'
            const closed = collapsible && toolsClosed
            return (
              <div key={group.id}>
                {collapsible ? (
                  <button
                    type="button"
                    className={`flex w-full items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-sage-300 hover:text-sage-50 ${
                      collapsed ? 'lg:justify-center lg:px-0' : ''
                    }`}
                    onClick={toggleTools}
                    aria-expanded={!closed}
                    title={groupLabel}
                  >
                    <span className={`min-w-0 flex-1 truncate text-left ${collapsed ? 'lg:hidden' : ''}`}>{groupLabel}</span>
                    <ChevronDown size={14} className={`shrink-0 transition ${closed ? '-rotate-90' : ''}`} />
                  </button>
                ) : (
                  <>
                    <p
                      className={`px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-sage-300 ${
                        collapsed ? 'lg:sr-only' : ''
                      }`}
                    >
                      {groupLabel}
                    </p>
                    {collapsed ? <div className="hidden h-px bg-sage-600/80 lg:block" aria-hidden="true" /> : null}
                  </>
                )}
                {!closed && (
                  <div className="mt-1 space-y-0.5">
                    {group.items.map((item) => {
                      const Icon = item.icon
                      const active = view === item.id
                      const label = navLabel(t, item)
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => onView(item.id)}
                          title={label}
                          aria-current={active ? 'page' : undefined}
                          aria-label={
                            item.id === 'notifications' && unread > 0
                              ? `${label} (${t('nav.unread', { n: unread })})`
                              : item.id === 'chat' && chatUnread > 0
                                ? `${label} (${t('nav.chatUnread', { n: chatUnread })})`
                                : label
                          }
                          className={`relative flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition ${
                            collapsed ? 'lg:justify-center lg:px-0' : ''
                          } ${active ? 'bg-sage-600 text-white' : 'text-sage-100 hover:bg-sage-700'}`}
                        >
                          <Icon size={18} className="shrink-0" />
                          <span className={`min-w-0 flex-1 truncate ${collapsed ? 'lg:hidden' : ''}`}>
                            {label}
                          </span>
                          {item.id === 'notifications' && unread > 0 && (
                            <span
                              className={`rounded-full bg-cream-green px-2 py-0.5 text-[11px] font-bold text-sage-800 ${
                                collapsed ? 'lg:absolute lg:right-1 lg:top-1 lg:min-w-4 lg:px-1 lg:text-[9px]' : ''
                              }`}
                            >
                              {collapsed && unread > 9 ? '9+' : unread}
                            </span>
                          )}
                          {item.id === 'chat' && chatUnread > 0 && (
                            <span
                              className={`rounded-full bg-cream-green px-2 py-0.5 text-[11px] font-bold text-sage-800 ${
                                collapsed ? 'lg:absolute lg:right-1 lg:top-1 lg:min-w-4 lg:px-1 lg:text-[9px]' : ''
                              }`}
                            >
                              {collapsed && chatUnread > 9 ? '9+' : chatUnread}
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </nav>

        <div className={`mt-3 border-t border-sage-600 pt-3 ${collapsed ? 'lg:px-0' : ''}`}>
          <button
            type="button"
            onClick={() => onView('settings')}
            title={t('nav.account')}
            aria-label={t('nav.account')}
            aria-current={view === 'settings' ? 'page' : undefined}
            className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition ${
              collapsed ? 'lg:justify-center lg:px-0' : ''
            } ${view === 'settings' ? 'bg-sage-600 text-white' : 'text-sage-100 hover:bg-sage-700'}`}
          >
            <Settings size={18} className="shrink-0" />
            <span className={`min-w-0 flex-1 truncate ${collapsed ? 'lg:hidden' : ''}`}>{t('nav.account')}</span>
          </button>
          <p className={`mt-2 truncate px-2 text-sm font-medium ${collapsed ? 'lg:hidden' : ''}`}>{user.fullName}</p>
          <p className={`truncate px-2 text-xs text-sage-300 ${collapsed ? 'lg:hidden' : ''}`}>{user.email}</p>
          <button
            type="button"
            onClick={onLogout}
            aria-label={t('nav.logout')}
            title={t('nav.logout')}
            className={`mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-sage-600 bg-sage-700 px-3 py-2 text-sm font-medium text-sage-50 hover:bg-sage-600 ${
              collapsed ? 'lg:px-0' : ''
            }`}
          >
            <LogOut size={16} />
            <span className={collapsed ? 'lg:hidden' : ''}>{t('nav.logout')}</span>
          </button>
        </div>
      </div>
    </aside>
  )
}

export function readNavCollapsed() {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === '1'
  } catch {
    return false
  }
}
