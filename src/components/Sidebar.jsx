import { useEffect, useState } from 'react'
import {
  LayoutDashboard,
  StickyNote,
  Lightbulb,
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
  Star,
  Building2,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronDown,
  BookOpen,
  Wand2,
  MessageSquarePlus,
} from 'lucide-react'
import { getBackendMode } from '../lib/store'
import { isAdmin } from '../lib/rbac'
import { useI18n } from '../i18n'

export const NAV_GROUPS = [
  {
    id: 'workspace',
    label: 'Espace de travail',
    items: [
      { id: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
      { id: 'projects', label: 'Projets', icon: FolderKanban },
      { id: 'notes', label: 'Notes', icon: StickyNote },
      { id: 'important', label: 'Notes importantes', icon: Star },
      { id: 'ideas', label: 'Kanban', icon: Lightbulb },
      { id: 'calendar', label: 'Calendrier', icon: CalendarDays },
      { id: 'todos', label: 'Tâches', icon: ListTodo },
      { id: 'files', label: 'Fichiers', icon: FolderOpen },
      { id: 'budget', label: 'Budget', icon: Wallet },
      { id: 'risks', label: 'Risques', icon: ShieldAlert },
      { id: 'canvas', label: 'Espace visuel', icon: BoxSelect },
    ],
  },
  {
    id: 'collab',
    label: 'Collaboration',
    items: [
      { id: 'org', label: 'Organisation', icon: Building2 },
      { id: 'orgadmin', label: 'Organisations', icon: Building2 },
      { id: 'team', label: 'Équipe', icon: Users },
      { id: 'chat', label: 'Chat', icon: MessageCircle },
      { id: 'notifications', label: 'Notifications', icon: Bell },
      { id: 'feedback', label: 'Feedback', icon: MessageSquarePlus },
    ],
  },
  {
    id: 'tools',
    label: 'Outils',
    items: [
      { id: 'guide', label: 'Guide', icon: BookOpen },
      { id: 'search', label: 'Recherche', icon: Search },
      { id: 'export', label: 'Exports', icon: Download },
      { id: 'assistant', label: 'Assistant IA', icon: Sparkles },
      { id: 'create', label: 'Création', icon: Wand2 },
    ],
  },
  {
    id: 'fun',
    label: 'Détente',
    items: [{ id: 'games', label: 'Jeux', icon: Gamepad2 }],
  },
]

export const NAV_FLAT = [
  ...NAV_GROUPS.flatMap((g) => g.items),
  { id: 'settings', label: 'Paramètres', icon: Settings },
]

const GROUPS_KEY = 'nazix_nav_groups'
const COLLAPSE_KEY = 'nazix_nav_collapsed'

function readGroups() {
  try {
    const raw = JSON.parse(localStorage.getItem(GROUPS_KEY) || '{}')
    return raw && typeof raw === 'object' ? raw : {}
  } catch {
    return {}
  }
}

const GROUP_I18N = {
  workspace: 'nav.groupWorkspace',
  collab: 'nav.groupCollab',
  tools: 'nav.groupTools',
  fun: 'nav.groupFun',
}

function navLabel(t, item) {
  const key = `nav.${item.id}`
  const translated = t(key)
  return translated === key ? item.label : translated
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
}) {
  const { t } = useI18n()
  const [closedGroups, setClosedGroups] = useState(readGroups)

  useEffect(() => {
    try {
      localStorage.setItem(GROUPS_KEY, JSON.stringify(closedGroups))
    } catch {
      /* ignore */
    }
  }, [closedGroups])

  const toggleGroup = (id) => {
    setClosedGroups((prev) => ({ ...prev, [id]: !prev[id] }))
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

  return (
    <aside className="flex h-full w-[min(260px,100vw)] flex-col border-r border-sage-200 bg-sage-800 text-sage-50 lg:w-full">
      <div className="flex h-full flex-col p-3 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className={`mb-4 flex items-center gap-2 px-1 pt-1 ${collapsed ? 'lg:justify-center' : 'justify-between'}`}>
          <div className={`min-w-0 ${collapsed ? 'lg:hidden' : ''}`}>
            <p className="font-display text-2xl leading-none">Nazix</p>
            <p className="mt-1 truncate text-xs text-sage-300">
              {getBackendMode() === 'firebase' ? t('nav.firebase') : t('nav.localMode')} · {user.role}
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

        <nav className="flex-1 space-y-3 overflow-y-auto xx-scroll" aria-label={t('nav.primary')}>
          {NAV_GROUPS.map((group) => {
            const closed = Boolean(closedGroups[group.id]) && !collapsed
            const groupLabel = t(GROUP_I18N[group.id] || group.label)
            return (
              <div key={group.id}>
                <button
                  type="button"
                  className={`flex w-full items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-sage-300 hover:text-sage-50 ${
                    collapsed ? 'lg:hidden' : ''
                  }`}
                  onClick={() => toggleGroup(group.id)}
                  aria-expanded={!closed}
                >
                  <span className="min-w-0 flex-1 truncate text-left">{groupLabel}</span>
                  <ChevronDown size={14} className={`shrink-0 transition ${closed ? '-rotate-90' : ''}`} />
                </button>
                {collapsed && <div className="hidden h-px bg-sage-600/80 lg:block" aria-hidden />}
                {!closed && (
                  <div className="mt-1 space-y-0.5">
                    {group.items.filter((item) => item.id !== 'orgadmin' || isAdmin(user)).map((item) => {
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
            title={t('nav.settings')}
            aria-label={t('nav.settings')}
            aria-current={view === 'settings' ? 'page' : undefined}
            className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition ${
              collapsed ? 'lg:justify-center lg:px-0' : ''
            } ${view === 'settings' ? 'bg-sage-600 text-white' : 'text-sage-100 hover:bg-sage-700'}`}
          >
            <Settings size={18} className="shrink-0" />
            <span className={`min-w-0 flex-1 truncate ${collapsed ? 'lg:hidden' : ''}`}>{t('nav.settings')}</span>
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
