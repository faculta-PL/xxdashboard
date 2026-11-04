/** Nazix — notes, idées, projets, équipe */
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  LayoutDashboard,
  StickyNote,
  Lightbulb,
  FolderKanban,
  CalendarDays,
  Search,
  Download,
  Bell,
  Settings,
  LogOut,
  Menu,
  X,
  Plus,
  Trash2,
  Pencil,
  Check,
  Eye,
  EyeOff,
  ThumbsUp,
  ArrowRight,
  Users,
  Shield,
  Database,
  RefreshCw,
  ExternalLink,
  Filter,
  Mail,
  MessageCircle,
  Send,
  UserPlus,
  ChevronLeft,
  ChevronDown,
  Columns3,
  HelpCircle,
  FolderOpen,
  Upload,
  FolderPlus,
  LayoutGrid,
  List,
  FileText,
  Image as ImageIcon,
  Share2,
  Folder,
  Wallet,
  ShieldAlert,
  AlertTriangle,
  BoxSelect,
  Link2,
  Sparkles,
} from 'lucide-react'
import ImportModal from './ImportModal'
import CanvasView from './CanvasView'
import { AssistantFab, AssistantPanel, AssistantView, AiSettingsBlock } from './Assistant'
import {
  bootStore,
  subscribeStore,
  registerUser,
  verifyEmail,
  loginUser,
  logoutCurrentSession,
  getCurrentSession,
  requestPasswordReset,
  resetPasswordWithToken,
  updateProfile,
  updateUserRole,
  resendVerificationEmail,
  listUsers,
  listSessionsForUser,
  revokeSession,
  saveNote,
  deleteNote,
  saveIdea,
  deleteIdea,
  saveProject,
  deleteProject,
  saveEvent,
  deleteEvent,
  appendIdeaHistory,
  voteIdea,
  notifyUsers,
  markNotificationRead,
  markAllNotificationsRead,
  diagnoseDatabase,
  exportDeploymentKit,
  getBackendMode,
  getMinPasswordLength,
  getBootHint,
  pushLocalToFirebase,
  pullFirebaseToLocal,
  ensureGeneralGroup,
  saveGroup,
  inviteToGroup,
  sendMessage,
  listGroupsForUser,
  listPresentUserIds,
  startFileUpload,
  saveFolder,
  deleteFolder,
  saveFileMeta,
  deleteFile,
  getFileBlob,
  folderDeleteSummary,
  isRemoteFileStorage,
  saveBudget,
  deleteBudget,
  saveBudgetLine,
  deleteBudgetLine,
  addBudgetLineComment,
  saveRisk,
  deleteRisk,
  addRiskComment,
  saveRiskAction,
  deleteRiskAction,
  syncNoteLinks,
} from './lib/store'
import { firebaseConfigured, missingFirebaseVars, getFirebaseStatus } from './lib/firebase'
import {
  canReadEntity,
  canEditEntity,
  canDeleteEntity,
  canWriteRole,
  canReadGroup,
  isAdmin,
  ROLES,
  canReadFileOrFolder,
  canModifyFileOrFolder,
  canManageFileOrFolder,
  canDeleteFileOrFolder,
  canAddInFolder,
  canManageBudgetRisk,
  canDeleteBudgetRisk,
  computeRiskPriority,
  isDateOverdue,
  isDateNearDue,
  isOpenRisk,
  BUDGET_CURRENCIES,
  BUDGET_CATEGORIES,
  BUDGET_ACTUAL_STATUSES,
  RISK_CATEGORIES,
  RISK_PROBABILITIES,
  RISK_IMPACTS,
  RISK_STATUSES,
  RISK_ACTION_STATUSES,
  noteChildList,
  relatedLinkEnds,
  isNoteAncestor,
} from './lib/rbac'
import {
  FAB_VIEWS,
  readExternalPref,
  writeExternalPref,
  readWebPref,
  buildContextPayload,
} from './lib/assistant'
import {
  MAX_FILE_BYTES,
  ALLOWED_FILE_EXTS,
  FILE_PERM_OPTIONS,
  maxFileSizeLabel,
  formatFileSize,
  isImageExt,
  isPdfExt,
  validateUploadFile,
} from './lib/files'
import {
  exportJSON,
  exportCSV,
  exportXLSX,
  exportDOCX,
  exportPDF,
  buildExportRows,
  buildDocSections,
  buildPdfTables,
} from './lib/export'

const NOTE_CATEGORIES = [
  'Général',
  'Stratégie',
  'Réunion',
  'Technique',
  'Recherche',
  'Organisation',
]
const IDEA_STATUSES = [
  'Nouvelle',
  'En discussion',
  'Retenue',
  'En cours de réalisation',
  'Abandonnée',
]
const PROJECT_STATUSES = ['À préparer', 'Actif', 'En pause', 'Terminé', 'Archivé']
const VISIBILITIES = ['Privée', 'Partagée', 'Publique']
const SCOPED_VISIBILITIES = ['Privée', 'Partagée', 'Équipe', 'Publique']
const BUDGET_TABS = [
  { id: 'planned', label: 'Prévision' },
  { id: 'actual', label: 'Réel' },
  { id: 'salary', label: 'Salaires' },
]
const SHARE_PERMS = [
  ['Lecture', 'Lecture'],
  ['Édition', 'Édition'],
]

const NAV = [
  { id: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
  { id: 'assistant', label: 'Assistant IA', icon: Sparkles },
  { id: 'canvas', label: 'Espace visuel', icon: BoxSelect },
  { id: 'notes', label: 'Notes', icon: StickyNote },
  { id: 'ideas', label: 'Boîte à idées', icon: Lightbulb },
  { id: 'projects', label: 'Projets', icon: FolderKanban },
  { id: 'budget', label: 'Budget', icon: Wallet },
  { id: 'risks', label: 'Risques et solutions', icon: ShieldAlert },
  { id: 'files', label: 'Fichiers', icon: FolderOpen },
  { id: 'calendar', label: 'Calendrier', icon: CalendarDays },
  { id: 'team', label: 'Équipe', icon: Users },
  { id: 'chat', label: 'Chat', icon: MessageCircle },
  { id: 'search', label: 'Recherche', icon: Search },
  { id: 'export', label: 'Exportation', icon: Download },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'settings', label: 'Paramètres', icon: Settings },
]

const CHAT_READ_KEY = 'nazix_chat_read'

function readChatMap() {
  try {
    return JSON.parse(localStorage.getItem(CHAT_READ_KEY) || '{}')
  } catch {
    return {}
  }
}

function writeChatMap(map) {
  localStorage.setItem(CHAT_READ_KEY, JSON.stringify(map))
}

function EmptyState({ title, hint, action }) {
  return (
    <div className="rounded-2xl border border-dashed border-sage-300 bg-white/50 px-6 py-14 text-center animate-fade-up">
      <p className="font-display text-xl text-sage-800">{title}</p>
      <p className="mt-2 text-sm text-sage-600">{hint}</p>
      {action}
    </div>
  )
}

function Modal({ open, title, onClose, children, wide }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-3">
      <button type="button" className="absolute inset-0" aria-label="Fermer" onClick={onClose} />
      <div
        className={`relative z-10 flex max-h-[min(92dvh,100%)] w-full max-w-full flex-col overflow-hidden rounded-t-2xl bg-sage-50 shadow-xl animate-fade-up sm:max-h-[92vh] sm:rounded-2xl ${
          wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'
        }`}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-sage-200 px-4 py-3 sm:px-5">
          <h3 className="min-w-0 break-words font-display text-xl text-sage-900">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg p-2 text-sage-600 hover:bg-sage-200"
          >
            <X size={18} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 xx-scroll sm:px-5">{children}</div>
      </div>
    </div>
  )
}

function ModalActions({ children }) {
  return (
    <div className="sticky bottom-0 z-10 -mx-4 mt-4 flex flex-col-reverse gap-2 border-t border-sage-200 bg-sage-50 px-4 py-3 sm:-mx-5 sm:flex-row sm:px-5 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      {children}
    </div>
  )
}

function Field({ label, children }) {
  return (
    <label className="mb-3 block text-sm">
      <span className="mb-1 block font-medium text-sage-800">{label}</span>
      {children}
    </label>
  )
}

const inputClass =
  'w-full min-h-11 rounded-xl border border-sage-300 bg-white px-3 py-2.5 text-sage-900 outline-none ring-sage-400 placeholder:text-sage-400 focus:ring-2'
const btnPrimary =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-sage-700 px-4 py-2.5 text-sm font-semibold text-sage-50 transition hover:bg-sage-800 disabled:opacity-50'
const btnGhost =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-sage-300 bg-white/70 px-3 py-2 text-sm font-medium text-sage-800 transition hover:bg-sage-100'

function ShareEditor({ users, shares, onChange, excludeId, permissions }) {
  const options = users.filter((u) => u.id !== excludeId)
  const perms = permissions || [
    ['Lecture seule', 'Lecture seule'],
    ['Édition', 'Édition'],
  ]
  return (
    <div className="space-y-2 rounded-xl border border-sage-200 bg-white p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-sage-500">Partage</p>
      {options.length === 0 && (
        <p className="text-sm text-sage-500">Aucun autre collaborateur pour le moment.</p>
      )}
      {options.map((u) => {
        const share = shares.find((s) => s.userId === u.id)
        return (
          <div key={u.id} className="flex flex-wrap items-center gap-2 text-sm">
            <span className="min-w-0 flex-1 truncate text-sage-800">{u.fullName}</span>
            <select
              className={inputClass + ' max-w-full md:!w-auto py-1.5'}
              value={share?.permission || ''}
              onChange={(e) => {
                const permission = e.target.value
                const next = shares.filter((s) => s.userId !== u.id)
                if (permission) next.push({ userId: u.id, permission })
                onChange(next)
              }}
            >
              <option value="">Aucun</option>
              {perms.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        )
      })}
    </div>
  )
}

function FileShareBlock({ users, user, shares, teamWide, onShares, onTeamWide }) {
  return (
    <div className="space-y-3">
      <label className="flex items-start gap-2 rounded-xl border border-sage-200 bg-white p-3 text-sm">
        <input
          type="checkbox"
          className="mt-1 h-4 w-4 accent-sage-700"
          checked={Boolean(teamWide)}
          onChange={(e) => onTeamWide(e.target.checked)}
        />
        <span>
          <span className="font-medium text-sage-800">Toute l’équipe</span>
          <span className="mt-0.5 block text-xs text-sage-500">
            Tous les comptes connectés peuvent lire (visibilité Équipe).
          </span>
        </span>
      </label>
      <ShareEditor
        users={users}
        shares={shares}
        excludeId={user.id}
        permissions={FILE_PERM_OPTIONS.map((p) => [p, p])}
        onChange={onShares}
      />
    </div>
  )
}

export default function App() {
  const [booting, setBooting] = useState(true)
  const [db, setDb] = useState(null)
  const [session, setSession] = useState(null)
  const [user, setUser] = useState(null)
  const [view, setView] = useState('dashboard')
  const [mobileNav, setMobileNav] = useState(false)
  const [toast, setToast] = useState(null)
  const [authMode, setAuthMode] = useState('login')
  const [authForm, setAuthForm] = useState({
    fullName: '',
    email: '',
    password: '',
    resetToken: '',
    newPassword: '',
  })
  const [authBusy, setAuthBusy] = useState(false)
  const [showPass, setShowPass] = useState(false)
  const [chatReadMap, setChatReadMap] = useState(readChatMap)
  const [importOpen, setImportOpen] = useState(false)
  const [importDefaults, setImportDefaults] = useState({ destination: 'notes', projectId: '', folderId: '' })
  const [aiOpen, setAiOpen] = useState(false)
  const [aiCollapsed, setAiCollapsed] = useState(false)
  const [allowExternal, setAllowExternal] = useState(readExternalPref)
  const [webSearch, setWebSearch] = useState(readWebPref)
  const [selectedNoteIds, setSelectedNoteIds] = useState([])
  const [currentProjectId, setCurrentProjectId] = useState('')
  const [currentBudgetId, setCurrentBudgetId] = useState('')

  const openImport = (defaults = {}) => {
    setImportDefaults({
      destination: defaults.destination || 'notes',
      projectId: defaults.projectId || '',
      folderId: defaults.folderId || '',
    })
    setImportOpen(true)
  }

  const flash = (message, type = 'ok') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3200)
  }

  useEffect(() => {
    let unsub = () => {}
    let cancelled = false
    let bootCap
    ;(async () => {
      try {
        await Promise.race([
          bootStore(),
          new Promise((resolve) => {
            bootCap = setTimeout(() => {
              console.warn('Boot wait capped at 8s — splash released')
              resolve()
            }, 8000)
          }),
        ])
        if (bootCap) clearTimeout(bootCap)
        if (cancelled) return
        unsub = subscribeStore(setDb)
        let restored = null
        try {
          restored = await Promise.race([
            getCurrentSession(),
            new Promise((_, reject) => {
              setTimeout(() => reject(new Error('Session restore timed out')), 2500)
            }),
          ])
          if (!cancelled && restored) {
            setUser(restored.user)
            setSession(restored.session)
          }
        } catch (err) {
          console.warn('Session restore skipped:', err.message)
        }
        const hint = getBootHint()
        if (!cancelled && hint && restored) {
          setToast({ message: hint, type: 'err' })
          setTimeout(() => setToast(null), 5200)
        }
      } catch (err) {
        console.warn('Boot failed open:', err)
        try {
          if (!cancelled) unsub = subscribeStore(setDb)
        } catch {
          /* ignore */
        }
      } finally {
        if (!cancelled) setBooting(false)
      }
    })()
    return () => {
      cancelled = true
      if (bootCap) clearTimeout(bootCap)
      unsub()
    }
  }, [])

  const users = useMemo(() => (db ? listUsers() : []), [db])
  const notes = useMemo(
    () =>
      db && user
        ? Object.values(db.xx_notes || {}).filter((n) => canReadEntity(user, n))
        : [],
    [db, user],
  )
  const ideas = useMemo(
    () =>
      db && user
        ? Object.values(db.xx_ideas || {}).filter((i) => canReadEntity(user, i))
        : [],
    [db, user],
  )
  const projects = useMemo(
    () =>
      db && user
        ? Object.values(db.xx_projects || {}).filter((p) => canReadEntity(user, p))
        : [],
    [db, user],
  )
  const events = useMemo(
    () =>
      db && user
        ? Object.values(db.xx_events || {}).filter((e) => canReadEntity(user, e))
        : [],
    [db, user],
  )
  const fileCtx = useMemo(
    () => ({ folders: db?.xx_folders || {}, projects: db?.xx_projects || {} }),
    [db],
  )
  const folders = useMemo(
    () =>
      db && user
        ? Object.values(db.xx_folders || {}).filter((f) => canReadFileOrFolder(user, f, fileCtx))
        : [],
    [db, user, fileCtx],
  )
  const files = useMemo(
    () =>
      db && user
        ? Object.values(db.xx_files || {}).filter((f) => canReadFileOrFolder(user, f, fileCtx))
        : [],
    [db, user, fileCtx],
  )
  const projectsById = useMemo(
    () => Object.fromEntries(projects.map((p) => [p.id, p])),
    [projects],
  )
  const budgets = useMemo(
    () =>
      db && user
        ? Object.values(db.xx_budgets || {})
            .filter((b) => canReadEntity(user, b))
            .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'fr'))
        : [],
    [db, user],
  )
  const budgetIdSet = useMemo(() => new Set(budgets.map((b) => b.id)), [budgets])
  const budgetLines = useMemo(
    () =>
      db && user
        ? Object.values(db.xx_budget_lines || {}).filter((l) => budgetIdSet.has(l.budgetId))
        : [],
    [db, user, budgetIdSet],
  )
  const risks = useMemo(
    () =>
      db && user
        ? Object.values(db.xx_risks || {})
            .filter((r) => canReadEntity(user, r))
            .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))
        : [],
    [db, user],
  )
  const riskIdSet = useMemo(() => new Set(risks.map((r) => r.id)), [risks])
  const riskActions = useMemo(
    () =>
      db && user
        ? Object.values(db.xx_risk_actions || {}).filter((a) => riskIdSet.has(a.riskId))
        : [],
    [db, user, riskIdSet],
  )
  const notifications = useMemo(
    () =>
      db && user
        ? Object.values(db.xx_notifications || {})
            .filter((n) => n.userId === user.id)
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        : [],
    [db, user],
  )
  const unread = notifications.filter((n) => !n.read).length
  const groups = useMemo(
    () => (db && user ? listGroupsForUser(user) : []),
    [db, user],
  )
  const chatMessages = useMemo(
    () =>
      db && user
        ? Object.values(db.xx_messages || {})
            .filter((m) => {
              const group = db.xx_groups?.[m.groupId]
              return group && canReadGroup(user, group)
            })
            .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
        : [],
    [db, user],
  )
  const presentIds = useMemo(() => (db ? listPresentUserIds() : []), [db])
  const links = useMemo(() => (db ? Object.values(db.xx_links || {}) : []), [db])
  const canvasLayout = useMemo(
    () => (db && user ? db.xx_canvas_layout?.[user.id] || null : null),
    [db, user],
  )
  const aiThreads = useMemo(
    () =>
      db && user
        ? Object.values(db.xx_ai_threads || {})
            .filter((t) => t.userId === user.id)
            .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))
        : [],
    [db, user],
  )
  const assistantContext = useMemo(
    () =>
      buildContextPayload({
        section: view === 'assistant' ? 'dashboard' : view,
        notes,
        ideas,
        projects,
        events,
        files,
        budgets,
        budgetLines,
        risks,
        selectedNoteIds,
        currentProjectId,
        currentBudgetId,
      }),
    [view, notes, ideas, projects, events, files, budgets, budgetLines, risks, selectedNoteIds, currentProjectId, currentBudgetId],
  )

  useEffect(() => {
    if (!user || !db) return
    const prefs = db.xx_settings?.[user.id]
    if (prefs && typeof prefs.aiExternalEnabled === 'boolean') {
      setAllowExternal(prefs.aiExternalEnabled)
      writeExternalPref(prefs.aiExternalEnabled)
    }
  }, [user, db])
  const chatUnread = useMemo(() => {
    if (!user) return 0
    return chatMessages.filter((m) => {
      if (m.authorId === user.id) return false
      const seen = chatReadMap[m.groupId]
      return !seen || m.createdAt > seen
    }).length
  }, [chatMessages, chatReadMap, user])

  const markChatGroupRead = (groupId) => {
    if (!groupId) return
    const next = { ...readChatMap(), [groupId]: new Date().toISOString() }
    writeChatMap(next)
    setChatReadMap(next)
  }

  const refreshUser = async () => {
    const current = await getCurrentSession()
    if (current) {
      setUser(current.user)
      setSession(current.session)
    } else {
      setUser(null)
      setSession(null)
    }
  }

  const handleAuth = async (e) => {
    e.preventDefault()
    setAuthBusy(true)
    try {
      if (authMode === 'login') {
        const res = await loginUser(authForm.email, authForm.password)
        setUser(res.user)
        setSession(res.session)
        flash('Session ouverte.')
      } else if (authMode === 'register') {
        await registerUser(authForm)
        flash('Compte créé. E-mail de vérification envoyé.')
        const logged = await loginUser(authForm.email, authForm.password)
        setUser(logged.user)
        setSession(logged.session)
      } else if (authMode === 'forgot') {
        await requestPasswordReset(authForm.email)
        flash('E-mail envoyé.')
        setAuthMode('reset')
      } else if (authMode === 'reset') {
        await resetPasswordWithToken(authForm.resetToken, authForm.newPassword)
        flash('Mot de passe mis à jour (Firestore et Auth si le code e-mail était valide). Vous pouvez vous connecter.')
        setAuthMode('login')
      }
    } catch (err) {
      flash(err.message || 'Erreur', 'err')
    } finally {
      setAuthBusy(false)
    }
  }

  const handleLogout = async () => {
    try {
      localStorage.removeItem('xxdashboard_session_token')
    } catch {
      /* ignore */
    }
    setUser(null)
    setSession(null)
    setView('dashboard')
    try {
      await logoutCurrentSession()
    } catch (err) {
      console.warn('logout:', err)
    }
  }

  if (booting) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center">
        <div className="text-center animate-fade-up">
          <p className="font-display text-3xl text-sage-800">Nazix</p>
          <p className="mt-2 animate-soft-pulse text-sm text-sage-600">Chargement…</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <LandingPage
        authMode={authMode}
        setAuthMode={setAuthMode}
        authForm={authForm}
        setAuthForm={setAuthForm}
        authBusy={authBusy}
        showPass={showPass}
        setShowPass={setShowPass}
        handleAuth={handleAuth}
        toast={toast}
      />
    )
  }

  return (
    <div className="min-h-[100dvh] overflow-x-hidden lg:grid lg:grid-cols-[minmax(0,260px)_minmax(0,1fr)]">
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-[min(260px,100%)] border-r border-sage-200 bg-sage-800 text-sage-50 transition lg:static ${
          mobileNav ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex h-full flex-col p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="mb-6 flex items-center justify-between gap-2 px-2 pt-2">
            <div className="min-w-0">
              <p className="font-display text-2xl leading-none">Nazix</p>
              <p className="mt-1 truncate text-xs text-sage-300">
                {getBackendMode() === 'firebase' ? 'Firebase' : 'Mode local'} · {user.role}
              </p>
            </div>
            <button
              type="button"
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg hover:bg-sage-700 lg:hidden"
              onClick={() => setMobileNav(false)}
              aria-label="Fermer le menu"
            >
              <X size={20} />
            </button>
          </div>
          <nav className="flex-1 space-y-1 overflow-y-auto xx-scroll">
            {NAV.map((item) => {
              const Icon = item.icon
              const active = view === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setView(item.id)
                    setMobileNav(false)
                  }}
                  className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition ${
                    active ? 'bg-sage-600 text-white' : 'text-sage-100 hover:bg-sage-700'
                  }`}
                >
                  <Icon size={18} className="shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {item.id === 'notifications' && unread > 0 && (
                    <span className="rounded-full bg-cream-green px-2 py-0.5 text-[11px] font-bold text-sage-800">
                      {unread}
                    </span>
                  )}
                  {item.id === 'chat' && chatUnread > 0 && (
                    <span className="rounded-full bg-cream-green px-2 py-0.5 text-[11px] font-bold text-sage-800">
                      {chatUnread}
                    </span>
                  )}
                </button>
              )
            })}
          </nav>
          <div className="mt-4 border-t border-sage-600 pt-4">
            <p className="truncate px-2 text-sm font-medium">{user.fullName}</p>
            <p className="truncate px-2 text-xs text-sage-300">{user.email}</p>
            <button type="button" onClick={handleLogout} className={`${btnGhost} mt-3 w-full !bg-sage-700 !text-sage-50 !border-sage-600`}>
              <LogOut size={16} /> Déconnexion
            </button>
          </div>
        </div>
      </aside>

      {mobileNav && (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-ink/40 lg:hidden"
          aria-label="Fermer le menu"
          onClick={() => setMobileNav(false)}
        />
      )}

      <div className="relative z-0 min-w-0">
        <header className="sticky top-0 z-20 flex min-h-14 items-center gap-3 border-b border-sage-200/80 bg-cream-green/80 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur">
          <button
            type="button"
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg p-2 text-sage-800 hover:bg-sage-200 lg:hidden"
            onClick={() => setMobileNav(true)}
            aria-label="Ouvrir le menu"
          >
            <Menu size={20} />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-xl text-sage-900 md:text-2xl">
              {NAV.find((n) => n.id === view)?.label}
            </h1>
          </div>
          {!user.emailVerified && (
            <span className="hidden rounded-full bg-warn/15 px-3 py-1 text-xs font-semibold text-warn md:inline">
              E-mail non vérifié
            </span>
          )}
        </header>

        <main
          className={`min-w-0 ${view === 'chat' ? 'p-2 md:p-4' : 'p-4 md:p-6'} pb-[max(1.25rem,env(safe-area-inset-bottom))]`}
        >
          {view === 'assistant' && (
            <AssistantView
              user={user}
              threads={aiThreads}
              section={view}
              context={assistantContext}
              users={users}
              projects={projects}
              budgets={budgets}
              notes={notes}
              flash={flash}
              allowExternal={allowExternal}
              setAllowExternal={setAllowExternal}
              webSearch={webSearch}
              setWebSearch={setWebSearch}
            />
          )}
          {view === 'dashboard' && (
            <DashboardView
              notes={notes}
              ideas={ideas}
              projects={projects}
              files={files}
              events={events}
              budgets={budgets}
              budgetLines={budgetLines}
              risks={risks}
              onQuick={(v) => setView(v)}
            />
          )}
          {view === 'canvas' && (
            <CanvasView
              user={user}
              projects={projects}
              notes={notes}
              ideas={ideas}
              files={files}
              events={events}
              budgets={budgets}
              budgetLines={budgetLines}
              risks={risks}
              links={links}
              layout={canvasLayout}
              flash={flash}
              onImport={() => openImport({ destination: 'notes' })}
              onOpenModule={(v) => setView(v)}
            />
          )}
          {view === 'notes' && (
            <NotesView
              user={user}
              notes={notes}
              users={users}
              projects={projects}
              files={files}
              ideas={ideas}
              risks={risks}
              budgetLines={budgetLines}
              links={links}
              flash={flash}
              onImport={() => openImport({ destination: 'notes' })}
              selectedNoteIds={selectedNoteIds}
              onToggleNote={(id) =>
                setSelectedNoteIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
              }
            />
          )}
          {view === 'ideas' && (
            <IdeasView user={user} ideas={ideas} users={users} flash={flash} />
          )}
          {view === 'projects' && (
            <ProjectsView
              user={user}
              projects={projects}
              notes={notes}
              ideas={ideas}
              files={files}
              events={events}
              budgets={budgets}
              risks={risks}
              links={links}
              users={users}
              flash={flash}
              onImport={() => openImport({ destination: 'projects' })}
              onFocusProject={setCurrentProjectId}
            />
          )}
          {view === 'budget' && (
            <BudgetView
              user={user}
              budgets={budgets}
              lines={budgetLines}
              projects={projects}
              projectsById={projectsById}
              users={users}
              flash={flash}
              onImport={() => openImport({ destination: 'budget' })}
              onFocusBudget={setCurrentBudgetId}
            />
          )}
          {view === 'risks' && (
            <RisksView
              user={user}
              risks={risks}
              actions={riskActions}
              projects={projects}
              projectsById={projectsById}
              users={users}
              flash={flash}
              onImport={() => openImport({ destination: 'risks' })}
            />
          )}
          {view === 'files' && (
            <FilesView
              user={user}
              files={files}
              folders={folders}
              foldersMap={db?.xx_folders || {}}
              projects={projects}
              users={users}
              flash={flash}
              onImport={(folderId) =>
                openImport({ destination: 'files', folderId: folderId || '' })
              }
            />
          )}
          {view === 'calendar' && (
            <CalendarView user={user} events={events} users={users} flash={flash} />
          )}
          {view === 'team' && <TeamView users={users} presentIds={presentIds} />}
          {view === 'chat' && (
            <ChatView
              user={user}
              groups={groups}
              messages={chatMessages}
              users={users}
              flash={flash}
              readMap={chatReadMap}
              onReadGroup={markChatGroupRead}
            />
          )}
          {view === 'search' && (
            <SearchView
              notes={notes}
              ideas={ideas}
              projects={projects}
              events={events}
              files={files}
              budgets={budgets}
              risks={risks}
            />
          )}
          {view === 'export' && (
            <ExportView notes={notes} ideas={ideas} projects={projects} events={events} flash={flash} />
          )}
          {view === 'notifications' && (
            <NotificationsView notifications={notifications} flash={flash} user={user} />
          )}
          {view === 'settings' && (
            <SettingsView
              user={user}
              session={session}
              users={users}
              flash={flash}
              onUserUpdated={refreshUser}
              allowExternal={allowExternal}
              onAllowExternal={setAllowExternal}
            />
          )}
        </main>
      </div>
      {view !== 'assistant' && FAB_VIEWS.includes(view) && (
        <>
          <AssistantFab view={view} open={aiOpen} onOpen={() => { setAiOpen(true); setAiCollapsed(false) }} />
          <AssistantPanel
            open={aiOpen}
            collapsed={aiCollapsed}
            onCollapse={setAiCollapsed}
            onClose={() => setAiOpen(false)}
            user={user}
            threads={aiThreads}
            section={view}
            context={assistantContext}
            users={users}
            projects={projects}
            budgets={budgets}
            notes={notes}
            flash={flash}
            allowExternal={allowExternal}
            setAllowExternal={setAllowExternal}
            webSearch={webSearch}
            setWebSearch={setWebSearch}
          />
        </>
      )}
      {toast && <Toast toast={toast} />}
      <ImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        user={user}
        flash={flash}
        defaultDestination={importDefaults.destination}
        defaultProjectId={importDefaults.projectId}
        defaultFolderId={importDefaults.folderId}
        projects={projects}
        budgets={budgets}
      />
    </div>
  )
}

const LANDING_MODULES = [
  { id: 'notes', title: 'Notes', hint: 'Prises rapides, catégories, partage.', icon: StickyNote },
  { id: 'kanban', title: 'Kanban', hint: 'Boîte à idées, statuts, votes.', icon: Columns3 },
  { id: 'projets', title: 'Projets', hint: 'Suivi, responsables, pièces jointes.', icon: FolderKanban },
  { id: 'calendrier', title: 'Calendrier', hint: 'Échéances d’équipe au même endroit.', icon: CalendarDays },
  { id: 'fichiers', title: 'Fichiers', hint: 'Dossiers, 20 Mo, pdf et images.', icon: FolderOpen },
  { id: 'canvas', title: 'Espace visuel', hint: 'Carte, liens, notes et import.', icon: BoxSelect },
  { id: 'assistant', title: 'Assistant IA', hint: 'Local par défaut, actions à confirmer.', icon: Sparkles },
  { id: 'equipe', title: 'Équipe', hint: 'Présence, profils, invitations.', icon: Users },
  { id: 'chat', title: 'Chat', hint: 'Groupes, Général, messages en direct.', icon: MessageCircle },
  { id: 'export', title: 'Export', hint: 'CSV, XLSX, DOCX, PDF, JSON.', icon: Download },
]

const LANDING_PLANS = [
  {
    name: 'Gratuit',
    price: '0 €',
    tag: 'Solo · local',
    points: [
      'Notes, idées, projets, calendrier',
      'Données sur cet appareil (localStorage)',
      'Fichiers IndexedDB, 20 Mo max',
      'Un compte, pas de paiement',
    ],
    cta: 'Commencer gratuitement',
  },
  {
    name: 'Équipe',
    price: 'Inclus',
    tag: 'Collaboration',
    featured: true,
    points: [
      'Tout le plan Gratuit',
      'Firebase Auth + Firestore temps réel',
      'Chat, partage, présence',
      'Fichiers Storage (20 Mo)',
    ],
    cta: 'Créer un espace',
  },
  {
    name: 'Orga',
    price: 'Sur demande',
    tag: 'Structure',
    points: [
      'Tout le plan Équipe',
      'Rôles Admin, Responsable, Membre, Lecteur',
      'Diagnostic, export, sessions',
      'Aucun paiement intégré — inscription simple',
    ],
    cta: 'Ouvrir un compte',
  },
]

const LANDING_FAQ = [
  {
    q: 'Faut-il Firebase ?',
    a: 'Non. Sans clés, Nazix tourne en local sur cet appareil. Avec les variables VITE_FIREBASE_*, Auth, Firestore et Storage assurent la collaboration en temps réel.',
  },
  {
    q: 'Langue et dates ?',
    a: 'L’interface est entièrement en français (FR). Les dates s’affichent au format français. Pas de version anglaise pour le moment.',
  },
  {
    q: 'Quels sont les rôles ?',
    a: 'Administrateur, Responsable de projet, Membre et Lecteur. Un Lecteur consulte ce qui lui est partagé ; il ne crée pas de notes, idées, projets, groupes ou fichiers.',
  },
  {
    q: 'Quelle taille pour les fichiers ?',
    a: '20 Mo maximum par fichier. Types acceptés : pdf, docx, xlsx, csv, txt, md, jpg, png, gif, webp. Les exécutables et formats XSS sont refusés.',
  },
]

function scrollToId(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function LandingPage({
  authMode,
  setAuthMode,
  authForm,
  setAuthForm,
  authBusy,
  showPass,
  setShowPass,
  handleAuth,
  toast,
}) {
  const [authOpen, setAuthOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [ctaEmail, setCtaEmail] = useState('')
  const [faqOpen, setFaqOpen] = useState(0)

  const openAuth = (mode, email) => {
    setAuthMode(mode)
    if (typeof email === 'string') {
      setAuthForm((prev) => ({ ...prev, email }))
    }
    setAuthOpen(true)
    setMobileOpen(false)
  }

  const goSection = (id) => {
    setMobileOpen(false)
    scrollToId(id)
  }

  return (
    <div className="landing min-h-[100dvh] overflow-x-hidden">
      <header className="landing-header sticky top-0 z-40 border-b border-sage-200/40">
        <div className="mx-auto grid min-h-[4.25rem] max-w-6xl grid-cols-[1fr_auto] items-center gap-3 px-4 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2 sm:px-6 lg:grid-cols-[1fr_auto_1fr]">
          <p className="font-display text-[1.65rem] leading-none tracking-tight text-sage-900">Nazix</p>
          <nav className="hidden items-center gap-8 text-[15px] font-medium text-sage-800 lg:flex">
            <button type="button" className="hover:text-sage-950" onClick={() => goSection('fonctionnalites')}>
              Fonctionnalités
            </button>
            <button type="button" className="hover:text-sage-950" onClick={() => goSection('tarifs')}>
              Tarifs
            </button>
            <button type="button" className="hover:text-sage-950" onClick={() => goSection('ressources')}>
              Ressources
            </button>
          </nav>
          <div className="flex items-center justify-end gap-2 sm:gap-3">
            <button
              type="button"
              className="hidden min-h-11 px-2 text-[15px] font-medium text-sage-800 hover:text-sage-950 sm:inline"
              onClick={() => openAuth('login')}
            >
              Se connecter
            </button>
            <button
              type="button"
              className="inline-flex min-h-10 items-center rounded-full bg-sage-800 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-sage-900 sm:min-h-11 sm:px-5"
              onClick={() => openAuth('register')}
            >
              Essai gratuit
            </button>
            <button
              type="button"
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full text-sage-800 hover:bg-sage-200/70 lg:hidden"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label={mobileOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
            >
              {mobileOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
        {mobileOpen && (
          <div className="border-t border-sage-200/70 bg-[#f5f6f1] px-4 py-3 lg:hidden">
            <div className="flex flex-col gap-1">
              {[
                ['fonctionnalites', 'Fonctionnalités'],
                ['tarifs', 'Tarifs'],
                ['ressources', 'Ressources'],
              ].map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className="min-h-11 rounded-xl px-3 text-left font-medium text-sage-800 hover:bg-sage-100"
                  onClick={() => goSection(id)}
                >
                  {label}
                </button>
              ))}
              <button
                type="button"
                className="min-h-11 rounded-xl px-3 text-left font-medium text-sage-800 hover:bg-sage-100 sm:hidden"
                onClick={() => openAuth('login')}
              >
                Se connecter
              </button>
            </div>
          </div>
        )}
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-6 pt-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-8 lg:pb-4 lg:pt-12">
        <div className="max-w-xl animate-fade-up">
          <h1 className="font-display text-[2.35rem] font-medium leading-[1.12] tracking-tight text-sage-900 sm:text-5xl lg:text-[3.35rem]">
            Centralisez vos notes, idées, projets et équipe en un seul endroit.{' '}
            <span className="align-middle font-display text-[0.55em] font-medium text-sage-700">Nazix</span>
          </h1>
          <p className="mt-5 max-w-md text-[1.05rem] leading-relaxed text-sage-700">
            Un espace sobre et collaboratif pour noter vos idées, gérer vos projets et échanger avec
            votre équipe sans friction.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <button
              type="button"
              className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-sage-800 px-6 text-[15px] font-semibold text-white shadow-sm transition hover:bg-sage-900 sm:w-auto"
              onClick={() => openAuth('register')}
            >
              Commencer gratuitement
            </button>
            <button
              type="button"
              className="inline-flex min-h-12 w-full items-center justify-center rounded-full border border-sage-300 bg-transparent px-6 text-[15px] font-semibold text-sage-800 transition hover:bg-white/70 sm:w-auto"
              onClick={() => goSection('fonctionnalites')}
            >
              Voir la démo
            </button>
          </div>
        </div>
        <div className="relative mx-auto w-full max-w-[640px] animate-fade-up-d4 pb-6 lg:max-w-none lg:pb-10">
          <ProductMockup />
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-3 md:gap-6 lg:py-12">
        {[
          {
            icon: StickyNote,
            title: 'Notes & Idées',
            hint: 'Prenez des notes rapides, organisez vos pensées.',
          },
          {
            icon: Columns3,
            title: 'Tableau Kanban',
            hint: 'Suivez l’avancement de vos projets en équipe.',
          },
          {
            icon: MessageCircle,
            title: 'Chat Intégré',
            hint: 'Communiquez et décidez ensemble en temps réel.',
          },
        ].map((item, i) => {
          const Icon = item.icon
          return (
            <div key={item.title} className={`flex items-start gap-4 animate-fade-up-d${i + 1}`}>
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-sage-200 bg-sage-100 text-sage-700">
                <Icon size={20} strokeWidth={1.7} />
              </span>
              <div>
                <p className="font-display text-lg text-sage-900">{item.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-sage-600">{item.hint}</p>
              </div>
            </div>
          )
        })}
      </section>

      <section className="bg-[#e7ece3]">
        <div className="mx-auto flex max-w-6xl flex-col items-stretch gap-4 px-4 py-6 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-6 sm:py-7">
          <p className="text-center font-display text-xl text-sage-900 sm:text-left sm:text-[1.35rem]">
            Prêt à transformer votre façon de travailler ?
          </p>
          <form
            className="flex w-full min-w-0 flex-col gap-2 sm:max-w-md sm:flex-row sm:items-center"
            onSubmit={(e) => {
              e.preventDefault()
              openAuth('register', ctaEmail.trim())
            }}
          >
            <input
              type="email"
              className="min-h-12 w-full rounded-full border border-sage-300/80 bg-white px-5 text-sm text-sage-900 outline-none ring-sage-400 placeholder:text-sage-400 focus:ring-2"
              placeholder="Inscription par e-mail"
              value={ctaEmail}
              onChange={(e) => setCtaEmail(e.target.value)}
              autoComplete="email"
              required
            />
            <button
              type="submit"
              className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-full bg-sage-800 px-6 text-sm font-semibold text-white hover:bg-sage-900"
            >
              S'inscrire
            </button>
          </form>
        </div>
      </section>

      <section id="fonctionnalites" className="scroll-mt-24 mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sage-500">Fonctionnalités</p>
          <h2 className="mt-2 font-display text-3xl text-sage-900 md:text-4xl">
            Tout ce qu’il faut, au même endroit.
          </h2>
          <p className="mt-3 text-sage-600">
            Modules réellement présents dans l’app — pas une liste marketing inventée.
          </p>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {LANDING_MODULES.map((mod) => {
            const Icon = mod.icon
            return (
              <article
                key={mod.id}
                className="rounded-2xl border border-sage-200/80 bg-white/70 p-5 shadow-[0_1px_0_rgba(47,56,44,0.04)]"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-sage-100 text-sage-700">
                  <Icon size={18} strokeWidth={1.7} />
                </span>
                <h3 className="mt-4 font-display text-lg text-sage-900">{mod.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-sage-600">{mod.hint}</p>
              </article>
            )
          })}
        </div>
      </section>

      <section id="tarifs" className="scroll-mt-24 bg-[#eef2ea] py-16 lg:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sage-500">Tarifs</p>
            <h2 className="mt-2 font-display text-3xl text-sage-900 md:text-4xl">Simple, sans paiement fictif.</h2>
            <p className="mt-3 text-sage-600">
              Nazix n’intègre pas de caisse. Gratuit en local. Équipe et Orga s’ouvrent par inscription,
              avec Firebase pour la collaboration.
            </p>
          </div>
          <div className="mt-10 grid gap-4 lg:grid-cols-3">
            {LANDING_PLANS.map((plan) => (
              <article
                key={plan.name}
                className={`flex flex-col rounded-3xl border p-6 ${
                  plan.featured
                    ? 'border-sage-700 bg-sage-800 text-sage-50 shadow-lg'
                    : 'border-sage-200 bg-white/80 text-sage-900'
                }`}
              >
                <p className={`text-xs font-semibold uppercase tracking-wide ${plan.featured ? 'text-sage-300' : 'text-sage-500'}`}>
                  {plan.tag}
                </p>
                <h3 className="mt-2 font-display text-2xl">{plan.name}</h3>
                <p className={`mt-1 text-lg font-semibold ${plan.featured ? 'text-white' : 'text-sage-800'}`}>
                  {plan.price}
                </p>
                <ul className="mt-5 flex-1 space-y-2.5 text-sm">
                  {plan.points.map((p) => (
                    <li key={p} className="flex gap-2">
                      <Check size={16} className={`mt-0.5 shrink-0 ${plan.featured ? 'text-sage-200' : 'text-sage-600'}`} />
                      <span className={plan.featured ? 'text-sage-100' : 'text-sage-700'}>{p}</span>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  className={`mt-6 inline-flex min-h-11 items-center justify-center rounded-full px-4 text-sm font-semibold ${
                    plan.featured
                      ? 'bg-cream-green text-sage-900 hover:bg-white'
                      : 'bg-sage-800 text-white hover:bg-sage-900'
                  }`}
                  onClick={() => openAuth('register')}
                >
                  {plan.cta}
                </button>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="ressources" className="scroll-mt-24 mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sage-500">Ressources</p>
          <h2 className="mt-2 font-display text-3xl text-sage-900 md:text-4xl">Questions fréquentes</h2>
        </div>
        <div className="mt-8 divide-y divide-sage-200 overflow-hidden rounded-2xl border border-sage-200 bg-white/70">
          {LANDING_FAQ.map((item, i) => {
            const open = faqOpen === i
            return (
              <div key={item.q}>
                <button
                  type="button"
                  className="flex min-h-14 w-full items-center justify-between gap-4 px-5 py-4 text-left"
                  onClick={() => setFaqOpen(open ? -1 : i)}
                  aria-expanded={open}
                >
                  <span className="flex items-center gap-3 font-medium text-sage-900">
                    <HelpCircle size={18} className="shrink-0 text-sage-500" />
                    {item.q}
                  </span>
                  <ChevronDown size={18} className={`shrink-0 text-sage-500 transition ${open ? 'rotate-180' : ''}`} />
                </button>
                {open && <p className="px-5 pb-4 pl-12 text-sm leading-relaxed text-sage-600">{item.a}</p>}
              </div>
            )
          })}
        </div>
      </section>

      <footer className="border-t border-sage-200 bg-[#e8ede4]">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-3">
          <div>
            <p className="font-display text-2xl text-sage-900">Nazix</p>
            <p className="mt-2 max-w-xs text-sm leading-relaxed text-sage-600">
              Notes, idées, projets, fichiers, équipe et chat — un espace sobre pour travailler ensemble.
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-sage-500">Produit</p>
            <ul className="mt-3 space-y-2 text-sm text-sage-700">
              <li>
                <button type="button" className="hover:text-sage-900" onClick={() => goSection('fonctionnalites')}>
                  Fonctionnalités
                </button>
              </li>
              <li>
                <button type="button" className="hover:text-sage-900" onClick={() => goSection('tarifs')}>
                  Tarifs
                </button>
              </li>
              <li>
                <button type="button" className="hover:text-sage-900" onClick={() => goSection('ressources')}>
                  Ressources
                </button>
              </li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-sage-500">Compte</p>
            <ul className="mt-3 space-y-2 text-sm text-sage-700">
              <li>
                <button type="button" className="hover:text-sage-900" onClick={() => openAuth('login')}>
                  Se connecter
                </button>
              </li>
              <li>
                <button type="button" className="hover:text-sage-900" onClick={() => openAuth('register')}>
                  Essai gratuit
                </button>
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-sage-200/80 px-4 py-4 text-center text-xs text-sage-500 sm:px-6">
          Nazix · 2026 · Interface en français
        </div>
      </footer>

      <AuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        authMode={authMode}
        setAuthMode={setAuthMode}
        authForm={authForm}
        setAuthForm={setAuthForm}
        authBusy={authBusy}
        showPass={showPass}
        setShowPass={setShowPass}
        handleAuth={handleAuth}
      />
      {toast && <Toast toast={toast} />}
    </div>
  )
}

function ProductMockup() {
  const mockNav = [LayoutDashboard, StickyNote, Lightbulb, FolderKanban, FolderOpen, MessageCircle]
  return (
    <div className="relative mx-auto aspect-[16/11] w-full max-w-[640px] lg:max-w-none">
      <div className="pointer-events-none absolute -inset-6 rounded-[2.5rem] bg-gradient-to-br from-sage-200/50 via-transparent to-sage-300/30 blur-2xl" />
      <div className="landing-float absolute left-2 top-[18%] z-20 hidden flex-col gap-2 sm:flex sm:left-[-8px] lg:left-[-18px]">
        {['Notes', 'Kanban', 'Chat'].map((label) => (
          <span
            key={label}
            className="landing-pill inline-flex w-fit rounded-full bg-sage-800 px-3 py-1.5 text-[11px] font-semibold text-sage-50 sm:px-3.5 sm:text-xs"
          >
            {label}
          </span>
        ))}
      </div>
      <div className="landing-browser relative h-full overflow-hidden rounded-2xl bg-[#eef2ea]">
        <div className="flex h-8 items-center gap-2 border-b border-sage-200/80 bg-white/90 px-3">
          <span className="flex gap-1">
            <span className="h-2 w-2 rounded-full bg-[#d9b8ae]" />
            <span className="h-2 w-2 rounded-full bg-[#d8c9a3]" />
            <span className="h-2 w-2 rounded-full bg-[#b7c4ad]" />
          </span>
          <span className="font-display text-[11px] text-sage-800">Nazix</span>
          <span className="rounded-md bg-sage-100 px-2 py-0.5 text-[10px] font-medium text-sage-600">Dashboard</span>
          <span className="ml-auto flex -space-x-1">
            <span className="h-4 w-4 rounded-full bg-sage-300" />
            <span className="h-4 w-4 rounded-full bg-sage-500" />
          </span>
        </div>
        <div className="grid h-[calc(100%-2rem)] grid-cols-1 sm:grid-cols-[52px_minmax(0,0.95fr)_minmax(0,1.55fr)_minmax(0,1.05fr)]">
          <aside className="hidden flex-col items-center gap-2 bg-sage-800 p-2 text-sage-100 sm:flex">
            <span className="mb-1 font-display text-[10px] text-white">Nazix</span>
            {mockNav.map((Icon, i) => (
              <span
                key={i}
                className={`flex h-7 w-7 items-center justify-center rounded-md ${i === 0 ? 'bg-sage-600 text-white' : 'text-sage-200'}`}
              >
                <Icon size={12} strokeWidth={2} />
              </span>
            ))}
          </aside>
          <div className="hidden flex-col gap-1.5 overflow-hidden border-r border-sage-200/70 bg-[#f7f9f5] p-2 sm:flex">
            <p className="text-[10px] font-semibold text-sage-800">Notes & Idées</p>
            {[
              ['Brief sprint', 'Prioriser les notes partagées.'],
              ['Idées retenues', 'Kanban mis à jour en réunion.'],
              ['Compte rendu', 'Décisions du chat Général.'],
            ].map(([t, d]) => (
              <div key={t} className="rounded-lg bg-white p-1.5 shadow-sm">
                <p className="text-[9px] font-semibold text-sage-800">{t}</p>
                <p className="text-[8px] leading-snug text-sage-500">{d}</p>
              </div>
            ))}
          </div>
          <div className="flex min-w-0 flex-col overflow-hidden bg-white p-2">
            <p className="mb-1.5 text-[10px] font-semibold text-sage-800">Tableau Kanban</p>
            <div className="grid min-h-0 flex-1 grid-cols-3 gap-1.5">
              {[
                ['#dce6d4', ['À préparer', 'Cadrer le livrable']],
                ['#edd8d2', ['En saison', 'Suivi équipe']],
                ['#efe3c4', ['Retenue', 'Prête à lancer']],
              ].map(([bg, cards]) => (
                <div key={cards[0]} className="flex flex-col gap-1 rounded-lg p-1" style={{ background: bg }}>
                  {cards.map((c) => (
                    <div key={c} className="rounded-md bg-white/90 px-1.5 py-1 text-[8px] font-medium text-sage-800">
                      {c}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
          <div className="hidden min-w-0 flex-col overflow-hidden border-l border-sage-200/70 bg-[#f7f9f5] p-2 sm:flex">
            <p className="mb-1.5 text-[10px] font-semibold text-sage-800">Chat</p>
            <div className="space-y-1.5">
              <div className="max-w-[90%] rounded-xl rounded-tl-sm bg-sage-100 px-2 py-1 text-[8px] text-sage-800">
                On valide le tableau ce matin ?
              </div>
              <div className="ml-auto max-w-[90%] rounded-xl rounded-tr-sm bg-sage-700 px-2 py-1 text-[8px] text-sage-50">
                Oui — notes déjà partagées.
              </div>
              <div className="max-w-[90%] rounded-xl rounded-tl-sm bg-sage-100 px-2 py-1 text-[8px] text-sage-800">
                Parfait, on avance.
              </div>
            </div>
            <div className="mt-auto flex items-center gap-1 rounded-full bg-white px-2 py-1 text-[8px] text-sage-400">
              Écrire un message…
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function AuthModal({
  open,
  onClose,
  authMode,
  setAuthMode,
  authForm,
  setAuthForm,
  authBusy,
  showPass,
  setShowPass,
  handleAuth,
}) {
  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const isResetish = authMode === 'forgot' || authMode === 'reset'
  const title =
    authMode === 'register'
      ? 'Créer un compte'
      : authMode === 'forgot'
        ? 'Mot de passe oublié'
        : authMode === 'reset'
          ? 'Nouveau mot de passe'
          : 'Connexion'

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-end sm:items-stretch">
      <button type="button" className="absolute inset-0 bg-ink/40" aria-label="Fermer" onClick={onClose} />
      <div
        className="landing-drawer relative z-10 flex max-h-[min(94dvh,100%)] w-full max-w-full flex-col overflow-hidden rounded-t-2xl bg-[#f5f6f1] shadow-2xl sm:h-full sm:max-h-none sm:w-[26.5rem] sm:rounded-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-sage-200 px-5 py-4 pt-[max(1rem,env(safe-area-inset-top))]">
          <div>
            <p className="font-display text-2xl text-sage-900">{title}</p>
            <p className="mt-0.5 text-sm text-sage-600">
              {authMode === 'register' ? 'Quelques champs, puis l’espace de travail.' : 'E-mail et mot de passe.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg text-sage-600 hover:bg-sage-200"
            aria-label="Fermer"
          >
            <X size={18} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 xx-scroll pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          {!isResetish && (
            <div className="mb-4 grid grid-cols-2 gap-1 rounded-full bg-sage-100 p-1 text-sm">
              <button
                type="button"
                onClick={() => setAuthMode('login')}
                className={`min-h-10 rounded-full font-medium ${
                  authMode === 'login' ? 'bg-sage-800 text-white' : 'text-sage-700'
                }`}
              >
                Connexion
              </button>
              <button
                type="button"
                onClick={() => setAuthMode('register')}
                className={`min-h-10 rounded-full font-medium ${
                  authMode === 'register' ? 'bg-sage-800 text-white' : 'text-sage-700'
                }`}
              >
                Inscription
              </button>
            </div>
          )}
          <form onSubmit={handleAuth}>
            {authMode === 'register' && (
              <Field label="Nom">
                <input
                  className={inputClass}
                  value={authForm.fullName}
                  onChange={(e) => setAuthForm({ ...authForm, fullName: e.target.value })}
                  autoComplete="name"
                  required
                />
              </Field>
            )}
            {(authMode === 'login' || authMode === 'register' || authMode === 'forgot') && (
              <Field label="E-mail">
                <input
                  type="email"
                  className={inputClass}
                  value={authForm.email}
                  onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
                  autoComplete="email"
                  required
                />
              </Field>
            )}
            {(authMode === 'login' || authMode === 'register') && (
              <Field label="Mot de passe">
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    className={inputClass + ' pr-12'}
                    value={authForm.password}
                    onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                    minLength={getMinPasswordLength()}
                    autoComplete={authMode === 'login' ? 'current-password' : 'new-password'}
                    required
                  />
                  <button
                    type="button"
                    className="absolute right-1 top-1/2 min-h-11 min-w-11 -translate-y-1/2 p-2 text-sage-500"
                    onClick={() => setShowPass((v) => !v)}
                    aria-label={showPass ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  >
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </Field>
            )}
            {authMode === 'reset' && (
              <>
                <Field label="Code reçu par e-mail">
                  <input
                    className={inputClass}
                    value={authForm.resetToken}
                    onChange={(e) => setAuthForm({ ...authForm, resetToken: e.target.value })}
                    required
                  />
                </Field>
                <Field label="Nouveau mot de passe">
                  <input
                    type="password"
                    className={inputClass}
                    value={authForm.newPassword}
                    onChange={(e) => setAuthForm({ ...authForm, newPassword: e.target.value })}
                    minLength={getMinPasswordLength()}
                    autoComplete="new-password"
                    required
                  />
                </Field>
              </>
            )}
            <button type="submit" className="mt-1 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-sage-800 px-4 text-sm font-semibold text-white hover:bg-sage-900 disabled:opacity-50" disabled={authBusy}>
              {authBusy
                ? 'Patientez…'
                : authMode === 'login'
                  ? 'Se connecter'
                  : authMode === 'register'
                    ? 'Créer mon compte'
                    : authMode === 'forgot'
                      ? 'Envoyer le lien'
                      : 'Réinitialiser'}
            </button>
            {authMode === 'login' && (
              <button
                type="button"
                className="mt-3 w-full text-center text-sm text-sage-600 hover:text-sage-900"
                onClick={() => setAuthMode('forgot')}
              >
                Mot de passe oublié ?
              </button>
            )}
            {isResetish && (
              <button
                type="button"
                className="mt-3 w-full text-center text-sm text-sage-600 hover:text-sage-900"
                onClick={() => setAuthMode('login')}
              >
                Retour à la connexion
              </button>
            )}
          </form>
        </div>
      </div>
    </div>
  )
}

function Toast({ toast }) {
  return (
    <div
      className={`fixed bottom-4 left-4 right-4 z-[60] max-w-sm break-words rounded-xl px-4 py-3 text-sm shadow-lg animate-slide-in sm:left-auto sm:right-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] ${
        toast.type === 'err' ? 'bg-danger text-white' : 'bg-sage-800 text-sage-50'
      }`}
    >
      {toast.message}
    </div>
  )
}

function DashboardView({
  notes,
  ideas,
  projects,
  files = [],
  events,
  budgets = [],
  budgetLines = [],
  risks = [],
  onQuick,
}) {
  const byStatus = PROJECT_STATUSES.map((s) => ({
    status: s,
    count: projects.filter((p) => p.status === s).length,
  }))
  const upcoming = events
    .filter((e) => e.date && new Date(`${e.date}T${e.time || '00:00'}`) >= new Date(Date.now() - 86400000))
    .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))
    .slice(0, 5)

  const openRisks = risks.filter(isOpenRisk)
  const overdueRisks = openRisks.filter((r) => isDateOverdue(r.dueDate))
  const firstBudget = budgets[0]
  const firstPaid = firstBudget
    ? budgetLines
        .filter((l) => l.budgetId === firstBudget.id && l.kind === 'actual' && l.status === 'paid')
        .reduce((sum, l) => sum + Number(l.amount || 0), 0)
    : 0
  const firstPlanned = Number(firstBudget?.plannedTotal || 0)
  const firstRemaining = firstPlanned - firstPaid
  const firstPct = firstPlanned > 0 ? Math.round((firstPaid / firstPlanned) * 100) : 0

  const cards = [
    { label: 'Notes', value: notes.length, tone: 'bg-sage-100' },
    { label: 'Idées', value: ideas.length, tone: 'bg-sage-200/70' },
    { label: 'Projets', value: projects.length, tone: 'bg-sage-100' },
    { label: 'Fichiers', value: files.length, tone: 'bg-sage-200/70' },
    { label: 'Risques ouverts', value: openRisks.length, tone: 'bg-sage-100' },
    {
      label: firstBudget ? `Budget « ${firstBudget.name} »` : 'Budget consommé',
      value: firstBudget ? `${firstPct} %` : '—',
      tone: 'bg-sage-200/70',
    },
  ]

  return (
    <div className="space-y-6 animate-fade-up">
      <section className="rounded-3xl border border-sage-200 bg-gradient-to-br from-sage-700 to-sage-900 p-5 text-sage-50 md:p-8">
        <p className="font-display text-3xl md:text-4xl">Vue d’ensemble</p>
        <p className="mt-2 max-w-2xl text-sage-200">
          Indicateurs synchronisés depuis la base — aucune donnée fictive. Créez vos premiers
          contenus via les raccourcis.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          {[
            ['notes', 'Nouvelle note'],
            ['ideas', 'Nouvelle idée'],
            ['projects', 'Nouveau projet'],
            ['files', 'Fichiers'],
            ['canvas', 'Espace visuel'],
            ['budget', 'Budget'],
            ['risks', 'Risques'],
            ['calendar', 'Nouvel événement'],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => onQuick(id)}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-cream-green px-3 py-2 text-sm font-semibold text-sage-900 hover:bg-white"
            >
              <Plus size={16} /> {label}
            </button>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <div key={c.label} className={`rounded-2xl ${c.tone} border border-sage-200 p-5`}>
            <p className="text-sm text-sage-600">{c.label}</p>
            <p className="mt-1 font-display text-3xl text-sage-900">{c.value}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-sage-200 bg-white/70 p-5">
          <h2 className="font-display text-lg text-sage-900">Projets par statut</h2>
          <ul className="mt-4 space-y-2">
            {byStatus.map((row) => (
              <li key={row.status} className="flex items-center justify-between text-sm">
                <span className="text-sage-700">{row.status}</span>
                <span className="rounded-full bg-sage-100 px-2.5 py-0.5 font-semibold text-sage-800">
                  {row.count}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border border-sage-200 bg-white/70 p-5">
          <h2 className="font-display text-lg text-sage-900">Événements à venir</h2>
          {upcoming.length === 0 ? (
            <p className="mt-4 text-sm text-sage-500">Aucun événement planifié.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {upcoming.map((e) => (
                <li key={e.id} className="border-b border-sage-100 pb-2 text-sm last:border-0">
                  <p className="font-medium text-sage-900">{e.title}</p>
                  <p className="text-sage-500">
                    {e.date} {e.time}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-sage-200 bg-white/70 p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-lg text-sage-900">Risques en retard</h2>
            <button type="button" className={btnGhost + ' !py-1 text-xs'} onClick={() => onQuick('risks')}>
              Voir
            </button>
          </div>
          {overdueRisks.length === 0 ? (
            <p className="mt-4 text-sm text-sage-500">Aucun risque en retard.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {overdueRisks.slice(0, 5).map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="min-w-0 truncate font-medium text-sage-900">{r.title}</span>
                  <span className="shrink-0 text-xs font-semibold text-danger">{r.dueDate}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-2xl border border-sage-200 bg-white/70 p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-lg text-sage-900">Reste budgétaire</h2>
            <button type="button" className={btnGhost + ' !py-1 text-xs'} onClick={() => onQuick('budget')}>
              Voir
            </button>
          </div>
          {firstBudget ? (
            <div className="mt-4">
              <p className="font-display text-2xl text-sage-900">
                {formatMoney(firstRemaining, firstBudget.currency)}
              </p>
              <p className="mt-1 text-sm text-sage-600">
                {firstBudget.name} · {firstPct} % consommé (payé)
              </p>
            </div>
          ) : (
            <p className="mt-4 text-sm text-sage-500">Aucun budget pour le moment.</p>
          )}
        </div>
      </section>
    </div>
  )
}

function formatMoney(amount, currency = 'EUR') {
  try {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: currency === 'USD' ? 'USD' : 'EUR',
    }).format(Number(amount) || 0)
  } catch {
    return `${Number(amount) || 0} ${currency || 'EUR'}`
  }
}

function budgetSummary(budget, lines) {
  const mine = lines.filter((l) => l.budgetId === budget?.id)
  const estimated = mine
    .filter((l) => l.kind === 'planned')
    .reduce((s, l) => s + Number(l.amount || 0), 0)
  const actuals = mine.filter((l) => l.kind === 'actual' && l.status !== 'cancelled')
  const actual = actuals.reduce((s, l) => s + Number(l.amount || 0), 0)
  const paid = mine
    .filter((l) => l.kind === 'actual' && l.status === 'paid')
    .reduce((s, l) => s + Number(l.amount || 0), 0)
  const plannedTotal = Number(budget?.plannedTotal || 0)
  const remaining = plannedTotal - paid
  const variance = estimated - actual
  const usedPct = plannedTotal > 0 ? (paid / plannedTotal) * 100 : 0
  return { estimated, actual, paid, plannedTotal, remaining, variance, usedPct }
}

function LocalBanner() {
  if (getBackendMode() !== 'local') return null
  return (
    <div className="rounded-xl border border-warn/30 bg-warn/10 px-4 py-3 text-sm text-sage-800">
      Mode local — données non synchronisées entre appareils
    </div>
  )
}

function PriorityBadge({ value }) {
  const tone =
    value === 'élevée'
      ? 'bg-danger/15 text-danger'
      : value === 'moyenne'
        ? 'bg-warn/15 text-warn'
        : 'bg-ok/15 text-ok'
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${tone}`}>
      {value || 'faible'}
    </span>
  )
}

function dueTone(dateStr, done) {
  if (done || !dateStr) return 'border-sage-200 bg-white/80'
  if (isDateOverdue(dateStr)) return 'border-danger/40 bg-danger/10'
  if (isDateNearDue(dateStr)) return 'border-warn/40 bg-warn/10'
  return 'border-sage-200 bg-white/80'
}

function BudgetView({ user, budgets, lines, projects, projectsById, users, flash, onImport, onFocusBudget }) {
  const [selectedId, setSelectedId] = useState(budgets[0]?.id || '')
  const [tab, setTab] = useState('planned')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [lineOpen, setLineOpen] = useState(false)
  const [lineEditing, setLineEditing] = useState(null)
  const [commentLine, setCommentLine] = useState(null)
  const [commentBody, setCommentBody] = useState('')
  const [confirm, setConfirm] = useState(null)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState(emptyBudget())
  const [lineForm, setLineForm] = useState(emptyLine('planned'))

  function emptyBudget() {
    return {
      name: '',
      projectId: projects[0]?.id || '',
      currency: 'EUR',
      plannedTotal: '',
      periodStart: '',
      periodEnd: '',
      launchDate: '',
      visibility: 'Privée',
      shares: [],
    }
  }

  function emptyLine(kind) {
    return {
      kind,
      category: BUDGET_CATEGORIES[0],
      name: '',
      amount: '',
      date: new Date().toISOString().slice(0, 10),
      status: 'planned',
      duePeriod: '',
      roleTitle: '',
      responsibleId: '',
      notes: '',
      receiptNote: '',
    }
  }

  const selected = budgets.find((b) => b.id === selectedId) || budgets[0] || null
  useEffect(() => {
    onFocusBudget?.(selected?.id || '')
  }, [selected?.id, onFocusBudget])
  const canManage = selected ? canManageBudgetRisk(user, selected, projectsById) : canWriteRole(user)
  const canRemove = selected ? canDeleteBudgetRisk(user, selected, projectsById) : false
  const summary = selected ? budgetSummary(selected, lines) : null
  const tabLines = selected
    ? lines
        .filter((l) => l.budgetId === selected.id && l.kind === tab)
        .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
    : []

  const nameOf = (id) => users.find((u) => u.id === id)?.fullName || '—'
  const projectTitle = (id) => projects.find((p) => p.id === id)?.title || '—'

  const openCreate = () => {
    setEditing(null)
    setForm(emptyBudget())
    setOpen(true)
  }

  const openEdit = () => {
    if (!selected) return
    setEditing(selected)
    setForm({
      name: selected.name || '',
      projectId: selected.projectId || '',
      currency: selected.currency || 'EUR',
      plannedTotal: selected.plannedTotal ?? '',
      periodStart: selected.periodStart || '',
      periodEnd: selected.periodEnd || '',
      launchDate: selected.launchDate || '',
      visibility: selected.visibility || 'Privée',
      shares: selected.shares || [],
    })
    setOpen(true)
  }

  const submitBudget = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      const saved = await saveBudget(
        {
          id: editing?.id,
          ...form,
          name: form.name.trim(),
          plannedTotal: Number(form.plannedTotal) || 0,
          shares: form.visibility === 'Privée' ? [] : form.shares,
        },
        user,
      )
      setSelectedId(saved.id)
      flash(editing ? 'Budget mis à jour.' : 'Budget créé.')
      setOpen(false)
    } catch (err) {
      flash(err.message || 'Erreur', 'err')
    } finally {
      setBusy(false)
    }
  }

  const openLine = (line) => {
    setLineEditing(line || null)
    setLineForm(line
      ? {
          kind: line.kind,
          category: line.category,
          name: line.name || '',
          amount: line.amount ?? '',
          date: line.date || '',
          status: line.status || 'planned',
          duePeriod: line.duePeriod || '',
          roleTitle: line.roleTitle || '',
          responsibleId: line.responsibleId || '',
          notes: line.notes || '',
          receiptNote: line.receiptNote || '',
        }
      : emptyLine(tab))
    setLineOpen(true)
  }

  const submitLine = async (e) => {
    e.preventDefault()
    if (!selected) return
    setBusy(true)
    try {
      await saveBudgetLine(
        {
          id: lineEditing?.id,
          budgetId: selected.id,
          ...lineForm,
          kind: lineEditing?.kind || tab,
          amount: Number(lineForm.amount) || 0,
        },
        user,
      )
      flash(lineEditing ? 'Ligne mise à jour.' : 'Ligne ajoutée.')
      setLineOpen(false)
    } catch (err) {
      flash(err.message || 'Erreur', 'err')
    } finally {
      setBusy(false)
    }
  }

  const submitComment = async (e) => {
    e.preventDefault()
    if (!commentLine) return
    setBusy(true)
    try {
      await addBudgetLineComment(commentLine.id, commentBody, user)
      setCommentBody('')
      flash('Commentaire ajouté.')
      const updated = lines.find((l) => l.id === commentLine.id)
      if (updated) setCommentLine({ ...updated, comments: [...(updated.comments || [])] })
    } catch (err) {
      flash(err.message || 'Erreur', 'err')
    } finally {
      setBusy(false)
    }
  }

  const runConfirm = async () => {
    if (!confirm) return
    setBusy(true)
    try {
      if (confirm.type === 'budget') {
        await deleteBudget(confirm.id, user)
        flash('Budget supprimé.')
        setSelectedId('')
      } else {
        await deleteBudgetLine(confirm.id, user)
        flash('Ligne supprimée.')
      }
      setConfirm(null)
    } catch (err) {
      flash(err.message || 'Erreur', 'err')
    } finally {
      setBusy(false)
    }
  }

  const liveCommentLine = commentLine ? lines.find((l) => l.id === commentLine.id) || commentLine : null

  const cards = selected
    ? [
        { label: 'Total prévu', value: formatMoney(summary.plannedTotal, selected.currency) },
        { label: 'Somme prévisionnelle', value: formatMoney(summary.estimated, selected.currency) },
        { label: 'Somme réelle', value: formatMoney(summary.actual, selected.currency) },
        { label: 'Payé', value: formatMoney(summary.paid, selected.currency) },
        { label: 'Restant', value: formatMoney(summary.remaining, selected.currency) },
        { label: 'Écart prévision / réel', value: formatMoney(summary.variance, selected.currency) },
        { label: '% consommé', value: `${Math.round(summary.usedPct)} %` },
      ]
    : []

  if (projects.length === 0) {
    return (
      <div className="space-y-4 animate-fade-up">
        <LocalBanner />
        <EmptyState
          title="Aucun projet"
          hint="Rattachez un budget à un projet. Créez d’abord un projet dans l’onglet Projets."
        />
      </div>
    )
  }

  const denied = !canWriteRole(user) && budgets.length === 0

  return (
    <div className="space-y-4 animate-fade-up">
      <LocalBanner />
      <div className="flex flex-wrap items-center gap-2">
        {budgets.length > 0 && (
          <select
            className={inputClass + ' max-w-full md:!w-auto'}
            value={selected?.id || ''}
            onChange={(e) => setSelectedId(e.target.value)}
          >
            {budgets.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        )}
        {canWriteRole(user) && (
          <>
            <button type="button" className={btnPrimary} onClick={openCreate}>
              <Plus size={16} /> Nouveau budget
            </button>
            <button type="button" className={btnGhost} onClick={onImport}>
              <Upload size={16} /> Importer
            </button>
          </>
        )}
        {selected && canManage && (
          <button type="button" className={btnGhost} onClick={openEdit}>
            <Pencil size={14} /> Modifier
          </button>
        )}
        {selected && canRemove && (
          <button
            type="button"
            className={btnGhost + ' !text-danger'}
            onClick={() => setConfirm({ type: 'budget', id: selected.id })}
          >
            <Trash2 size={14} /> Supprimer
          </button>
        )}
      </div>

      {denied ? (
        <EmptyState title="Accès refusé" hint="Aucun budget n’a été partagé avec vous." />
      ) : !selected ? (
        <EmptyState
          title="Aucun budget"
          hint="Créez un budget rattaché à un projet, en EUR ou USD."
          action={
            canWriteRole(user) ? (
              <button type="button" className={btnPrimary + ' mt-4'} onClick={openCreate}>
                <Plus size={16} /> Créer un budget
              </button>
            ) : null
          }
        />
      ) : (
        <>
          <p className="text-sm text-sage-600">
            {projectTitle(selected.projectId)} · {selected.currency} · {selected.visibility}
            {selected.periodStart ? ` · ${selected.periodStart}` : ''}
            {selected.periodEnd ? ` → ${selected.periodEnd}` : ''}
          </p>
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {cards.map((c) => (
              <div key={c.label} className="rounded-2xl border border-sage-200 bg-white/80 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-sage-500">{c.label}</p>
                <p className="mt-1 font-display text-2xl text-sage-900">{c.value}</p>
              </div>
            ))}
          </section>

          <div className="flex flex-wrap gap-2">
            {BUDGET_TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`min-h-11 rounded-xl px-4 py-2 text-sm font-semibold ${
                  tab === t.id ? 'bg-sage-700 text-white' : 'bg-white/80 text-sage-800 border border-sage-200'
                }`}
              >
                {t.label}
              </button>
            ))}
            {canManage && (
              <button type="button" className={btnPrimary} onClick={() => openLine(null)}>
                <Plus size={16} /> Ajouter une ligne
              </button>
            )}
          </div>

          {tabLines.length === 0 ? (
            <EmptyState
              title="Aucune ligne"
              hint={
                tab === 'salary'
                  ? 'Indiquez un intitulé de poste, jamais un identifiant personnel.'
                  : 'Ajoutez une ligne pour alimenter les totaux.'
              }
            />
          ) : (
            <>
              <div className="hidden overflow-x-auto rounded-2xl border border-sage-200 bg-white/80 md:block">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-sage-100 text-sage-700">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Libellé</th>
                      <th className="px-4 py-3 font-semibold">Catégorie</th>
                      <th className="px-4 py-3 font-semibold">Montant</th>
                      <th className="px-4 py-3 font-semibold">{tab === 'salary' ? 'Période' : 'Date'}</th>
                      <th className="px-4 py-3 font-semibold">{tab === 'actual' ? 'Statut' : 'Responsable'}</th>
                      <th className="px-4 py-3 font-semibold" />
                    </tr>
                  </thead>
                  <tbody>
                    {tabLines.map((l) => (
                      <tr key={l.id} className="border-t border-sage-100">
                        <td className="px-4 py-3 font-medium text-sage-900">
                          {l.name}
                          {l.roleTitle ? <span className="block text-xs text-sage-500">{l.roleTitle}</span> : null}
                        </td>
                        <td className="px-4 py-3 text-sage-700">{l.category}</td>
                        <td className="px-4 py-3">{formatMoney(l.amount, selected.currency)}</td>
                        <td className="px-4 py-3 text-sage-600">{tab === 'salary' ? l.duePeriod || '—' : l.date || '—'}</td>
                        <td className="px-4 py-3 text-sage-600">
                          {tab === 'actual' ? l.status || '—' : nameOf(l.responsibleId)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1">
                            <button type="button" className={btnGhost + ' !px-2'} onClick={() => setCommentLine(l)}>
                              Commenter
                            </button>
                            {canManage && (
                              <>
                                <button type="button" className={btnGhost + ' !px-2'} onClick={() => openLine(l)}>
                                  <Pencil size={14} />
                                </button>
                                <button
                                  type="button"
                                  className={btnGhost + ' !px-2 !text-danger'}
                                  onClick={() => setConfirm({ type: 'line', id: l.id })}
                                >
                                  <Trash2 size={14} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="space-y-2 md:hidden">
                {tabLines.map((l) => (
                  <article key={l.id} className="rounded-2xl border border-sage-200 bg-white/80 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-medium text-sage-900">{l.name}</h3>
                        <p className="text-xs text-sage-500">
                          {l.category}
                          {l.roleTitle ? ` · ${l.roleTitle}` : ''}
                        </p>
                      </div>
                      <p className="font-display text-lg text-sage-900">
                        {formatMoney(l.amount, selected.currency)}
                      </p>
                    </div>
                    <p className="mt-2 text-sm text-sage-600">
                      {tab === 'salary' ? l.duePeriod || '—' : l.date || '—'}
                      {tab === 'actual' ? ` · ${l.status}` : ''}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button type="button" className={btnGhost} onClick={() => setCommentLine(l)}>
                        Commenter
                      </button>
                      {canManage && (
                        <>
                          <button type="button" className={btnGhost} onClick={() => openLine(l)}>
                            <Pencil size={14} /> Modifier
                          </button>
                          <button
                            type="button"
                            className={btnGhost + ' !text-danger'}
                            onClick={() => setConfirm({ type: 'line', id: l.id })}
                          >
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
        </>
      )}

      <Modal open={open} title={editing ? 'Modifier le budget' : 'Nouveau budget'} onClose={() => setOpen(false)} wide>
        <form onSubmit={submitBudget} className="space-y-1">
          <Field label="Nom">
            <input
              className={inputClass}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </Field>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label="Projet">
              <select
                className={inputClass}
                value={form.projectId}
                onChange={(e) => setForm({ ...form, projectId: e.target.value })}
                required
              >
                <option value="">Choisir…</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Devise">
              <select
                className={inputClass}
                value={form.currency}
                onChange={(e) => setForm({ ...form, currency: e.target.value })}
              >
                {BUDGET_CURRENCIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Total prévu">
            <input
              className={inputClass}
              type="number"
              min="0"
              step="0.01"
              value={form.plannedTotal}
              onChange={(e) => setForm({ ...form, plannedTotal: e.target.value })}
              required
            />
          </Field>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Field label="Début">
              <input
                className={inputClass}
                type="date"
                value={form.periodStart}
                onChange={(e) => setForm({ ...form, periodStart: e.target.value })}
              />
            </Field>
            <Field label="Fin">
              <input
                className={inputClass}
                type="date"
                value={form.periodEnd}
                onChange={(e) => setForm({ ...form, periodEnd: e.target.value })}
              />
            </Field>
            <Field label="Lancement">
              <input
                className={inputClass}
                type="date"
                value={form.launchDate}
                onChange={(e) => setForm({ ...form, launchDate: e.target.value })}
              />
            </Field>
          </div>
          <Field label="Visibilité">
            <select
              className={inputClass}
              value={form.visibility}
              onChange={(e) => setForm({ ...form, visibility: e.target.value })}
            >
              {SCOPED_VISIBILITIES.map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </Field>
          {form.visibility !== 'Privée' && (
            <ShareEditor
              users={users}
              shares={form.shares}
              excludeId={user.id}
              permissions={SHARE_PERMS}
              onChange={(shares) => setForm({ ...form, shares })}
            />
          )}
          <ModalActions>
            <button type="submit" className={btnPrimary + ' w-full sm:w-auto'} disabled={busy}>
              <Check size={16} /> Enregistrer
            </button>
          </ModalActions>
        </form>
      </Modal>

      <Modal
        open={lineOpen}
        title={lineEditing ? 'Modifier la ligne' : 'Nouvelle ligne'}
        onClose={() => setLineOpen(false)}
        wide
      >
        <form onSubmit={submitLine} className="space-y-1">
          <Field label="Libellé">
            <input
              className={inputClass}
              value={lineForm.name}
              onChange={(e) => setLineForm({ ...lineForm, name: e.target.value })}
              required
            />
          </Field>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label="Catégorie">
              <select
                className={inputClass}
                value={lineForm.category}
                onChange={(e) => setLineForm({ ...lineForm, category: e.target.value })}
              >
                {BUDGET_CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
            <Field label="Montant">
              <input
                className={inputClass}
                type="number"
                min="0"
                step="0.01"
                value={lineForm.amount}
                onChange={(e) => setLineForm({ ...lineForm, amount: e.target.value })}
                required
              />
            </Field>
          </div>
          {(lineEditing?.kind || tab) !== 'salary' && (
            <Field label="Date">
              <input
                className={inputClass}
                type="date"
                value={lineForm.date}
                onChange={(e) => setLineForm({ ...lineForm, date: e.target.value })}
              />
            </Field>
          )}
          {(lineEditing?.kind || tab) === 'actual' && (
            <>
              <Field label="Statut">
                <select
                  className={inputClass}
                  value={lineForm.status}
                  onChange={(e) => setLineForm({ ...lineForm, status: e.target.value })}
                >
                  {BUDGET_ACTUAL_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s === 'planned' ? 'prévu' : s === 'paid' ? 'payé' : 'annulé'}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Note de reçu">
                <input
                  className={inputClass}
                  value={lineForm.receiptNote}
                  onChange={(e) => setLineForm({ ...lineForm, receiptNote: e.target.value })}
                />
              </Field>
            </>
          )}
          {(lineEditing?.kind || tab) === 'salary' && (
            <>
              <Field label="Intitulé de poste (pas d’identifiant personnel)">
                <input
                  className={inputClass}
                  value={lineForm.roleTitle}
                  onChange={(e) => setLineForm({ ...lineForm, roleTitle: e.target.value })}
                  placeholder="Ex. Chargé de projet"
                />
              </Field>
              <Field label="Période due">
                <input
                  className={inputClass}
                  type="month"
                  value={lineForm.duePeriod}
                  onChange={(e) => setLineForm({ ...lineForm, duePeriod: e.target.value })}
                />
              </Field>
            </>
          )}
          <Field label="Responsable">
            <select
              className={inputClass}
              value={lineForm.responsibleId}
              onChange={(e) => setLineForm({ ...lineForm, responsibleId: e.target.value })}
            >
              <option value="">Aucun</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.fullName}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Notes">
            <textarea
              className={inputClass + ' min-h-20'}
              value={lineForm.notes}
              onChange={(e) => setLineForm({ ...lineForm, notes: e.target.value })}
            />
          </Field>
          <ModalActions>
            <button type="submit" className={btnPrimary + ' w-full sm:w-auto'} disabled={busy}>
              <Check size={16} /> Enregistrer
            </button>
          </ModalActions>
        </form>
      </Modal>

      <Modal
        open={Boolean(liveCommentLine)}
        title={liveCommentLine ? `Commentaires — ${liveCommentLine.name}` : 'Commentaires'}
        onClose={() => {
          setCommentLine(null)
          setCommentBody('')
        }}
      >
        {liveCommentLine && (
          <div className="space-y-3">
            {(liveCommentLine.comments || []).length === 0 ? (
              <p className="text-sm text-sage-500">Aucun commentaire.</p>
            ) : (
              <ul className="space-y-2">
                {(liveCommentLine.comments || []).map((c, idx) => (
                  <li key={`${c.at}-${idx}`} className="rounded-xl bg-white p-3 text-sm">
                    <p className="text-xs text-sage-500">
                      {nameOf(c.userId)} · {c.at?.slice(0, 16)?.replace('T', ' ')}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sage-800">{c.body}</p>
                  </li>
                ))}
              </ul>
            )}
            {canManage && (
              <form onSubmit={submitComment}>
                <textarea
                  className={inputClass + ' min-h-20'}
                  value={commentBody}
                  onChange={(e) => setCommentBody(e.target.value)}
                  placeholder="Ajouter un commentaire"
                />
                <ModalActions>
                  <button type="submit" className={btnPrimary + ' w-full sm:w-auto'} disabled={busy}>
                    Envoyer
                  </button>
                </ModalActions>
              </form>
            )}
          </div>
        )}
      </Modal>

      <Modal open={Boolean(confirm)} title="Confirmer la suppression" onClose={() => setConfirm(null)}>
        <p className="text-sm text-sage-700">
          {confirm?.type === 'budget'
            ? 'Le budget et toutes ses lignes seront supprimés.'
            : 'Cette ligne sera définitivement supprimée.'}
        </p>
        <ModalActions>
          <button type="button" className={btnGhost + ' w-full sm:w-auto'} onClick={() => setConfirm(null)}>
            Annuler
          </button>
          <button
            type="button"
            className={btnPrimary + ' w-full sm:w-auto !bg-danger'}
            disabled={busy}
            onClick={runConfirm}
          >
            Supprimer
          </button>
        </ModalActions>
      </Modal>
    </div>
  )
}

function RisksView({ user, risks, actions, projects, projectsById, users, flash, onImport }) {
  const [filterProject, setFilterProject] = useState('')
  const [filterAssignee, setFilterAssignee] = useState('')
  const [filterPriority, setFilterPriority] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [detailId, setDetailId] = useState(null)
  const [actionOpen, setActionOpen] = useState(false)
  const [actionEditing, setActionEditing] = useState(null)
  const [commentBody, setCommentBody] = useState('')
  const [confirm, setConfirm] = useState(null)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState(emptyRisk())
  const [actionForm, setActionForm] = useState(emptyAction())

  function emptyRisk() {
    return {
      title: '',
      description: '',
      projectId: projects[0]?.id || '',
      category: 'budget',
      probability: 'faible',
      impact: 'faible',
      assigneeId: '',
      detectedAt: new Date().toISOString().slice(0, 10),
      dueDate: '',
      status: 'nouveau',
      visibility: 'Privée',
      shares: [],
    }
  }

  function emptyAction() {
    return { title: '', assigneeId: '', dueDate: '', status: 'à faire' }
  }

  const nameOf = (id) => users.find((u) => u.id === id)?.fullName || '—'
  const projectTitle = (id) => projects.find((p) => p.id === id)?.title || '—'

  const filtered = risks.filter((r) => {
    if (filterProject && r.projectId !== filterProject) return false
    if (filterAssignee && r.assigneeId !== filterAssignee) return false
    if (filterPriority && (r.priority || computeRiskPriority(r.probability, r.impact)) !== filterPriority) {
      return false
    }
    if (filterStatus && r.status !== filterStatus) return false
    return true
  })

  const detail = risks.find((r) => r.id === detailId) || null
  const detailActions = detail
    ? actions
        .filter((a) => a.riskId === detail.id)
        .sort((a, b) => String(a.dueDate || '').localeCompare(String(b.dueDate || '')))
    : []
  const canManage = detail
    ? canManageBudgetRisk(user, detail, projectsById)
    : canWriteRole(user)

  const openCreate = () => {
    setEditing(null)
    setForm(emptyRisk())
    setOpen(true)
  }

  const openEdit = (risk) => {
    setEditing(risk)
    setForm({
      title: risk.title || '',
      description: risk.description || '',
      projectId: risk.projectId || '',
      category: risk.category || 'autre',
      probability: risk.probability || 'faible',
      impact: risk.impact || 'faible',
      assigneeId: risk.assigneeId || '',
      detectedAt: risk.detectedAt || '',
      dueDate: risk.dueDate || '',
      status: risk.status || 'nouveau',
      visibility: risk.visibility || 'Privée',
      shares: risk.shares || [],
    })
    setOpen(true)
  }

  const submitRisk = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      const saved = await saveRisk(
        {
          id: editing?.id,
          ...form,
          title: form.title.trim(),
          shares: form.visibility === 'Privée' ? [] : form.shares,
        },
        user,
      )
      setDetailId(saved.id)
      flash(editing ? 'Risque mis à jour.' : 'Risque créé.')
      setOpen(false)
    } catch (err) {
      flash(err.message || 'Erreur', 'err')
    } finally {
      setBusy(false)
    }
  }

  const openAction = (action) => {
    setActionEditing(action || null)
    setActionForm(
      action
        ? {
            title: action.title || '',
            assigneeId: action.assigneeId || '',
            dueDate: action.dueDate || '',
            status: action.status || 'à faire',
          }
        : emptyAction(),
    )
    setActionOpen(true)
  }

  const submitAction = async (e) => {
    e.preventDefault()
    if (!detail) return
    setBusy(true)
    try {
      await saveRiskAction(
        {
          id: actionEditing?.id,
          riskId: detail.id,
          ...actionForm,
          title: actionForm.title.trim(),
        },
        user,
      )
      flash(actionEditing ? 'Action mise à jour.' : 'Action ajoutée.')
      setActionOpen(false)
    } catch (err) {
      flash(err.message || 'Erreur', 'err')
    } finally {
      setBusy(false)
    }
  }

  const submitComment = async (e) => {
    e.preventDefault()
    if (!detail) return
    setBusy(true)
    try {
      await addRiskComment(detail.id, commentBody, user)
      setCommentBody('')
      flash('Commentaire ajouté.')
    } catch (err) {
      flash(err.message || 'Erreur', 'err')
    } finally {
      setBusy(false)
    }
  }

  const runConfirm = async () => {
    if (!confirm) return
    setBusy(true)
    try {
      if (confirm.type === 'risk') {
        await deleteRisk(confirm.id, user)
        if (detailId === confirm.id) setDetailId(null)
        flash('Risque supprimé.')
      } else {
        await deleteRiskAction(confirm.id, user)
        flash('Action supprimée.')
      }
      setConfirm(null)
    } catch (err) {
      flash(err.message || 'Erreur', 'err')
    } finally {
      setBusy(false)
    }
  }

  if (projects.length === 0) {
    return (
      <div className="space-y-4 animate-fade-up">
        <LocalBanner />
        <EmptyState
          title="Aucun projet"
          hint="Les risques sont rattachés à un projet. Créez d’abord un projet."
        />
      </div>
    )
  }

  const denied = !canWriteRole(user) && risks.length === 0

  return (
    <div className="space-y-4 animate-fade-up">
      <LocalBanner />
      <div className="flex flex-wrap items-center gap-2">
        {canWriteRole(user) && (
          <>
            <button type="button" className={btnPrimary} onClick={openCreate}>
              <Plus size={16} /> Nouveau risque
            </button>
            <button type="button" className={btnGhost} onClick={onImport}>
              <Upload size={16} /> Importer
            </button>
          </>
        )}
        <select
          className={inputClass + ' max-w-full md:!w-auto'}
          value={filterProject}
          onChange={(e) => setFilterProject(e.target.value)}
        >
          <option value="">Projet</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>
        <select
          className={inputClass + ' max-w-full md:!w-auto'}
          value={filterAssignee}
          onChange={(e) => setFilterAssignee(e.target.value)}
        >
          <option value="">Assigné</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.fullName}
            </option>
          ))}
        </select>
        <select
          className={inputClass + ' max-w-full md:!w-auto'}
          value={filterPriority}
          onChange={(e) => setFilterPriority(e.target.value)}
        >
          <option value="">Priorité</option>
          {['élevée', 'moyenne', 'faible'].map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
        <select
          className={inputClass + ' max-w-full md:!w-auto'}
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option value="">Statut</option>
          {RISK_STATUSES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </div>

      {denied ? (
        <EmptyState title="Accès refusé" hint="Aucun risque n’a été partagé avec vous." />
      ) : filtered.length === 0 && !detail ? (
        <EmptyState
          title="Aucun risque"
          hint="Enregistrez un risque, sa priorité est calculée (probabilité × impact)."
          action={
            canWriteRole(user) ? (
              <button type="button" className={btnPrimary + ' mt-4'} onClick={openCreate}>
                <Plus size={16} /> Créer un risque
              </button>
            ) : null
          }
        />
      ) : (
        <div className={`grid gap-4 ${detail ? 'lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]' : ''}`}>
          <ul className="space-y-2">
            {filtered.map((r) => {
              const priority = r.priority || computeRiskPriority(r.probability, r.impact)
              const done = r.status === 'résolu' || r.status === 'écarté'
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => setDetailId(r.id)}
                    className={`w-full rounded-2xl border p-4 text-left ${dueTone(r.dueDate, done)} ${
                      detailId === r.id ? 'ring-2 ring-sage-500' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="truncate font-display text-lg text-sage-900">{r.title}</h3>
                        <p className="text-xs text-sage-500">
                          {projectTitle(r.projectId)} · {r.category} · {r.status}
                        </p>
                      </div>
                      <PriorityBadge value={priority} />
                    </div>
                    {r.dueDate && (
                      <p className="mt-2 flex items-center gap-1 text-xs text-sage-600">
                        {isDateOverdue(r.dueDate) && !done ? (
                          <AlertTriangle size={12} className="text-danger" />
                        ) : null}
                        Échéance {r.dueDate}
                      </p>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>

          {detail && (
            <article className="rounded-2xl border border-sage-200 bg-white/80 p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="font-display text-2xl text-sage-900">{detail.title}</h2>
                  <p className="mt-1 text-sm text-sage-600">
                    {projectTitle(detail.projectId)} · Assigné : {nameOf(detail.assigneeId)}
                  </p>
                </div>
                <PriorityBadge value={detail.priority || computeRiskPriority(detail.probability, detail.impact)} />
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm text-sage-700">{detail.description || '—'}</p>
              <p className="mt-2 text-xs text-sage-500">
                {detail.probability} × {detail.impact} · détecté {detail.detectedAt || '—'} · statut {detail.status}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {canManageBudgetRisk(user, detail, projectsById) && (
                  <button type="button" className={btnGhost} onClick={() => openEdit(detail)}>
                    <Pencil size={14} /> Modifier
                  </button>
                )}
                {canDeleteBudgetRisk(user, detail, projectsById) && (
                  <button
                    type="button"
                    className={btnGhost + ' !text-danger'}
                    onClick={() => setConfirm({ type: 'risk', id: detail.id })}
                  >
                    <Trash2 size={14} /> Supprimer
                  </button>
                )}
                <button type="button" className={btnGhost + ' lg:hidden'} onClick={() => setDetailId(null)}>
                  Fermer
                </button>
              </div>

              <div className="mt-5 flex items-center justify-between gap-2">
                <h3 className="font-display text-lg text-sage-900">Solutions / actions</h3>
                {canManage && (
                  <button type="button" className={btnPrimary} onClick={() => openAction(null)}>
                    <Plus size={14} /> Action
                  </button>
                )}
              </div>
              {detailActions.length === 0 ? (
                <p className="mt-2 text-sm text-sage-500">Aucune action pour le moment.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {detailActions.map((a) => (
                    <li
                      key={a.id}
                      className={`rounded-xl border p-3 text-sm ${dueTone(a.dueDate, a.status === 'terminée')}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium text-sage-900">{a.title}</p>
                          <p className="text-xs text-sage-500">
                            {a.status} · {nameOf(a.assigneeId)}
                            {a.dueDate ? ` · ${a.dueDate}` : ''}
                            {isDateOverdue(a.dueDate) && a.status !== 'terminée' ? ' · en retard' : ''}
                            {isDateNearDue(a.dueDate) ? ' · échéance proche' : ''}
                          </p>
                        </div>
                        {canManage && (
                          <div className="flex gap-1">
                            <button type="button" className={btnGhost + ' !px-2'} onClick={() => openAction(a)}>
                              <Pencil size={14} />
                            </button>
                            <button
                              type="button"
                              className={btnGhost + ' !px-2 !text-danger'}
                              onClick={() => setConfirm({ type: 'action', id: a.id })}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              <h3 className="mt-5 font-display text-lg text-sage-900">Commentaires</h3>
              {(detail.comments || []).length === 0 ? (
                <p className="mt-2 text-sm text-sage-500">Aucun commentaire.</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {(detail.comments || []).map((c, idx) => (
                    <li key={`${c.at}-${idx}`} className="rounded-xl bg-sage-50 p-3 text-sm">
                      <p className="text-xs text-sage-500">
                        {nameOf(c.userId)} · {c.at?.slice(0, 16)?.replace('T', ' ')}
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-sage-800">{c.body}</p>
                    </li>
                  ))}
                </ul>
              )}
              {canManage && (
                <form onSubmit={submitComment} className="mt-3">
                  <textarea
                    className={inputClass + ' min-h-20'}
                    value={commentBody}
                    onChange={(e) => setCommentBody(e.target.value)}
                    placeholder="Ajouter un commentaire"
                  />
                  <button type="submit" className={btnPrimary + ' mt-2'} disabled={busy}>
                    Envoyer
                  </button>
                </form>
              )}
            </article>
          )}
        </div>
      )}

      <Modal open={open} title={editing ? 'Modifier le risque' : 'Nouveau risque'} onClose={() => setOpen(false)} wide>
        <form onSubmit={submitRisk} className="space-y-1">
          <Field label="Titre">
            <input
              className={inputClass}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
            />
          </Field>
          <Field label="Description">
            <textarea
              className={inputClass + ' min-h-24'}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label="Projet">
              <select
                className={inputClass}
                value={form.projectId}
                onChange={(e) => setForm({ ...form, projectId: e.target.value })}
                required
              >
                <option value="">Choisir…</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Catégorie">
              <select
                className={inputClass}
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                {RISK_CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Field label="Probabilité">
              <select
                className={inputClass}
                value={form.probability}
                onChange={(e) => setForm({ ...form, probability: e.target.value })}
              >
                {RISK_PROBABILITIES.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </Field>
            <Field label="Impact">
              <select
                className={inputClass}
                value={form.impact}
                onChange={(e) => setForm({ ...form, impact: e.target.value })}
              >
                {RISK_IMPACTS.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </Field>
            <Field label="Priorité calculée">
              <div className="flex min-h-11 items-center">
                <PriorityBadge value={computeRiskPriority(form.probability, form.impact)} />
              </div>
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label="Assigné">
              <select
                className={inputClass}
                value={form.assigneeId}
                onChange={(e) => setForm({ ...form, assigneeId: e.target.value })}
              >
                <option value="">Aucun</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.fullName}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Statut">
              <select
                className={inputClass}
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                {RISK_STATUSES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label="Détecté le">
              <input
                className={inputClass}
                type="date"
                value={form.detectedAt}
                onChange={(e) => setForm({ ...form, detectedAt: e.target.value })}
              />
            </Field>
            <Field label="Échéance">
              <input
                className={inputClass}
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
              />
            </Field>
          </div>
          <Field label="Visibilité">
            <select
              className={inputClass}
              value={form.visibility}
              onChange={(e) => setForm({ ...form, visibility: e.target.value })}
            >
              {SCOPED_VISIBILITIES.map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </Field>
          {form.visibility !== 'Privée' && (
            <ShareEditor
              users={users}
              shares={form.shares}
              excludeId={user.id}
              permissions={SHARE_PERMS}
              onChange={(shares) => setForm({ ...form, shares })}
            />
          )}
          <ModalActions>
            <button type="submit" className={btnPrimary + ' w-full sm:w-auto'} disabled={busy}>
              <Check size={16} /> Enregistrer
            </button>
          </ModalActions>
        </form>
      </Modal>

      <Modal
        open={actionOpen}
        title={actionEditing ? 'Modifier l’action' : 'Nouvelle action'}
        onClose={() => setActionOpen(false)}
      >
        <form onSubmit={submitAction} className="space-y-1">
          <Field label="Titre">
            <input
              className={inputClass}
              value={actionForm.title}
              onChange={(e) => setActionForm({ ...actionForm, title: e.target.value })}
              required
            />
          </Field>
          <Field label="Assigné">
            <select
              className={inputClass}
              value={actionForm.assigneeId}
              onChange={(e) => setActionForm({ ...actionForm, assigneeId: e.target.value })}
            >
              <option value="">Aucun</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.fullName}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Échéance">
            <input
              className={inputClass}
              type="date"
              value={actionForm.dueDate}
              onChange={(e) => setActionForm({ ...actionForm, dueDate: e.target.value })}
            />
          </Field>
          <Field label="Statut">
            <select
              className={inputClass}
              value={actionForm.status}
              onChange={(e) => setActionForm({ ...actionForm, status: e.target.value })}
            >
              {RISK_ACTION_STATUSES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
          <ModalActions>
            <button type="submit" className={btnPrimary + ' w-full sm:w-auto'} disabled={busy}>
              <Check size={16} /> Enregistrer
            </button>
          </ModalActions>
        </form>
      </Modal>

      <Modal open={Boolean(confirm)} title="Confirmer la suppression" onClose={() => setConfirm(null)}>
        <p className="text-sm text-sage-700">
          {confirm?.type === 'risk'
            ? 'Le risque et ses actions seront supprimés.'
            : 'Cette action sera définitivement supprimée.'}
        </p>
        <ModalActions>
          <button type="button" className={btnGhost + ' w-full sm:w-auto'} onClick={() => setConfirm(null)}>
            Annuler
          </button>
          <button
            type="button"
            className={btnPrimary + ' w-full sm:w-auto !bg-danger'}
            disabled={busy}
            onClick={runConfirm}
          >
            Supprimer
          </button>
        </ModalActions>
      </Modal>
    </div>
  )
}

function NotesView({
  user,
  notes,
  users,
  projects,
  files = [],
  ideas = [],
  risks = [],
  budgetLines = [],
  links = [],
  flash,
  onImport,
  selectedNoteIds = [],
  onToggleNote,
}) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [confirmId, setConfirmId] = useState(null)
  const [filterCat, setFilterCat] = useState('Tous')
  const [form, setForm] = useState(emptyNote())

  function emptyNote() {
    return {
      title: '',
      content: '',
      category: 'Général',
      tags: '',
      visibility: 'Privée',
      shares: [],
      projectId: '',
      parentId: '',
      linkFileIds: [],
      linkRiskIds: [],
      linkExpenseIds: [],
      linkIdeaIds: [],
    }
  }

  const notesById = useMemo(() => Object.fromEntries(notes.map((n) => [n.id, n])), [notes])
  const filtered =
    filterCat === 'Tous' ? notes : notes.filter((n) => n.category === filterCat)
  const treeNotes = useMemo(() => {
    if (filterCat !== 'Tous') return filtered
    const roots = noteChildList(notes, null)
    const ids = new Set(notes.map((n) => n.id))
    const orphans = notes.filter((n) => n.parentId && !ids.has(n.parentId))
    const seen = new Set(roots.map((n) => n.id))
    return [...roots, ...orphans.filter((n) => !seen.has(n.id))]
  }, [filterCat, filtered, notes])

  const noteLinksOf = (noteId) => relatedLinkEnds(links, 'note', noteId)

  const openCreate = () => {
    setEditing(null)
    setForm(emptyNote())
    setOpen(true)
  }

  const openEdit = (n) => {
    setEditing(n)
    const related = noteLinksOf(n.id)
    setForm({
      title: n.title || '',
      content: n.content || '',
      category: n.category || 'Général',
      tags: (n.tags || []).join(', '),
      visibility: n.visibility || 'Privée',
      shares: n.shares || [],
      projectId: n.projectId || '',
      parentId: n.parentId || '',
      linkFileIds: related.filter((r) => r.type === 'file').map((r) => r.id),
      linkRiskIds: related.filter((r) => r.type === 'risk').map((r) => r.id),
      linkExpenseIds: related.filter((r) => r.type === 'budget_line').map((r) => r.id),
      linkIdeaIds: related.filter((r) => r.type === 'idea').map((r) => r.id),
    })
    setOpen(true)
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!editing && !canWriteRole(user)) {
      flash('Permission refusée.', 'err')
      return
    }
    if (!canEditEntity(user, editing || { ownerId: user.id, shares: [] }) && editing) {
      flash('Permission refusée.', 'err')
      return
    }
    try {
      const payload = {
        id: editing?.id,
        title: form.title.trim(),
        content: form.content.trim(),
        category: form.category,
        tags: form.tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        visibility: form.visibility,
        shares: form.visibility === 'Privée' ? [] : form.shares,
        projectId: form.projectId || null,
        parentId: form.parentId || null,
      }
      const saved = await saveNote(payload, user)
      const targets = [
        ...form.linkFileIds.map((id) => ({ type: 'file', id })),
        ...form.linkRiskIds.map((id) => ({ type: 'risk', id })),
        ...form.linkExpenseIds.map((id) => ({ type: 'budget_line', id })),
        ...form.linkIdeaIds.map((id) => ({ type: 'idea', id })),
      ]
      if (canWriteRole(user)) {
        await syncNoteLinks(saved.id, targets, user)
      }
      const shareIds = (saved.shares || []).map((s) => s.userId)
      if (shareIds.length) {
        await notifyUsers(shareIds, {
          type: 'note_share',
          title: 'Note partagée',
          body: `${user.fullName} a partagé la note « ${saved.title} » avec vous.`,
          meta: { noteId: saved.id },
        })
      }
      flash(editing ? 'Note mise à jour.' : 'Note créée.')
      setOpen(false)
    } catch (err) {
      flash(err.message, 'err')
    }
  }

  const remove = async (id) => {
    const n = notes.find((x) => x.id === id)
    if (!canDeleteEntity(user, n)) {
      flash('Permission refusée.', 'err')
      return
    }
    await deleteNote(id, user)
    setConfirmId(null)
    flash('Note supprimée.')
  }

  const renderNoteCard = (n, depth = 0) => {
    const children = filterCat === 'Tous' ? noteChildList(notes, n.id) : []
    const related = noteLinksOf(n.id)
    return (
      <div key={n.id} className={depth ? 'mt-2 border-l border-sage-200 pl-3' : ''}>
        <article className={`rounded-2xl border p-4 transition hover:border-sage-400 ${selectedNoteIds.includes(n.id) ? 'border-sage-500 bg-sage-100/80' : 'border-sage-200 bg-white/80'}`}>
          <div className="flex items-start justify-between gap-2">
            <div>
              {onToggleNote && (
                <label className="mb-1 flex items-center gap-1.5 text-[11px] text-sage-600">
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 accent-sage-700"
                    checked={selectedNoteIds.includes(n.id)}
                    onChange={() => onToggleNote(n.id)}
                  />
                  Contexte IA
                </label>
              )}
              <h3 className="font-display text-lg text-sage-900">{n.title}</h3>
              <p className="text-xs text-sage-500">
                {n.category} · {n.visibility}
                {n.parentId ? ` · sous-note de ${notesById[n.parentId]?.title || '…'}` : ''}
              </p>
            </div>
            <div className="flex gap-1">
              {canEditEntity(user, n) && (
                <button type="button" className={btnGhost + ' !px-2'} onClick={() => openEdit(n)}>
                  <Pencil size={14} />
                </button>
              )}
              {canDeleteEntity(user, n) && (
                <button
                  type="button"
                  className={btnGhost + ' !px-2 !text-danger'}
                  onClick={() => setConfirmId(n.id)}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </div>
          <p className="mt-3 line-clamp-4 whitespace-pre-wrap text-sm text-sage-700">
            {n.content || '—'}
          </p>
          {(n.tags || []).length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1">
              {n.tags.map((t) => (
                <span key={t} className="rounded-md bg-sage-100 px-2 py-0.5 text-xs text-sage-700">
                  #{t}
                </span>
              ))}
            </div>
          )}
          {related.length > 0 && (
            <p className="mt-2 flex items-center gap-1 text-xs text-sage-500">
              <Link2 size={12} /> {related.length} lien{related.length > 1 ? 's' : ''}
            </p>
          )}
        </article>
        {children.map((child) => renderNoteCard(child, depth + 1))}
      </div>
    )
  }

  const parentOptions = notes.filter((n) => {
    if (editing && (n.id === editing.id || isNoteAncestor(notesById, n.id, editing.id))) return false
    return true
  })

  const toggleId = (key, id) => {
    setForm((f) => ({
      ...f,
      [key]: f[key].includes(id) ? f[key].filter((x) => x !== id) : [...f[key], id],
    }))
  }

  return (
    <div className="space-y-4 animate-fade-up">
      <LocalBanner />
      <div className="flex flex-wrap items-center gap-2">
        {canWriteRole(user) && (
          <>
            <button type="button" className={btnPrimary} onClick={openCreate}>
              <Plus size={16} /> Nouvelle note
            </button>
            <button type="button" className={btnGhost} onClick={onImport}>
              <Upload size={16} /> Importer
            </button>
          </>
        )}
        <select
          className={inputClass + ' max-w-full md:!w-auto'}
          value={filterCat}
          onChange={(e) => setFilterCat(e.target.value)}
        >
          <option>Tous</option>
          {NOTE_CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="Aucune note"
          hint="Créez votre première note pour démarrer."
          action={
            canWriteRole(user) ? (
              <button type="button" className={btnPrimary + ' mt-4'} onClick={openCreate}>
                <Plus size={16} /> Créer une note
              </button>
            ) : null
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {(filterCat === 'Tous' ? treeNotes : filtered).map((n) => renderNoteCard(n))}
        </div>
      )}

      <Modal open={open} title={editing ? 'Modifier la note' : 'Nouvelle note'} onClose={() => setOpen(false)} wide>
        <form onSubmit={submit} className="space-y-1">
          <Field label="Titre">
            <input
              className={inputClass}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
            />
          </Field>
          <Field label="Contenu">
            <textarea
              className={inputClass + ' min-h-28'}
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label="Catégorie">
              <select
                className={inputClass}
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                {NOTE_CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
            <Field label="Visibilité">
              <select
                className={inputClass}
                value={form.visibility}
                onChange={(e) => setForm({ ...form, visibility: e.target.value })}
              >
                {VISIBILITIES.map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Étiquettes (séparées par des virgules)">
            <input
              className={inputClass}
              value={form.tags}
              onChange={(e) => setForm({ ...form, tags: e.target.value })}
            />
          </Field>
          <Field label="Projet lié (optionnel)">
            <select
              className={inputClass}
              value={form.projectId}
              onChange={(e) => setForm({ ...form, projectId: e.target.value })}
            >
              <option value="">Aucun</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Note parente (sous-note)">
            <select
              className={inputClass}
              value={form.parentId}
              onChange={(e) => setForm({ ...form, parentId: e.target.value })}
            >
              <option value="">Aucune (note racine)</option>
              {parentOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </Field>
          <div className="rounded-xl border border-sage-200 bg-white p-3">
            <p className="mb-2 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-sage-500">
              <Link2 size={12} /> Liens
            </p>
            <Field label="Fichiers">
              <div className="flex max-h-28 flex-wrap gap-1 overflow-auto xx-scroll">
                {files.length === 0 && <span className="text-xs text-sage-500">Aucun fichier visible.</span>}
                {files.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    className={`min-h-9 rounded-lg px-2 py-1 text-xs ${
                      form.linkFileIds.includes(f.id) ? 'bg-sage-700 text-white' : 'bg-sage-100 text-sage-700'
                    }`}
                    onClick={() => toggleId('linkFileIds', f.id)}
                  >
                    {f.name}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Risques">
              <div className="flex max-h-28 flex-wrap gap-1 overflow-auto xx-scroll">
                {risks.length === 0 && <span className="text-xs text-sage-500">Aucun risque visible.</span>}
                {risks.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    className={`min-h-9 rounded-lg px-2 py-1 text-xs ${
                      form.linkRiskIds.includes(r.id) ? 'bg-sage-700 text-white' : 'bg-sage-100 text-sage-700'
                    }`}
                    onClick={() => toggleId('linkRiskIds', r.id)}
                  >
                    {r.title}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Dépenses (lignes budget)">
              <div className="flex max-h-28 flex-wrap gap-1 overflow-auto xx-scroll">
                {budgetLines.length === 0 && <span className="text-xs text-sage-500">Aucune ligne visible.</span>}
                {budgetLines.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    className={`min-h-9 rounded-lg px-2 py-1 text-xs ${
                      form.linkExpenseIds.includes(l.id) ? 'bg-sage-700 text-white' : 'bg-sage-100 text-sage-700'
                    }`}
                    onClick={() => toggleId('linkExpenseIds', l.id)}
                  >
                    {l.name}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Idées">
              <div className="flex max-h-28 flex-wrap gap-1 overflow-auto xx-scroll">
                {ideas.length === 0 && <span className="text-xs text-sage-500">Aucune idée visible.</span>}
                {ideas.map((i) => (
                  <button
                    key={i.id}
                    type="button"
                    className={`min-h-9 rounded-lg px-2 py-1 text-xs ${
                      form.linkIdeaIds.includes(i.id) ? 'bg-sage-700 text-white' : 'bg-sage-100 text-sage-700'
                    }`}
                    onClick={() => toggleId('linkIdeaIds', i.id)}
                  >
                    {i.title}
                  </button>
                ))}
              </div>
            </Field>
          </div>
          {form.visibility !== 'Privée' && (
            <ShareEditor
              users={users}
              shares={form.shares}
              excludeId={user.id}
              onChange={(shares) => setForm({ ...form, shares })}
            />
          )}
          <ModalActions>
            <button type="submit" className={btnPrimary + ' w-full sm:w-auto'}>
              <Check size={16} /> Enregistrer
            </button>
          </ModalActions>
        </form>
      </Modal>

      <Modal open={Boolean(confirmId)} title="Confirmer la suppression" onClose={() => setConfirmId(null)}>
        <p className="text-sm text-sage-700">
          Cette action est définitive. Les sous-notes seront rattachées au parent supérieur.
        </p>
        <ModalActions>
          <button type="button" className={btnGhost + ' w-full sm:w-auto'} onClick={() => setConfirmId(null)}>
            Annuler
          </button>
          <button
            type="button"
            className={btnPrimary + ' w-full sm:w-auto !bg-danger'}
            onClick={() => remove(confirmId)}
          >
            Supprimer
          </button>
        </ModalActions>
      </Modal>
    </div>
  )
}

function fileIconFor(ext) {
  if (isImageExt(ext)) return ImageIcon
  return FileText
}

function FilesView({ user, files, folders, foldersMap, projects, users, flash, onImport }) {
  const ctx = useMemo(
    () => ({ folders: foldersMap || {}, projects: Object.fromEntries(projects.map((p) => [p.id, p])) }),
    [foldersMap, projects],
  )
  const remoteStorage = isRemoteFileStorage()
  const localBlobs = !remoteStorage || files.some((f) => f.localId && !f.storagePath)
  const [folderId, setFolderId] = useState(null)
  const [query, setQuery] = useState('')
  const [filterExt, setFilterExt] = useState('')
  const [filterAuthor, setFilterAuthor] = useState('')
  const [layout, setLayout] = useState('list')
  const [importOpen, setImportOpen] = useState(false)
  const [folderOpen, setFolderOpen] = useState(false)
  const [preview, setPreview] = useState(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [previewStatus, setPreviewStatus] = useState('idle')
  const [editItem, setEditItem] = useState(null)
  const [shareItem, setShareItem] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [busy, setBusy] = useState(false)
  const [upload, setUpload] = useState({
    file: null,
    description: '',
    folderId: '',
    projectId: '',
    shares: [],
    teamWide: false,
    progress: 0,
    status: 'idle',
    error: '',
  })
  const uploadJob = useRef(null)
  const [folderForm, setFolderForm] = useState({
    name: '',
    parentId: '',
    projectId: '',
    shares: [],
    teamWide: false,
  })
  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    folderId: '',
    parentId: '',
    projectId: '',
  })
  const [shareForm, setShareForm] = useState({ shares: [], teamWide: false })

  const currentFolder = folderId ? foldersMap[folderId] : null
  const canAddHere = canAddInFolder(user, currentFolder, ctx)

  const breadcrumb = useMemo(() => {
    const trail = []
    let cur = currentFolder
    const seen = new Set()
    while (cur && !seen.has(cur.id)) {
      trail.unshift(cur)
      seen.add(cur.id)
      cur = cur.parentId ? foldersMap[cur.parentId] : null
    }
    return trail
  }, [currentFolder, foldersMap])

  const childFolders = folders
    .filter((f) => (f.parentId || null) === folderId)
    .sort((a, b) => String(a.name).localeCompare(String(b.name), 'fr'))
  const childFiles = files
    .filter((f) => (f.folderId || null) === folderId)
    .sort((a, b) => String(a.name).localeCompare(String(b.name), 'fr'))

  const authors = useMemo(() => {
    const ids = new Set(files.map((f) => f.uploadedBy || f.ownerId).filter(Boolean))
    return users.filter((u) => ids.has(u.id))
  }, [files, users])

  const q = query.trim().toLowerCase()
  const filteredFolders = childFolders.filter((f) => {
    if (q && !String(f.name || '').toLowerCase().includes(q)) return false
    if (filterAuthor && f.ownerId !== filterAuthor) return false
    return true
  })
  const filteredFiles = childFiles.filter((f) => {
    if (q && !`${f.name || ''} ${f.description || ''}`.toLowerCase().includes(q)) return false
    if (filterExt && f.ext !== filterExt) return false
    if (filterAuthor && (f.uploadedBy || f.ownerId) !== filterAuthor) return false
    return true
  })

  const filtersOn = Boolean(q || filterExt || filterAuthor)
  const emptyRoot = folders.length === 0 && files.length === 0
  const emptyHere = filteredFolders.length === 0 && filteredFiles.length === 0

  const openImport = () => {
    setUpload({
      file: null,
      description: '',
      folderId: folderId || '',
      projectId: currentFolder?.projectId || '',
      shares: [],
      teamWide: false,
      progress: 0,
      status: 'idle',
      error: '',
    })
    setImportOpen(true)
  }

  const openNewFolder = () => {
    setFolderForm({
      name: '',
      parentId: folderId || '',
      projectId: currentFolder?.projectId || '',
      shares: [],
      teamWide: false,
    })
    setFolderOpen(true)
  }

  const submitFolder = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      await saveFolder(
        {
          name: folderForm.name,
          parentId: folderForm.parentId || null,
          projectId: folderForm.projectId || null,
          shares: folderForm.shares,
          teamWide: folderForm.teamWide,
        },
        user,
      )
      flash('Dossier créé.')
      setFolderOpen(false)
    } catch (err) {
      flash(err.message, 'err')
    } finally {
      setBusy(false)
    }
  }

  const pickUploadFile = (native) => {
    if (!native) {
      setUpload((u) => ({ ...u, file: null, error: '', status: 'idle' }))
      return
    }
    try {
      validateUploadFile(native)
      setUpload((u) => ({ ...u, file: native, error: '', status: 'idle' }))
    } catch (err) {
      setUpload((u) => ({ ...u, file: null, error: err.message, status: 'error' }))
    }
  }

  const runUpload = async (e) => {
    e.preventDefault()
    if (!upload.file) {
      setUpload((u) => ({ ...u, error: 'Choisissez un fichier.', status: 'error' }))
      return
    }
    setUpload((u) => ({ ...u, status: 'progress', progress: 1, error: '' }))
    try {
      const job = startFileUpload(
        {
          file: upload.file,
          folderId: upload.folderId || null,
          description: upload.description,
          projectId: upload.projectId || null,
          shares: upload.shares,
          teamWide: upload.teamWide,
        },
        user,
        {
          onProgress: (pct) => setUpload((u) => ({ ...u, progress: pct, status: 'progress' })),
        },
      )
      uploadJob.current = job
      await job.done
      uploadJob.current = null
      setUpload((u) => ({ ...u, status: 'done', progress: 100 }))
      flash('Fichier importé.')
      setImportOpen(false)
    } catch (err) {
      uploadJob.current = null
      setUpload((u) => ({
        ...u,
        status: 'error',
        error: err.message || 'Échec du téléversement.',
      }))
    }
  }

  const cancelUpload = () => {
    uploadJob.current?.cancel()
    setUpload((u) => ({ ...u, status: 'idle', progress: 0 }))
  }

  const openPreview = async (file) => {
    setPreview(file)
    setPreviewStatus('loading')
    setPreviewUrl('')
    try {
      const blob = await getFileBlob(file.id, user)
      const url = URL.createObjectURL(blob)
      setPreviewUrl(url)
      setPreviewStatus('done')
    } catch (err) {
      setPreviewStatus('denied')
      flash(err.message || 'Accès refusé.', 'err')
    }
  }

  const closePreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl('')
    setPreview(null)
    setPreviewStatus('idle')
  }

  const downloadPreview = () => {
    if (!previewUrl || !preview) return
    const a = document.createElement('a')
    a.href = previewUrl
    a.download = preview.name || 'fichier'
    a.click()
  }

  const openEdit = (item, kind) => {
    setEditItem({ ...item, kind })
    setEditForm({
      name: item.name || '',
      description: item.description || '',
      folderId: kind === 'file' ? item.folderId || '' : '',
      parentId: kind === 'folder' ? item.parentId || '' : '',
      projectId: item.projectId || '',
    })
  }

  const openShare = (item, kind) => {
    setShareItem({ ...item, kind })
    setShareForm({
      shares: item.shares || [],
      teamWide: item.visibility === 'Équipe',
    })
  }

  const submitEdit = async (e) => {
    e.preventDefault()
    if (!editItem) return
    setBusy(true)
    try {
      if (editItem.kind === 'folder') {
        await saveFolder(
          {
            id: editItem.id,
            name: editForm.name,
            parentId: editForm.parentId || null,
            projectId: editForm.projectId || null,
            shares: editItem.shares,
            teamWide: editItem.visibility === 'Équipe',
          },
          user,
        )
      } else {
        await saveFileMeta(
          {
            id: editItem.id,
            name: editForm.name,
            description: editForm.description,
            folderId: editForm.folderId || null,
            projectId: editForm.projectId || null,
          },
          user,
        )
      }
      flash('Enregistré.')
      setEditItem(null)
    } catch (err) {
      flash(err.message, 'err')
    } finally {
      setBusy(false)
    }
  }

  const submitShare = async (e) => {
    e.preventDefault()
    if (!shareItem) return
    setBusy(true)
    try {
      if (shareItem.kind === 'folder') {
        await saveFolder(
          {
            id: shareItem.id,
            name: shareItem.name,
            parentId: shareItem.parentId,
            projectId: shareItem.projectId,
            shares: shareForm.shares,
            teamWide: shareForm.teamWide,
          },
          user,
        )
      } else {
        await saveFileMeta(
          {
            id: shareItem.id,
            shares: shareForm.shares,
            teamWide: shareForm.teamWide,
          },
          user,
        )
      }
      flash('Partage mis à jour.')
      setShareItem(null)
    } catch (err) {
      flash(err.message, 'err')
    } finally {
      setBusy(false)
    }
  }

  const openDelete = (item, kind) => {
    if (kind === 'folder') {
      const summary = folderDeleteSummary(item.id)
      setConfirm({
        kind,
        item,
        title: 'Supprimer le dossier',
        body: `Le dossier et son contenu seront supprimés : ${summary.fileCount} fichier(s), ${summary.folderCount} sous-dossier(s). Cette action est définitive.`,
      })
    } else {
      setConfirm({
        kind,
        item,
        title: 'Supprimer le fichier',
        body: 'Cette action est définitive.',
      })
    }
  }

  const runDelete = async () => {
    if (!confirm) return
    setBusy(true)
    try {
      if (confirm.kind === 'folder') {
        await deleteFolder(confirm.item.id, user)
        if (folderId === confirm.item.id) setFolderId(confirm.item.parentId || null)
        flash('Dossier supprimé.')
      } else {
        await deleteFile(confirm.item.id, user)
        flash('Fichier supprimé.')
      }
      setConfirm(null)
    } catch (err) {
      flash(err.message, 'err')
    } finally {
      setBusy(false)
    }
  }

  const nameOf = (id) => users.find((u) => u.id === id)?.fullName || '—'
  const projectTitle = (id) => projects.find((p) => p.id === id)?.title || ''

  const folderChoices = folders.filter((f) => {
    if (!editItem || editItem.kind !== 'folder') return true
    if (f.id === editItem.id) return false
    let cur = f
    const seen = new Set()
    while (cur && !seen.has(cur.id)) {
      if (cur.parentId === editItem.id) return false
      seen.add(cur.id)
      cur = cur.parentId ? foldersMap[cur.parentId] : null
    }
    return true
  })

  const renderActions = (item, kind) => (
    <div className="flex flex-wrap gap-1">
      {kind === 'file' && (
        <button type="button" className={btnGhost + ' !px-2'} onClick={() => openPreview(item)} title="Aperçu">
          <Eye size={14} />
        </button>
      )}
      {canModifyFileOrFolder(user, item, ctx) && (
        <button type="button" className={btnGhost + ' !px-2'} onClick={() => openEdit(item, kind)} title="Modifier">
          <Pencil size={14} />
        </button>
      )}
      {canManageFileOrFolder(user, item, ctx) && (
        <button type="button" className={btnGhost + ' !px-2'} onClick={() => openShare(item, kind)} title="Partage">
          <Share2 size={14} />
        </button>
      )}
      {canDeleteFileOrFolder(user, item, ctx) && (
        <button
          type="button"
          className={btnGhost + ' !px-2 !text-danger'}
          onClick={() => openDelete(item, kind)}
          title="Supprimer"
        >
          <Trash2 size={14} />
        </button>
      )}
    </div>
  )

  const card = (item, kind) => {
    const Icon = kind === 'folder' ? Folder : fileIconFor(item.ext)
    return (
      <article
        key={item.id}
        className="flex flex-col rounded-2xl border border-sage-200 bg-white/80 p-4 transition hover:border-sage-400"
      >
        <div className="flex items-start gap-3">
          <button
            type="button"
            className="min-w-0 flex-1 text-left"
            onClick={() => (kind === 'folder' ? setFolderId(item.id) : openPreview(item))}
          >
            <div className="flex items-center gap-2">
              <Icon size={18} className="shrink-0 text-sage-600" />
              <h3 className="min-w-0 truncate font-display text-lg text-sage-900">{item.name}</h3>
            </div>
            <p className="mt-1 text-xs text-sage-500">
              {kind === 'folder'
                ? `${item.visibility}`
                : `${(item.ext || '').toUpperCase()} · ${formatFileSize(item.size)} · ${item.visibility}`}
            </p>
            {item.description ? (
              <p className="mt-2 line-clamp-2 text-sm text-sage-700">{item.description}</p>
            ) : null}
            {item.projectId ? (
              <p className="mt-1 text-xs text-sage-500">Projet : {projectTitle(item.projectId)}</p>
            ) : null}
          </button>
          {renderActions(item, kind)}
        </div>
      </article>
    )
  }

  const row = (item, kind) => {
    const Icon = kind === 'folder' ? Folder : fileIconFor(item.ext)
    return (
      <li
        key={item.id}
        className="flex flex-col gap-2 rounded-2xl border border-sage-200 bg-white/80 p-3 sm:flex-row sm:items-center"
      >
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
          onClick={() => (kind === 'folder' ? setFolderId(item.id) : openPreview(item))}
        >
          <Icon size={18} className="shrink-0 text-sage-600" />
          <div className="min-w-0">
            <p className="truncate font-medium text-sage-900">{item.name}</p>
            <p className="text-xs text-sage-500">
              {kind === 'folder'
                ? `${item.visibility} · ${nameOf(item.ownerId)}`
                : `${(item.ext || '').toUpperCase()} · ${formatFileSize(item.size)} · ${nameOf(item.uploadedBy || item.ownerId)}`}
            </p>
          </div>
        </button>
        {renderActions(item, kind)}
      </li>
    )
  }

  return (
    <div className="space-y-4 animate-fade-up">
      {localBlobs && (
        <div className="rounded-xl border border-warn/30 bg-warn/10 px-4 py-3 text-sm text-sage-800">
          Mode local — fichiers non synchronisés entre appareils
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {canWriteRole(user) && canAddHere && (
          <>
            <button type="button" className={btnPrimary} onClick={() => onImport?.(folderId)}>
              <Upload size={16} /> Importer
            </button>
            <button type="button" className={btnGhost} onClick={openImport}>
              <Upload size={16} /> Téléverser
            </button>
            <button type="button" className={btnGhost} onClick={openNewFolder}>
              <FolderPlus size={16} /> Nouveau dossier
            </button>
          </>
        )}
        <div className="relative min-w-0 flex-1 basis-full sm:basis-48">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sage-400" size={16} />
          <input
            className={inputClass + ' pl-9'}
            placeholder="Rechercher…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <select
          className={inputClass + ' max-w-full sm:!w-auto'}
          value={filterExt}
          onChange={(e) => setFilterExt(e.target.value)}
        >
          <option value="">Type</option>
          {ALLOWED_FILE_EXTS.map((ext) => (
            <option key={ext} value={ext}>
              {ext.toUpperCase()}
            </option>
          ))}
        </select>
        <select
          className={inputClass + ' max-w-full sm:!w-auto'}
          value={filterAuthor}
          onChange={(e) => setFilterAuthor(e.target.value)}
        >
          <option value="">Auteur</option>
          {authors.map((u) => (
            <option key={u.id} value={u.id}>
              {u.fullName}
            </option>
          ))}
        </select>
        <select
          className={inputClass + ' max-w-full sm:!w-auto'}
          value={folderId || ''}
          onChange={(e) => setFolderId(e.target.value || null)}
        >
          <option value="">Dossier racine</option>
          {folders.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
        <div className="flex rounded-xl border border-sage-300 bg-white p-1">
          <button
            type="button"
            className={`inline-flex min-h-9 min-w-9 items-center justify-center rounded-lg ${
              layout === 'list' ? 'bg-sage-200' : ''
            }`}
            onClick={() => setLayout('list')}
            aria-label="Liste"
          >
            <List size={16} />
          </button>
          <button
            type="button"
            className={`inline-flex min-h-9 min-w-9 items-center justify-center rounded-lg ${
              layout === 'grid' ? 'bg-sage-200' : ''
            }`}
            onClick={() => setLayout('grid')}
            aria-label="Grille"
          >
            <LayoutGrid size={16} />
          </button>
        </div>
      </div>

      <nav className="flex flex-wrap items-center gap-1 text-sm text-sage-600">
        <button type="button" className="rounded-lg px-2 py-1 hover:bg-sage-100" onClick={() => setFolderId(null)}>
          Accueil
        </button>
        {breadcrumb.map((f) => (
          <span key={f.id} className="flex items-center gap-1">
            <span>/</span>
            <button type="button" className="rounded-lg px-2 py-1 hover:bg-sage-100" onClick={() => setFolderId(f.id)}>
              {f.name}
            </button>
          </span>
        ))}
      </nav>

      {emptyRoot ? (
        <EmptyState
          title="Aucun fichier"
          hint={
            canWriteRole(user)
              ? `Importez un document (max ${maxFileSizeLabel()}). Types : ${ALLOWED_FILE_EXTS.join(', ')}.`
              : 'Les fichiers partagés avec vous apparaîtront ici.'
          }
          action={
            canWriteRole(user) && canAddHere ? (
              <button type="button" className={btnPrimary + ' mt-4'} onClick={() => onImport?.(folderId)}>
                <Upload size={16} /> Importer un fichier
              </button>
            ) : null
          }
        />
      ) : emptyHere && filtersOn ? (
        <EmptyState title="Aucun résultat" hint="Aucun fichier ne correspond aux filtres." />
      ) : emptyHere ? (
        <EmptyState
          title="Dossier vide"
          hint="Ajoutez un fichier ou un sous-dossier."
          action={
            canWriteRole(user) && canAddHere ? (
              <button type="button" className={btnPrimary + ' mt-4'} onClick={() => onImport?.(folderId)}>
                <Upload size={16} /> Importer
              </button>
            ) : null
          }
        />
      ) : layout === 'grid' ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredFolders.map((f) => card(f, 'folder'))}
          {filteredFiles.map((f) => card(f, 'file'))}
        </div>
      ) : (
        <ul className="space-y-2">
          {filteredFolders.map((f) => row(f, 'folder'))}
          {filteredFiles.map((f) => row(f, 'file'))}
        </ul>
      )}

      <Modal open={importOpen} title="Importer un fichier" onClose={() => setImportOpen(false)} wide>
        <form onSubmit={runUpload} className="space-y-1">
          <Field label={`Fichier (max ${maxFileSizeLabel()})`}>
            <input
              type="file"
              className={inputClass}
              accept={ALLOWED_FILE_EXTS.map((e) => `.${e}`).join(',')}
              onChange={(e) => pickUploadFile(e.target.files?.[0] || null)}
            />
          </Field>
          <p className="mb-3 text-xs text-sage-500">
            Types : {ALLOWED_FILE_EXTS.join(', ')}. Exécutables, HTML, SVG et scripts sont bloqués.
          </p>
          <Field label="Dossier">
            <select
              className={inputClass}
              value={upload.folderId}
              onChange={(e) => setUpload((u) => ({ ...u, folderId: e.target.value }))}
            >
              <option value="">Racine</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Description">
            <textarea
              className={inputClass + ' min-h-20'}
              value={upload.description}
              onChange={(e) => setUpload((u) => ({ ...u, description: e.target.value }))}
            />
          </Field>
          <Field label="Projet associé (optionnel)">
            <select
              className={inputClass}
              value={upload.projectId}
              onChange={(e) => setUpload((u) => ({ ...u, projectId: e.target.value }))}
            >
              <option value="">Aucun</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </Field>
          <FileShareBlock
            users={users}
            user={user}
            shares={upload.shares}
            teamWide={upload.teamWide}
            onShares={(shares) => setUpload((u) => ({ ...u, shares }))}
            onTeamWide={(teamWide) => setUpload((u) => ({ ...u, teamWide }))}
          />
          {upload.status === 'progress' && (
            <div className="mt-3">
              <div className="h-2 overflow-hidden rounded-full bg-sage-200">
                <div className="h-full bg-sage-700 transition-all" style={{ width: `${upload.progress}%` }} />
              </div>
              <p className="mt-1 text-xs text-sage-600">{upload.progress} %</p>
            </div>
          )}
          {upload.status === 'error' && upload.error && (
            <p className="mt-2 text-sm text-danger">{upload.error}</p>
          )}
          <ModalActions>
            {upload.status === 'progress' ? (
              <button type="button" className={btnGhost + ' w-full sm:w-auto'} onClick={cancelUpload}>
                Annuler
              </button>
            ) : (
              <button type="submit" className={btnPrimary + ' w-full sm:w-auto'} disabled={!upload.file}>
                <Upload size={16} /> Téléverser
              </button>
            )}
          </ModalActions>
        </form>
      </Modal>

      <Modal open={folderOpen} title="Nouveau dossier" onClose={() => setFolderOpen(false)}>
        <form onSubmit={submitFolder}>
          <Field label="Nom">
            <input
              className={inputClass}
              value={folderForm.name}
              onChange={(e) => setFolderForm({ ...folderForm, name: e.target.value })}
              required
            />
          </Field>
          <Field label="Dossier parent">
            <select
              className={inputClass}
              value={folderForm.parentId}
              onChange={(e) => setFolderForm({ ...folderForm, parentId: e.target.value })}
            >
              <option value="">Racine</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Projet associé (optionnel)">
            <select
              className={inputClass}
              value={folderForm.projectId}
              onChange={(e) => setFolderForm({ ...folderForm, projectId: e.target.value })}
            >
              <option value="">Aucun</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </Field>
          <FileShareBlock
            users={users}
            user={user}
            shares={folderForm.shares}
            teamWide={folderForm.teamWide}
            onShares={(shares) => setFolderForm({ ...folderForm, shares })}
            onTeamWide={(teamWide) => setFolderForm({ ...folderForm, teamWide })}
          />
          <ModalActions>
            <button type="submit" className={btnPrimary + ' w-full sm:w-auto'} disabled={busy}>
              <Check size={16} /> Créer
            </button>
          </ModalActions>
        </form>
      </Modal>

      <Modal
        open={Boolean(preview)}
        title={preview ? 'Aperçu' : 'Aperçu'}
        onClose={closePreview}
        wide
      >
        {previewStatus === 'loading' && <p className="text-sm text-sage-600">Chargement…</p>}
        {previewStatus === 'denied' && (
          <p className="text-sm text-danger">Accès refusé.</p>
        )}
        {previewStatus === 'done' && preview && (
          <div className="space-y-3">
            {isImageExt(preview.ext) && previewUrl ? (
              <img src={previewUrl} alt="" className="max-h-[70vh] w-full rounded-xl object-contain bg-white" />
            ) : isPdfExt(preview.ext) && previewUrl ? (
              <iframe title="PDF" src={previewUrl} className="h-[70vh] w-full rounded-xl bg-white" />
            ) : (
              <p className="text-sm text-sage-600">Aperçu indisponible pour ce type. Téléchargez le fichier.</p>
            )}
            <button type="button" className={btnPrimary} onClick={downloadPreview}>
              <Download size={16} /> Télécharger
            </button>
          </div>
        )}
      </Modal>

      <Modal
        open={Boolean(editItem)}
        title={editItem?.kind === 'folder' ? 'Modifier le dossier' : 'Modifier le fichier'}
        onClose={() => setEditItem(null)}
      >
        <form onSubmit={submitEdit}>
          <Field label="Nom">
            <input
              className={inputClass}
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              required
            />
          </Field>
          {editItem?.kind === 'file' && (
            <Field label="Description">
              <textarea
                className={inputClass + ' min-h-20'}
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
              />
            </Field>
          )}
          <Field label={editItem?.kind === 'folder' ? 'Dossier parent' : 'Dossier'}>
            <select
              className={inputClass}
              value={editItem?.kind === 'folder' ? editForm.parentId : editForm.folderId}
              onChange={(e) =>
                setEditForm({
                  ...editForm,
                  ...(editItem?.kind === 'folder' ? { parentId: e.target.value } : { folderId: e.target.value }),
                })
              }
            >
              <option value="">Racine</option>
              {(editItem?.kind === 'folder' ? folderChoices : folders).map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Projet associé (optionnel)">
            <select
              className={inputClass}
              value={editForm.projectId}
              onChange={(e) => setEditForm({ ...editForm, projectId: e.target.value })}
            >
              <option value="">Aucun</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </Field>
          <ModalActions>
            <button type="submit" className={btnPrimary + ' w-full sm:w-auto'} disabled={busy}>
              <Check size={16} /> Enregistrer
            </button>
          </ModalActions>
        </form>
      </Modal>

      <Modal open={Boolean(shareItem)} title="Partage" onClose={() => setShareItem(null)}>
        <form onSubmit={submitShare}>
          <FileShareBlock
            users={users}
            user={user}
            shares={shareForm.shares}
            teamWide={shareForm.teamWide}
            onShares={(shares) => setShareForm({ ...shareForm, shares })}
            onTeamWide={(teamWide) => setShareForm({ ...shareForm, teamWide })}
          />
          <ModalActions>
            <button type="submit" className={btnPrimary + ' w-full sm:w-auto'} disabled={busy}>
              <Check size={16} /> Enregistrer
            </button>
          </ModalActions>
        </form>
      </Modal>

      <Modal open={Boolean(confirm)} title={confirm?.title || 'Confirmer'} onClose={() => setConfirm(null)}>
        <p className="text-sm text-sage-700">{confirm?.body}</p>
        <ModalActions>
          <button type="button" className={btnGhost + ' w-full sm:w-auto'} onClick={() => setConfirm(null)}>
            Annuler
          </button>
          <button
            type="button"
            className={btnPrimary + ' w-full sm:w-auto !bg-danger'}
            onClick={runDelete}
            disabled={busy}
          >
            Supprimer
          </button>
        </ModalActions>
      </Modal>
    </div>
  )
}

function IdeasView({ user, ideas, users, flash }) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [detail, setDetail] = useState(null)
  const [form, setForm] = useState({
    title: '',
    description: '',
    status: 'Nouvelle',
    visibility: 'Publique',
    shares: [],
  })

  const byCol = IDEA_STATUSES.map((status) => ({
    status,
    items: ideas.filter((i) => i.status === status),
  }))

  const openCreate = () => {
    setEditing(null)
    setForm({
      title: '',
      description: '',
      status: 'Nouvelle',
      visibility: 'Publique',
      shares: [],
    })
    setOpen(true)
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!editing && !canWriteRole(user)) {
      flash('Permission refusée.', 'err')
      return
    }
    if (editing && !canEditEntity(user, editing)) {
      flash('Permission refusée.', 'err')
      return
    }
    try {
      const payload = {
        id: editing?.id,
        title: form.title.trim(),
        description: form.description.trim(),
        status: form.status,
        visibility: form.visibility,
        shares: form.shares,
        votes: editing?.votes || [],
        history: editing?.history || [
          { type: 'create', userId: user.id, label: 'Idée créée', at: new Date().toISOString() },
        ],
      }
      const saved = await saveIdea(payload, user)
      if (editing && editing.status !== saved.status) {
        await appendIdeaHistory(saved.id, {
          type: 'status',
          userId: user.id,
          label: `Statut → ${saved.status}`,
        })
      }
      flash(editing ? 'Idée mise à jour.' : 'Idée créée.')
      setOpen(false)
    } catch (err) {
      flash(err.message, 'err')
    }
  }

  const move = async (idea, status) => {
    if (!canEditEntity(user, idea)) {
      flash('Permission refusée.', 'err')
      return
    }
    await saveIdea({ ...idea, status }, user)
    await appendIdeaHistory(idea.id, {
      type: 'status',
      userId: user.id,
      label: `Déplacée vers « ${status} »`,
    })
  }

  const transform = async (idea, kind) => {
    if (idea.status !== 'Retenue') {
      flash('Seules les idées retenues peuvent être transformées.', 'err')
      return
    }
    if (kind === 'note') {
      await saveNote(
        {
          title: idea.title,
          content: idea.description,
          category: 'Général',
          tags: ['depuis-idée'],
          visibility: 'Privée',
          shares: [],
        },
        user,
      )
      flash('Idée transformée en note.')
    } else {
      await saveProject(
        {
          title: idea.title,
          description: idea.description,
          status: 'À préparer',
          progress: 0,
          leadId: user.id,
          memberIds: [],
          startDate: new Date().toISOString().slice(0, 10),
          dueDate: '',
          visibility: 'Partagée',
          shares: [],
          linkedIdeaId: idea.id,
        },
        user,
      )
      flash('Idée transformée en projet.')
    }
    await appendIdeaHistory(idea.id, {
      type: 'transform',
      userId: user.id,
      label: `Transformée en ${kind === 'note' ? 'note' : 'projet'}`,
    })
  }

  return (
    <div className="space-y-4 animate-fade-up">
      {canWriteRole(user) && (
        <button type="button" className={btnPrimary} onClick={openCreate}>
          <Plus size={16} /> Nouvelle idée
        </button>
      )}

      {ideas.length === 0 ? (
        <EmptyState
          title="Boîte à idées vide"
          hint="Ajoutez une idée puis faites glisser son statut sur le Kanban."
          action={
            canWriteRole(user) ? (
              <button type="button" className={btnPrimary + ' mt-4'} onClick={openCreate}>
                <Plus size={16} /> Ajouter une idée
              </button>
            ) : null
          }
        />
      ) : (
        <div className="w-full max-w-full overflow-x-auto overflow-y-hidden xx-scroll">
          <div className="flex min-h-[min(28rem,62vh)] w-max gap-3 pb-2">
          {byCol.map((col) => (
            <div
              key={col.status}
              className="flex min-h-[min(28rem,62vh)] w-[min(260px,85vw)] shrink-0 flex-col rounded-2xl border border-sage-200 bg-sage-100/60 p-3"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                const id = e.dataTransfer.getData('text/idea')
                const idea = ideas.find((i) => i.id === id)
                if (idea) move(idea, col.status)
              }}
            >
              <div className="mb-3 flex items-center justify-between px-1">
                <h3 className="text-sm font-semibold text-sage-800">{col.status}</h3>
                <span className="text-xs text-sage-500">{col.items.length}</span>
              </div>
              <div className="space-y-2">
                {col.items.map((idea) => (
                  <div
                    key={idea.id}
                    draggable={canEditEntity(user, idea)}
                    onDragStart={(e) => e.dataTransfer.setData('text/idea', idea.id)}
                    className="cursor-grab rounded-xl border border-sage-200 bg-white p-3 active:cursor-grabbing"
                  >
                    <button
                      type="button"
                      className="w-full text-left"
                      onClick={() => setDetail(idea)}
                    >
                      <p className="font-medium text-sage-900">{idea.title}</p>
                      <p className="mt-1 line-clamp-2 text-xs text-sage-600">{idea.description}</p>
                    </button>
                    <div className="mt-2 flex items-center justify-between">
                      <button
                        type="button"
                        className={`${btnGhost} !px-2 !py-1 text-xs ${
                          (idea.votes || []).includes(user.id) ? '!bg-sage-200' : ''
                        }`}
                        onClick={async () => {
                          await voteIdea(idea.id, user.id)
                        }}
                      >
                        <ThumbsUp size={12} /> {(idea.votes || []).length}
                      </button>
                      {idea.status === 'Retenue' && (
                        <div className="flex gap-1">
                          <button
                            type="button"
                            title="En note"
                            className={btnGhost + ' !px-2 !py-1'}
                            onClick={() => transform(idea, 'note')}
                          >
                            <StickyNote size={12} />
                          </button>
                          <button
                            type="button"
                            title="En projet"
                            className={btnGhost + ' !px-2 !py-1'}
                            onClick={() => transform(idea, 'project')}
                          >
                            <FolderKanban size={12} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          </div>
        </div>
      )}

      <Modal open={open} title={editing ? 'Modifier l’idée' : 'Nouvelle idée'} onClose={() => setOpen(false)}>
        <form onSubmit={submit}>
          <Field label="Titre">
            <input
              className={inputClass}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
            />
          </Field>
          <Field label="Description">
            <textarea
              className={inputClass + ' min-h-24'}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </Field>
          <Field label="Statut">
            <select
              className={inputClass}
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              {IDEA_STATUSES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
          <Field label="Visibilité">
            <select
              className={inputClass}
              value={form.visibility}
              onChange={(e) => setForm({ ...form, visibility: e.target.value })}
            >
              {VISIBILITIES.map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </Field>
          {form.visibility !== 'Privée' && (
            <ShareEditor
              users={users}
              shares={form.shares}
              excludeId={user.id}
              onChange={(shares) => setForm({ ...form, shares })}
            />
          )}
          <ModalActions>
            <button type="submit" className={btnPrimary + ' w-full sm:w-auto'}>
              Enregistrer
            </button>
          </ModalActions>
        </form>
      </Modal>

      <Modal
        open={Boolean(detail)}
        title={detail?.title || ''}
        onClose={() => setDetail(null)}
        wide
      >
        {detail && (
          <div className="space-y-4">
            <p className="whitespace-pre-wrap text-sm text-sage-700">{detail.description}</p>
            <p className="text-xs text-sage-500">
              Statut : {detail.status} · Votes : {(detail.votes || []).length}
            </p>
            <div>
              <h4 className="mb-2 font-semibold text-sage-800">Historique</h4>
              <ul className="max-h-48 space-y-2 overflow-y-auto text-sm xx-scroll">
                {(detail.history || [])
                  .slice()
                  .reverse()
                  .map((h, idx) => (
                    <li key={idx} className="rounded-lg bg-white px-3 py-2 text-sage-700">
                      <span className="font-medium">{h.label}</span>
                      <span className="ml-2 text-xs text-sage-500">
                        {h.at ? new Date(h.at).toLocaleString('fr-FR') : ''}
                      </span>
                    </li>
                  ))}
              </ul>
            </div>
            <ModalActions>
              {canEditEntity(user, detail) && (
                <button
                  type="button"
                  className={btnGhost + ' w-full sm:w-auto'}
                  onClick={() => {
                    setEditing(detail)
                    setForm({
                      title: detail.title,
                      description: detail.description || '',
                      status: detail.status,
                      visibility: detail.visibility || 'Publique',
                      shares: detail.shares || [],
                    })
                    setDetail(null)
                    setOpen(true)
                  }}
                >
                  <Pencil size={14} /> Modifier
                </button>
              )}
              {canDeleteEntity(user, detail) && (
                <button
                  type="button"
                  className={btnGhost + ' w-full sm:w-auto !text-danger'}
                  onClick={async () => {
                    await deleteIdea(detail.id, user)
                    setDetail(null)
                    flash('Idée supprimée.')
                  }}
                >
                  <Trash2 size={14} /> Supprimer
                </button>
              )}
            </ModalActions>
          </div>
        )}
      </Modal>
    </div>
  )
}

function projectLinked(entity, projectId, links, type) {
  if (entity.projectId === projectId || entity.id === projectId) return true
  return relatedLinkEnds(links, type, entity.id).some((r) => r.type === 'project' && r.id === projectId)
}

function NoteTreeList({ notes, parentId = null, depth = 0 }) {
  const ids = new Set(notes.map((n) => n.id))
  let children = noteChildList(notes, parentId)
  if (depth === 0) {
    const orphans = notes.filter((n) => n.parentId && !ids.has(n.parentId))
    const seen = new Set(children.map((n) => n.id))
    children = [...children, ...orphans.filter((n) => !seen.has(n.id))]
  }
  if (!children.length && depth === 0) return <p className="text-sage-500">Aucune</p>
  return (
    <ul className={depth ? 'mt-1 space-y-1 border-l border-sage-200 pl-3' : 'mt-2 space-y-1'}>
      {children.map((n) => (
        <li key={n.id}>
          <span className="text-sage-800">{n.title}</span>
          <NoteTreeList notes={notes} parentId={n.id} depth={depth + 1} />
        </li>
      ))}
    </ul>
  )
}

function ProjectDetailBody({ detail, notes, ideas, files, events, budgets, risks, links }) {
  const related = relatedLinkEnds(links, 'project', detail.id)
  const linkedNotes = notes.filter(
    (n) => n.projectId === detail.id || related.some((r) => r.type === 'note' && r.id === n.id),
  )
  const linkedFiles = files.filter((f) => projectLinked(f, detail.id, links, 'file'))
  const linkedIdeas = ideas.filter(
    (i) => i.id === detail.linkedIdeaId || projectLinked(i, detail.id, links, 'idea'),
  )
  const linkedEvents = events.filter((e) => projectLinked(e, detail.id, links, 'event'))
  const linkedBudgets = budgets.filter((b) => projectLinked(b, detail.id, links, 'budget'))
  const linkedRisks = risks.filter((r) => projectLinked(r, detail.id, links, 'risk'))
  const sections = [
    ['Fichiers', linkedFiles.map((f) => f.name)],
    ['Idées', linkedIdeas.map((i) => `${i.title} (${i.status})`)],
    ['Événements', linkedEvents.map((e) => `${e.title} · ${e.date || ''}`)],
    ['Budgets', linkedBudgets.map((b) => b.name)],
    ['Risques', linkedRisks.map((r) => r.title)],
  ]
  return (
    <div className="space-y-4 text-sm">
      <p className="text-sage-700">{detail.description}</p>
      <p className="text-sage-500">
        {detail.startDate || '—'} → {detail.dueDate || '—'} · {detail.progress ?? 0}%
      </p>
      <div>
        <h4 className="font-semibold text-sage-800">Notes rattachées</h4>
        <NoteTreeList notes={linkedNotes} />
      </div>
      {sections.map(([label, items]) => (
        <div key={label}>
          <h4 className="font-semibold text-sage-800">{label}</h4>
          <ul className="mt-2 space-y-1">
            {items.length === 0 && <li className="text-sage-500">Aucun</li>}
            {items.map((item, idx) => (
              <li key={`${label}-${idx}`}>{item}</li>
            ))}
          </ul>
        </div>
      ))}
      <p className="text-xs text-sage-500">Les discussions d’équipe restent dans le module Chat.</p>
    </div>
  )
}

function ProjectsView({
  user,
  projects,
  notes,
  ideas,
  files = [],
  events = [],
  budgets = [],
  risks = [],
  links = [],
  users,
  flash,
  onImport,
  onFocusProject,
}) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [detail, setDetail] = useState(null)
  const [form, setForm] = useState({
    title: '',
    description: '',
    status: 'À préparer',
    progress: 0,
    leadId: '',
    memberIds: [],
    startDate: '',
    dueDate: '',
    visibility: 'Partagée',
    shares: [],
  })

  useEffect(() => {
    onFocusProject?.(detail?.id || '')
  }, [detail?.id, onFocusProject])

  const openCreate = () => {
    setEditing(null)
    setForm({
      title: '',
      description: '',
      status: 'À préparer',
      progress: 0,
      leadId: user.id,
      memberIds: [],
      startDate: new Date().toISOString().slice(0, 10),
      dueDate: '',
      visibility: 'Partagée',
      shares: [],
    })
    setOpen(true)
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!editing && !canWriteRole(user)) {
      flash('Permission refusée.', 'err')
      return
    }
    if (editing && !canEditEntity(user, editing)) {
      flash('Permission refusée.', 'err')
      return
    }
    try {
      const saved = await saveProject(
        {
          id: editing?.id,
          ...form,
          title: form.title.trim(),
          progress: Number(form.progress) || 0,
        },
        user,
      )
      const notifyIds = [
        ...form.memberIds,
        ...(form.shares || []).map((s) => s.userId),
        form.leadId,
      ].filter((id) => id && id !== user.id)
      if (notifyIds.length) {
        await notifyUsers(notifyIds, {
          type: 'project_assign',
          title: 'Projet mis à jour',
          body: `${user.fullName} vous a associé au projet « ${saved.title} ».`,
          meta: { projectId: saved.id },
        })
      }
      flash(editing ? 'Projet mis à jour.' : 'Projet créé.')
      setOpen(false)
    } catch (err) {
      flash(err.message, 'err')
    }
  }

  return (
    <div className="space-y-4 animate-fade-up">
      <LocalBanner />
      {canWriteRole(user) && (
        <div className="flex flex-wrap gap-2">
          <button type="button" className={btnPrimary} onClick={openCreate}>
            <Plus size={16} /> Nouveau projet
          </button>
          <button type="button" className={btnGhost} onClick={onImport}>
            <Upload size={16} /> Importer
          </button>
        </div>
      )}

      {projects.length === 0 ? (
        <EmptyState
          title="Aucun projet"
          hint="Définissez un projet avec responsable, membres et progression."
          action={
            canWriteRole(user) ? (
              <button type="button" className={btnPrimary + ' mt-4'} onClick={openCreate}>
                <Plus size={16} /> Créer un projet
              </button>
            ) : null
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {projects.map((p) => {
            const lead = users.find((u) => u.id === p.leadId)
            return (
              <article
                key={p.id}
                className="rounded-2xl border border-sage-200 bg-white/80 p-5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-display text-xl text-sage-900">{p.title}</h3>
                    <p className="text-xs text-sage-500">
                      {p.status} · Responsable : {lead?.fullName || '—'}
                    </p>
                  </div>
                  <button type="button" className={btnGhost + ' !px-2'} onClick={() => setDetail(p)}>
                    <Eye size={14} />
                  </button>
                </div>
                <p className="mt-3 line-clamp-3 text-sm text-sage-700">{p.description}</p>
                <div className="mt-4">
                  <div className="mb-1 flex justify-between text-xs text-sage-600">
                    <span>Progression</span>
                    <span>{p.progress ?? 0}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-sage-100">
                    <div
                      className="h-full rounded-full bg-sage-600 transition-all"
                      style={{ width: `${Math.min(100, Math.max(0, p.progress || 0))}%` }}
                    />
                  </div>
                </div>
                {canEditEntity(user, p) && (
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={p.progress || 0}
                    className="mt-3 w-full accent-sage-700"
                    onChange={async (e) => {
                      await saveProject({ ...p, progress: Number(e.target.value) }, user)
                    }}
                  />
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  {canEditEntity(user, p) && (
                    <button
                      type="button"
                      className={btnGhost}
                      onClick={() => {
                        setEditing(p)
                        setForm({
                          title: p.title,
                          description: p.description || '',
                          status: p.status,
                          progress: p.progress || 0,
                          leadId: p.leadId || user.id,
                          memberIds: p.memberIds || [],
                          startDate: p.startDate || '',
                          dueDate: p.dueDate || '',
                          visibility: p.visibility || 'Partagée',
                          shares: p.shares || [],
                        })
                        setOpen(true)
                      }}
                    >
                      <Pencil size={14} /> Modifier
                    </button>
                  )}
                  {canDeleteEntity(user, p) && (
                    <button
                      type="button"
                      className={btnGhost + ' !text-danger'}
                      onClick={async () => {
                        if (confirm('Supprimer ce projet ?')) {
                          await deleteProject(p.id, user)
                          flash('Projet supprimé.')
                        }
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      )}

      <Modal open={open} title={editing ? 'Modifier le projet' : 'Nouveau projet'} onClose={() => setOpen(false)} wide>
        <form onSubmit={submit} className="grid grid-cols-1 gap-1 md:grid-cols-2 md:gap-x-4">
          <div className="md:col-span-2">
            <Field label="Titre">
              <input
                className={inputClass}
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
              />
            </Field>
          </div>
          <div className="md:col-span-2">
            <Field label="Description">
              <textarea
                className={inputClass + ' min-h-20'}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </Field>
          </div>
          <Field label="Statut">
            <select
              className={inputClass}
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              {PROJECT_STATUSES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
          <Field label="Progression (%)">
            <input
              type="number"
              min="0"
              max="100"
              className={inputClass}
              value={form.progress}
              onChange={(e) => setForm({ ...form, progress: e.target.value })}
            />
          </Field>
          <Field label="Responsable">
            <select
              className={inputClass}
              value={form.leadId}
              onChange={(e) => setForm({ ...form, leadId: e.target.value })}
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.fullName}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Visibilité">
            <select
              className={inputClass}
              value={form.visibility}
              onChange={(e) => setForm({ ...form, visibility: e.target.value })}
            >
              {VISIBILITIES.map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </Field>
          <Field label="Date de début">
            <input
              type="date"
              className={inputClass}
              value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
            />
          </Field>
          <Field label="Échéance">
            <input
              type="date"
              className={inputClass}
              value={form.dueDate}
              onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
            />
          </Field>
          <div className="md:col-span-2">
            <Field label="Membres">
              <div className="flex flex-wrap gap-2 rounded-xl border border-sage-200 bg-white p-3">
                {users
                  .filter((u) => u.id !== form.leadId)
                  .map((u) => {
                    const on = form.memberIds.includes(u.id)
                    return (
                      <button
                        key={u.id}
                        type="button"
                        className={`min-h-11 rounded-lg px-2.5 py-2 text-xs ${
                          on ? 'bg-sage-700 text-white' : 'bg-sage-100 text-sage-700'
                        }`}
                        onClick={() => {
                          setForm({
                            ...form,
                            memberIds: on
                              ? form.memberIds.filter((id) => id !== u.id)
                              : [...form.memberIds, u.id],
                          })
                        }}
                      >
                        {u.fullName}
                      </button>
                    )
                  })}
              </div>
            </Field>
          </div>
          <div className="md:col-span-2">
            <ShareEditor
              users={users}
              shares={form.shares}
              excludeId={user.id}
              onChange={(shares) => setForm({ ...form, shares })}
            />
          </div>
          <div className="md:col-span-2">
            <ModalActions>
              <button type="submit" className={btnPrimary + ' w-full sm:w-auto'}>
                Enregistrer
              </button>
            </ModalActions>
          </div>
        </form>
      </Modal>

      <Modal open={Boolean(detail)} title={detail?.title || ''} onClose={() => setDetail(null)} wide>
        {detail && (
          <ProjectDetailBody
            detail={detail}
            notes={notes}
            ideas={ideas}
            files={files}
            events={events}
            budgets={budgets}
            risks={risks}
            links={links}
          />
        )}
      </Modal>
    </div>
  )
}

function CalendarView({ user, events, users, flash }) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({
    title: '',
    description: '',
    date: '',
    time: '09:00',
    participantIds: [],
    visibility: 'Partagée',
    shares: [],
  })

  const sorted = [...events].sort((a, b) =>
    `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`),
  )

  const submit = async (e) => {
    e.preventDefault()
    if (!canWriteRole(user)) {
      flash('Permission refusée.', 'err')
      return
    }
    try {
      const saved = await saveEvent(
        {
          ...form,
          title: form.title.trim(),
          shares: form.participantIds.map((id) => ({
            userId: id,
            permission: 'Lecture seule',
          })),
        },
        user,
      )
      await notifyUsers(
        form.participantIds.filter((id) => id !== user.id),
        {
          type: 'event_invite',
          title: 'Invitation calendrier',
          body: `${user.fullName} vous invite à « ${saved.title} » le ${saved.date} à ${saved.time}.`,
          meta: { eventId: saved.id },
        },
      )
      flash('Événement planifié.')
      setOpen(false)
      setForm({
        title: '',
        description: '',
        date: '',
        time: '09:00',
        participantIds: [],
        visibility: 'Partagée',
        shares: [],
      })
    } catch (err) {
      flash(err.message, 'err')
    }
  }

  return (
    <div className="space-y-4 animate-fade-up">
      {canWriteRole(user) && (
        <button type="button" className={btnPrimary} onClick={() => setOpen(true)}>
          <Plus size={16} /> Nouvel événement
        </button>
      )}

      {sorted.length === 0 ? (
        <EmptyState
          title="Calendrier vide"
          hint="Planifiez un rendez-vous et notifiez les participants."
          action={
            canWriteRole(user) ? (
              <button type="button" className={btnPrimary + ' mt-4'} onClick={() => setOpen(true)}>
                <Plus size={16} /> Planifier
              </button>
            ) : null
          }
        />
      ) : (
        <ul className="space-y-3">
          {sorted.map((ev) => (
            <li
              key={ev.id}
              className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-sage-200 bg-white/80 p-4"
            >
              <div>
                <p className="font-display text-lg text-sage-900">{ev.title}</p>
                <p className="text-sm text-sage-600">
                  {ev.date} · {ev.time}
                </p>
                <p className="mt-2 text-sm text-sage-700">{ev.description}</p>
                <p className="mt-2 text-xs text-sage-500">
                  Participants :{' '}
                  {(ev.participantIds || [])
                    .map((id) => users.find((u) => u.id === id)?.fullName || id)
                    .join(', ') || '—'}
                </p>
              </div>
              {canDeleteEntity(user, ev) && (
                <button
                  type="button"
                  className={btnGhost + ' !text-danger'}
                  onClick={async () => {
                    if (confirm('Supprimer cet événement ?')) {
                      await deleteEvent(ev.id, user)
                      flash('Événement supprimé.')
                    }
                  }}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <Modal open={open} title="Nouvel événement" onClose={() => setOpen(false)}>
        <form onSubmit={submit}>
          <Field label="Titre">
            <input
              className={inputClass}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
            />
          </Field>
          <Field label="Description">
            <textarea
              className={inputClass}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label="Date">
              <input
                type="date"
                className={inputClass}
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                required
              />
            </Field>
            <Field label="Heure">
              <input
                type="time"
                className={inputClass}
                value={form.time}
                onChange={(e) => setForm({ ...form, time: e.target.value })}
                required
              />
            </Field>
          </div>
          <Field label="Participants">
            <div className="flex flex-wrap gap-2 rounded-xl border border-sage-200 bg-white p-3">
              {users
                .filter((u) => u.id !== user.id)
                .map((u) => {
                  const on = form.participantIds.includes(u.id)
                  return (
                    <button
                      key={u.id}
                      type="button"
                      className={`min-h-11 rounded-lg px-2.5 py-2 text-xs ${
                        on ? 'bg-sage-700 text-white' : 'bg-sage-100 text-sage-700'
                      }`}
                      onClick={() =>
                        setForm({
                          ...form,
                          participantIds: on
                            ? form.participantIds.filter((id) => id !== u.id)
                            : [...form.participantIds, u.id],
                        })
                      }
                    >
                      {u.fullName}
                    </button>
                  )
                })}
              {users.length <= 1 && (
                <p className="text-xs text-sage-500">Invitez d’autres comptes pour collaborer.</p>
              )}
            </div>
          </Field>
          <ModalActions>
            <button type="submit" className={btnPrimary + ' w-full sm:w-auto'}>
              Planifier
            </button>
          </ModalActions>
        </form>
      </Modal>
    </div>
  )
}

function SearchView({ notes, ideas, projects, events, files = [], budgets = [], risks = [] }) {
  const [q, setQ] = useState('')
  const [category, setCategory] = useState('')
  const [status, setStatus] = useState('')
  const [tag, setTag] = useState('')
  const [projectId, setProjectId] = useState('')
  const [external, setExternal] = useState([])
  const [extBusy, setExtBusy] = useState(false)
  const [extErr, setExtErr] = useState('')

  const query = q.trim().toLowerCase()

  const internal = useMemo(() => {
    const matchText = (obj) => {
      const blob = `${obj.title || ''} ${obj.name || ''} ${obj.description || ''} ${obj.content || ''} ${(obj.tags || []).join(' ')}`.toLowerCase()
      return !query || blob.includes(query)
    }
    let n = notes.filter(matchText)
    let i = ideas.filter(matchText)
    let p = projects.filter(matchText)
    let e = events.filter(matchText)
    let f = files.filter(matchText)
    let b = budgets.filter(matchText)
    let r = risks.filter(matchText)
    if (category) n = n.filter((x) => x.category === category)
    if (status) {
      i = i.filter((x) => x.status === status)
      p = p.filter((x) => x.status === status)
      r = r.filter((x) => x.status === status)
    }
    if (tag) n = n.filter((x) => (x.tags || []).some((t) => t.toLowerCase().includes(tag.toLowerCase())))
    if (projectId) {
      n = n.filter((x) => x.projectId === projectId)
      f = f.filter((x) => x.projectId === projectId)
      b = b.filter((x) => x.projectId === projectId)
      r = r.filter((x) => x.projectId === projectId)
    }
    const notesById = Object.fromEntries(notes.map((x) => [x.id, x]))
    return [
      ...n.map((x) => ({
        kind: x.parentId ? 'Sous-note' : 'Note',
        parentTitle: x.parentId ? notesById[x.parentId]?.title : '',
        ...x,
      })),
      ...i.map((x) => ({ kind: 'Idée', ...x })),
      ...p.map((x) => ({ kind: 'Projet', ...x })),
      ...e.map((x) => ({ kind: 'Événement', ...x })),
      ...f.map((x) => ({ kind: 'Fichier', title: x.name, ...x })),
      ...b.map((x) => ({ kind: 'Budget', title: x.name, ...x })),
      ...r.map((x) => ({ kind: 'Risque', ...x })),
    ]
  }, [notes, ideas, projects, events, files, budgets, risks, query, category, status, tag, projectId])

  const runExternal = async () => {
    if (!query) return
    setExtBusy(true)
    setExtErr('')
    try {
      const res = await fetch('/api/ai-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'API indisponible')
      const items = (data.results || []).map((r) => ({
        title: r.title,
        snippet: r.snippet,
        url: r.url,
        source: r.source || 'DuckDuckGo',
        searchedAt: data.searchedAt,
      }))
      setExternal(items.slice(0, 12))
      if (!items.length) setExtErr(data.error || 'Aucun résultat externe.')
    } catch {
      setExtErr(
        'Recherche web indisponible. Relancez Vite (dev ou preview) pour activer POST /api/ai-search.',
      )
      setExternal([])
    } finally {
      setExtBusy(false)
    }
  }

  return (
    <div className="space-y-5 animate-fade-up">
      <div className="rounded-2xl border border-sage-200 bg-white/80 p-4">
        <div className="flex flex-wrap gap-2">
          <div className="relative min-w-0 w-full flex-1 md:min-w-[220px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sage-400" size={16} />
            <input
              className={inputClass + ' pl-9'}
              placeholder="Rechercher notes, sous-notes, fichiers, budgets, risques…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <button type="button" className={btnPrimary} onClick={runExternal} disabled={extBusy || !query}>
            <ExternalLink size={16} /> {extBusy ? 'Recherche…' : 'Recherche externe'}
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <select className={inputClass + ' max-w-full md:!w-auto'} value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">Catégorie</option>
            {NOTE_CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <select className={inputClass + ' max-w-full md:!w-auto'} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Statut</option>
            {[...IDEA_STATUSES, ...PROJECT_STATUSES].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <input
            className={inputClass + ' w-full max-w-full md:!w-40'}
            placeholder="Étiquette"
            value={tag}
            onChange={(e) => setTag(e.target.value)}
          />
          <select className={inputClass + ' max-w-full md:!w-auto'} value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            <option value="">Projet</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      <section>
        <h2 className="mb-3 flex items-center gap-2 font-display text-lg text-sage-900">
          <Filter size={16} /> Résultats internes ({internal.length})
        </h2>
        {internal.length === 0 ? (
          <p className="text-sm text-sage-500">Aucun résultat.</p>
        ) : (
          <ul className="space-y-2">
            {internal.map((item) => (
              <li key={`${item.kind}-${item.id}`} className="rounded-xl border border-sage-200 bg-white/70 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-sage-500">{item.kind}</p>
                <p className="font-medium text-sage-900">{item.title}</p>
                <p className="line-clamp-2 text-sm text-sage-600">
                  {item.parentTitle ? `Sous « ${item.parentTitle} » · ` : ''}
                  {item.description || item.content || item.status || ''}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-display text-lg text-sage-900">Web (hors Nazix)</h2>
        {extErr && <p className="mb-2 text-sm text-warn">{extErr}</p>}
        {external.length === 0 && !extErr && (
          <p className="text-sm text-sage-500">Lancez une recherche externe pour ancrer vos contenus.</p>
        )}
        {external[0]?.searchedAt && (
          <p className="mb-2 text-xs text-sage-500">
            Recherche du {new Date(external[0].searchedAt).toLocaleString('fr-FR')} · DuckDuckGo — ce ne sont pas des faits Nazix.
          </p>
        )}
        <ul className="space-y-2">
          {external.map((item, idx) => (
            <li key={idx} className="rounded-xl border border-sage-200 bg-white/70 px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-sage-500">Web</p>
              <p className="font-medium text-sage-900">{item.title}</p>
              <p className="text-sm text-sage-600">{item.snippet}</p>
              {item.url && (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-sage-700 underline"
                >
                  {item.source} <ArrowRight size={12} />
                </a>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

function ExportView({ notes, ideas, projects, events, flash }) {
  const rows = buildExportRows({ notes, ideas, projects, events })
  const bundle = {
    exportedAt: new Date().toISOString(),
    notes,
    ideas,
    projects,
    events,
  }

  const run = async (kind) => {
    try {
      if (kind === 'csv') exportCSV(rows)
      if (kind === 'xlsx') exportXLSX(rows)
      if (kind === 'json') exportJSON(bundle)
      if (kind === 'docx') await exportDOCX(buildDocSections({ notes, ideas, projects, events }))
      if (kind === 'pdf')
        exportPDF('Export Nazix', buildPdfTables({ notes, ideas, projects, events }))
      flash(`Export ${kind.toUpperCase()} téléchargé.`)
    } catch (err) {
      flash(err.message || 'Échec export', 'err')
    }
  }

  return (
    <div className="animate-fade-up">
      <p className="mb-4 max-w-2xl text-sm text-sage-600">
        Générez un fichier à partir des entités visibles pour votre compte. Encodage UTF-8 BOM pour
        CSV / XLSX.
      </p>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {[
          ['csv', 'CSV (Excel UTF-8)'],
          ['xlsx', 'XLSX'],
          ['docx', 'DOCX (rapport)'],
          ['json', 'JSON (brut)'],
          ['pdf', 'PDF'],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => run(id)}
            className="rounded-2xl border border-sage-200 bg-white/80 p-5 text-left transition hover:border-sage-500 hover:bg-sage-50"
          >
            <Download className="text-sage-600" size={22} />
            <p className="mt-3 font-display text-lg text-sage-900">{label}</p>
            <p className="text-xs text-sage-500">{rows.length} lignes consolidées</p>
          </button>
        ))}
      </div>
    </div>
  )
}

function NotificationsView({ notifications, flash, user }) {
  return (
    <div className="space-y-4 animate-fade-up">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={btnPrimary}
          onClick={async () => {
            await markAllNotificationsRead(user.id)
            flash('Toutes marquées comme lues.')
          }}
        >
          <Check size={16} /> Tout marquer lu
        </button>
      </div>
      {notifications.length === 0 ? (
        <EmptyState title="Aucune notification" hint="Les invitations et partages apparaîtront ici." />
      ) : (
        <ul className="space-y-2">
          {notifications.map((n) => (
            <li
              key={n.id}
              className={`rounded-2xl border px-4 py-3 ${
                n.read ? 'border-sage-200 bg-white/50' : 'border-sage-400 bg-sage-100'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-sage-900">{n.title}</p>
                  <p className="text-sm text-sage-700">{n.body}</p>
                  <p className="mt-1 text-xs text-sage-500">
                    {new Date(n.createdAt).toLocaleString('fr-FR')}
                  </p>
                </div>
                {!n.read && (
                  <button
                    type="button"
                    className={btnGhost}
                    onClick={() => markNotificationRead(n.id)}
                  >
                    Lu
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function SettingsView({ user, session, users, flash, onUserUpdated, allowExternal, onAllowExternal }) {
  const [fullName, setFullName] = useState(user.fullName)
  const [code, setCode] = useState('')
  const [diag, setDiag] = useState(null)
  const sessions = listSessionsForUser(user.id)

  useEffect(() => {
    setFullName(user.fullName)
  }, [user])

  return (
    <div className="space-y-6 animate-fade-up">
      <section className="rounded-2xl border border-sage-200 bg-white/80 p-5">
        <h2 className="flex items-center gap-2 font-display text-lg text-sage-900">
          <Users size={18} /> Profil
        </h2>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          <Field label="Nom complet">
            <input className={inputClass} value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </Field>
          <Field label="E-mail">
            <input className={inputClass} value={user.email} disabled />
          </Field>
          <Field label="Rôle">
            <input className={inputClass} value={user.role} disabled />
          </Field>
          <Field label="E-mail vérifié">
            <input className={inputClass} value={user.emailVerified ? 'Oui' : 'Non'} disabled />
          </Field>
        </div>
        <button
          type="button"
          className={btnPrimary + ' mt-2'}
          onClick={async () => {
            await updateProfile(user.id, { fullName })
            await onUserUpdated()
            flash('Profil mis à jour.')
          }}
        >
          Enregistrer le profil
        </button>

        {!user.emailVerified && (
          <div className="mt-4 rounded-xl border border-warn/30 bg-warn/10 p-3">
            <p className="text-sm text-sage-800">
              Cliquez le lien dans l’e-mail Firebase, ou saisissez le code à 6 chiffres reçu dans
              vos notifications (secours).
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <input
                className={inputClass + ' w-full max-w-full md:!w-40'}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="123456"
              />
              <button
                type="button"
                className={btnPrimary}
                onClick={async () => {
                  try {
                    await verifyEmail(user.id, code)
                    await onUserUpdated()
                    flash('E-mail vérifié.')
                  } catch (err) {
                    flash(err.message, 'err')
                  }
                }}
              >
                Vérifier
              </button>
              <button
                type="button"
                className={btnGhost}
                onClick={async () => {
                  try {
                    await verifyEmail(user.id, '')
                    await onUserUpdated()
                    flash('E-mail vérifié via Firebase.')
                  } catch (err) {
                    flash(err.message, 'err')
                  }
                }}
              >
                J’ai cliqué le lien
              </button>
              <button
                type="button"
                className={btnGhost}
                onClick={async () => {
                  try {
                    await resendVerificationEmail()
                    flash('E-mail de vérification renvoyé.')
                  } catch (err) {
                    flash(err.message, 'err')
                  }
                }}
              >
                <Mail size={14} /> Renvoyer l’e-mail de vérification
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-sage-200 bg-white/80 p-5">
        <h2 className="flex items-center gap-2 font-display text-lg text-sage-900">
          <Shield size={18} /> Sessions actives
        </h2>
        <ul className="mt-3 space-y-2">
          {sessions.map((s) => (
            <li
              key={s.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-sage-50 px-3 py-2 text-sm"
            >
              <div>
                <p className="font-medium text-sage-900">
                  {s.active ? 'Active' : 'Révoquée'}
                  {session?.id === s.id ? ' · session courante' : ''}
                </p>
                <p className="text-xs text-sage-500">
                  Créée {new Date(s.createdAt).toLocaleString('fr-FR')} · expire{' '}
                  {new Date(s.expiresAt).toLocaleString('fr-FR')}
                </p>
              </div>
              {s.active && (
                <button
                  type="button"
                  className={btnGhost + ' !text-danger'}
                  onClick={async () => {
                    await revokeSession(s.id, user)
                    await onUserUpdated()
                    flash('Session révoquée.')
                  }}
                >
                  Révoquer
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>

      <AiSettingsBlock user={user} allowExternal={allowExternal} onChange={onAllowExternal} />

      <section className="rounded-2xl border border-sage-200 bg-white/80 p-5">
        <h2 className="flex items-center gap-2 font-display text-lg text-sage-900">
          <FolderOpen size={18} /> Fichiers
        </h2>
        <p className="mt-2 text-sm text-sage-700">
          Taille maximale : <strong>{maxFileSizeLabel()}</strong> (constante{' '}
          <code className="rounded bg-sage-100 px-1">MAX_FILE_BYTES</code> = {MAX_FILE_BYTES} octets).
        </p>
        <p className="mt-1 text-sm text-sage-600">
          Types autorisés : {ALLOWED_FILE_EXTS.join(', ')}. Exécutables, HTML, SVG et scripts (XSS) sont
          bloqués.
        </p>
        <p className="mt-2 text-xs text-sage-500">
          La région Firebase Storage ne peut pas être définie depuis le client. Choisissez-la dans
          Firebase Console <strong>avant</strong> de créer le bucket. Bucket attendu :{' '}
          <code className="rounded bg-sage-100 px-1">partagio.firebasestorage.app</code>.
        </p>
      </section>

      <section className="rounded-2xl border border-sage-200 bg-white/80 p-5">
        <h2 className="flex items-center gap-2 font-display text-lg text-sage-900">
          <Database size={18} /> Diagnostic Firebase / déploiement
        </h2>
        <p className="mt-2 text-sm text-sage-600">
          Mode actuel : <strong>{getBackendMode()}</strong>
          {firebaseConfigured
            ? ' — Auth + Firestore actifs. Vérification et reset passent par les e-mails Firebase. Collez firestore.rules (isolation) dans la console.'
            : ' — repli localStorage. Remplissez VITE_FIREBASE_* dans .env puis redémarrez Vite pour brancher Firebase.'}
        </p>
        {!firebaseConfigured && (
          <div className="mt-3 rounded-xl border border-warn/30 bg-warn/10 p-3 text-sm text-sage-800">
            <p className="font-medium">Firebase n’est pas configuré sur cet environnement.</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs text-sage-700">
              <li>
                Copiez <code className="rounded bg-white px-1">.env.example</code> vers{' '}
                <code className="rounded bg-white px-1">.env</code>
              </li>
              <li>
                Collez les clés de la console Firebase (apiKey, authDomain, projectId,
                storageBucket, messagingSenderId, appId)
              </li>
              <li>Authentication → Sign-in method → E-mail/mot de passe : activer</li>
              <li>
                Firestore Database : coller <code className="rounded bg-white px-1">firestore.rules</code>{' '}
                (isolation par utilisateur) dans la console
              </li>
              <li>Redémarrer <code className="rounded bg-white px-1">npm run dev</code></li>
            </ol>
            <p className="mt-2 text-xs text-sage-600">
              Variables manquantes : {missingFirebaseVars.join(', ') || 'aucune'}
            </p>
          </div>
        )}
        {firebaseConfigured && (
          <p className="mt-2 text-xs text-sage-500">
            Projet {getFirebaseStatus().projectId} · Auth{' '}
            {getFirebaseStatus().authReady ? 'OK' : 'indisponible'} · Firestore{' '}
            {getFirebaseStatus().firestoreReady ? 'OK' : 'indisponible'} · Storage{' '}
            {getFirebaseStatus().storageReady ? 'OK' : 'indisponible'}
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className={btnGhost}
            onClick={() => setDiag(diagnoseDatabase())}
          >
            <RefreshCw size={14} /> Diagnostiquer
          </button>
          <button
            type="button"
            className={btnGhost}
            onClick={async () => {
              const kit = await exportDeploymentKit()
              exportJSON(kit, 'nazix-deployment-kit.json')
              flash('Kit d’exportation téléchargé.')
            }}
          >
            <Download size={14} /> Kit d’exportation
          </button>
          {isAdmin(user) && (
            <>
              <button
                type="button"
                className={btnGhost}
                onClick={async () => {
                  try {
                    setDiag(await pushLocalToFirebase())
                    flash('Poussée vers Firebase OK.')
                  } catch (err) {
                    flash(err.message, 'err')
                  }
                }}
              >
                Push → Firebase
              </button>
              <button
                type="button"
                className={btnGhost}
                onClick={async () => {
                  try {
                    setDiag(await pullFirebaseToLocal())
                    flash('Pull Firebase OK.')
                  } catch (err) {
                    flash(err.message, 'err')
                  }
                }}
              >
                Pull ← Firebase
              </button>
            </>
          )}
        </div>
        {diag && (
          <pre className="mt-4 overflow-x-auto rounded-xl bg-sage-900 p-4 text-xs text-sage-100 xx-scroll">
            {JSON.stringify(diag, null, 2)}
          </pre>
        )}
      </section>

      {isAdmin(user) && (
        <section className="rounded-2xl border border-sage-200 bg-white/80 p-5">
          <h2 className="font-display text-lg text-sage-900">Utilisateurs ({users.length})</h2>
          <p className="mt-1 text-xs text-sage-500">
            Changez le rôle de chaque compte. Enregistré dans Firestore <code>xx_users.role</code>.
          </p>
          <ul className="mt-3 divide-y divide-sage-100 text-sm">
            {users.map((u) => (
              <li key={u.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="min-w-0 flex-1 break-all md:truncate md:break-normal">
                  {u.fullName} · {u.email}
                </span>
                <select
                  className={inputClass + ' w-full md:!w-auto py-1.5'}
                  value={u.role}
                  onChange={async (e) => {
                    try {
                      await updateUserRole(u.id, e.target.value, user)
                      await onUserUpdated()
                      flash(`Rôle de ${u.fullName} : ${e.target.value}`)
                    } catch (err) {
                      flash(err.message, 'err')
                    }
                  }}
                >
                  {Object.values(ROLES).map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function TeamView({ users, presentIds }) {
  const present = new Set(presentIds)
  const sorted = [...users].sort((a, b) =>
    String(a.fullName || '').localeCompare(String(b.fullName || ''), 'fr'),
  )

  if (sorted.length === 0) {
    return <EmptyState title="Personne pour l’instant" hint="Les comptes inscrits apparaîtront ici." />
  }

  return (
    <div className="space-y-3 animate-fade-up">
      <p className="text-sm text-sage-600">{sorted.length} personne{sorted.length > 1 ? 's' : ''}.</p>
      <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {sorted.map((u) => {
          const online = present.has(u.id)
          return (
            <li
              key={u.id}
              className="flex items-start gap-3 rounded-2xl border border-sage-200 bg-white/80 p-4"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sage-200 font-display text-lg text-sage-800">
                {(u.fullName || u.email || '?').slice(0, 1).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="min-w-0 break-words font-medium text-sage-900">{u.fullName || '—'}</p>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      online ? 'bg-ok/15 text-ok' : 'bg-sage-100 text-sage-500'
                    }`}
                  >
                    {online ? 'En ligne' : 'Hors ligne'}
                  </span>
                </div>
                <p className="break-all text-sm text-sage-600 md:truncate md:break-normal">{u.email}</p>
                <p className="mt-1 text-xs text-sage-500">{u.role}</p>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function ChatView({ user, groups, messages, users, flash, readMap, onReadGroup }) {
  const [selectedId, setSelectedId] = useState(null)
  const [draft, setDraft] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [groupName, setGroupName] = useState('')
  const [picked, setPicked] = useState([])
  const [busy, setBusy] = useState(false)
  const bottomRef = useRef(null)
  const onReadRef = useRef(onReadGroup)
  onReadRef.current = onReadGroup

  useEffect(() => {
    ensureGeneralGroup(user).catch((err) => flash(err.message || 'Chat indisponible.', 'err'))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per user session
  }, [user.id])

  useEffect(() => {
    if (selectedId) return
    const general = groups.find((g) => g.isGeneral) || groups[0]
    if (general) setSelectedId(general.id)
  }, [groups, selectedId])

  const selected = groups.find((g) => g.id === selectedId) || null
  const thread = selected
    ? messages.filter((m) => m.groupId === selected.id)
    : []

  useEffect(() => {
    if (selectedId) onReadRef.current(selectedId)
  }, [selectedId, thread.length])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [thread.length, selected?.id])

  const nameOf = (id, fallback) => users.find((u) => u.id === id)?.fullName || fallback || 'Membre'

  const submitMessage = async (e) => {
    e.preventDefault()
    if (!selected) return
    const text = draft.trim()
    if (!text) return
    setBusy(true)
    try {
      await sendMessage(selected.id, text, user)
      setDraft('')
    } catch (err) {
      flash(err.message, 'err')
    } finally {
      setBusy(false)
    }
  }

  const createGroup = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      const saved = await saveGroup({ name: groupName, memberIds: picked }, user)
      flash('Groupe créé.')
      setCreateOpen(false)
      setGroupName('')
      setPicked([])
      setSelectedId(saved.id)
    } catch (err) {
      flash(err.message, 'err')
    } finally {
      setBusy(false)
    }
  }

  const invite = async (e) => {
    e.preventDefault()
    if (!selected) return
    setBusy(true)
    try {
      await inviteToGroup(selected.id, picked, user)
      flash('Membres ajoutés.')
      setInviteOpen(false)
      setPicked([])
    } catch (err) {
      flash(err.message, 'err')
    } finally {
      setBusy(false)
    }
  }

  const unreadIn = (groupId) =>
    messages.filter((m) => {
      if (m.groupId !== groupId || m.authorId === user.id) return false
      const seen = readMap[groupId]
      return !seen || m.createdAt > seen
    }).length

  const showThread = Boolean(selected)
  const outsiders = users.filter((u) => u.id !== user.id && !(selected?.memberIds || []).includes(u.id))

  return (
    <div className="flex min-h-[calc(100dvh-8rem)] flex-col overflow-hidden rounded-2xl border border-sage-200 bg-white/80 lg:min-h-[72vh] lg:flex-row">
      <aside
        className={`${showThread ? 'hidden lg:flex' : 'flex'} w-full min-w-0 flex-col border-sage-200 lg:w-72 lg:shrink-0 lg:border-r`}
      >
        <div className="flex items-center justify-between gap-2 border-b border-sage-100 p-3">
          <p className="font-display text-lg text-sage-900">Groupes</p>
          {canWriteRole(user) && (
            <button
              type="button"
              className={btnPrimary + ' !px-3'}
              onClick={() => {
                setPicked([])
                setGroupName('')
                setCreateOpen(true)
              }}
            >
              <Plus size={16} />
              <span className="sm:inline">Nouveau</span>
            </button>
          )}
        </div>
        {groups.length === 0 ? (
          <p className="p-4 text-sm text-sage-500">Aucun groupe.</p>
        ) : (
          <ul className="flex-1 overflow-y-auto xx-scroll">
            {groups.map((g) => {
              const n = unreadIn(g.id)
              const active = selectedId === g.id
              return (
                <li key={g.id}>
                  <button
                    type="button"
                    className={`flex min-h-14 w-full items-center gap-2 px-4 py-3 text-left ${
                      active ? 'bg-sage-100' : 'hover:bg-sage-50'
                    }`}
                    onClick={() => setSelectedId(g.id)}
                  >
                    <span className="min-w-0 flex-1 truncate font-medium text-sage-900">{g.name}</span>
                    {n > 0 && (
                      <span className="rounded-full bg-sage-700 px-2 py-0.5 text-[11px] font-bold text-white">
                        {n}
                      </span>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </aside>

      <section className={`${showThread ? 'flex' : 'hidden lg:flex'} min-h-[calc(100dvh-8rem)] min-w-0 flex-1 flex-col lg:min-h-0`}>
        {!selected ? (
          <div className="flex flex-1 items-center justify-center p-6">
            <EmptyState title="Choisissez un groupe" hint="Ouvrez Général ou créez un groupe." />
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 border-b border-sage-100 px-2 py-2 md:px-4">
              <button
                type="button"
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg p-2 text-sage-700 hover:bg-sage-100 lg:hidden"
                onClick={() => setSelectedId(null)}
                aria-label="Retour aux groupes"
              >
                <ChevronLeft size={20} />
              </button>
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-lg text-sage-900">{selected.name}</p>
                <p className="truncate text-xs text-sage-500">
                  {(selected.memberIds || []).length} membre{(selected.memberIds || []).length > 1 ? 's' : ''}
                </p>
              </div>
              <button
                type="button"
                className={btnGhost + ' shrink-0 !px-3'}
                onClick={() => {
                  setPicked([])
                  setInviteOpen(true)
                }}
              >
                <UserPlus size={16} />
                <span className="hidden md:inline">Inviter</span>
              </button>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto px-3 py-4 xx-scroll md:px-5">
              {thread.length === 0 ? (
                <p className="text-center text-sm text-sage-500">Aucun message. Écrivez le premier.</p>
              ) : (
                thread.map((m) => {
                  const mine = m.authorId === user.id
                  return (
                    <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm sm:max-w-[70%] ${
                          mine ? 'bg-sage-700 text-sage-50' : 'bg-sage-100 text-sage-900'
                        }`}
                      >
                        {!mine && (
                          <p className="mb-0.5 text-[11px] font-semibold opacity-80">
                            {nameOf(m.authorId, m.authorName)}
                          </p>
                        )}
                        <p className="whitespace-pre-wrap break-words">{m.body}</p>
                        <p className={`mt-1 text-[10px] ${mine ? 'text-sage-200' : 'text-sage-500'}`}>
                          {m.createdAt ? new Date(m.createdAt).toLocaleString('fr-FR') : ''}
                        </p>
                      </div>
                    </div>
                  )
                })
              )}
              <div ref={bottomRef} />
            </div>
            <form onSubmit={submitMessage} className="flex gap-2 border-t border-sage-100 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <input
                className={inputClass + ' min-w-0'}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Écrire un message…"
                maxLength={4000}
              />
              <button type="submit" className={btnPrimary + ' min-w-11 shrink-0 !px-4'} disabled={busy || !draft.trim()} aria-label="Envoyer">
                <Send size={16} />
              </button>
            </form>
          </>
        )}
      </section>

      <Modal open={createOpen} title="Nouveau groupe" onClose={() => setCreateOpen(false)}>
        <form onSubmit={createGroup}>
          <Field label="Nom">
            <input
              className={inputClass}
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              required
            />
          </Field>
          <Field label="Inviter">
            <div className="flex flex-wrap gap-2 rounded-xl border border-sage-200 bg-white p-3">
              {users.filter((u) => u.id !== user.id).length === 0 && (
                <p className="text-xs text-sage-500">Aucun autre compte.</p>
              )}
              {users
                .filter((u) => u.id !== user.id)
                .map((u) => {
                  const on = picked.includes(u.id)
                  return (
                    <button
                      key={u.id}
                      type="button"
                      className={`min-h-11 rounded-lg px-3 py-2 text-sm ${
                        on ? 'bg-sage-700 text-white' : 'bg-sage-100 text-sage-700'
                      }`}
                      onClick={() =>
                        setPicked(on ? picked.filter((id) => id !== u.id) : [...picked, u.id])
                      }
                    >
                      {u.fullName}
                    </button>
                  )
                })}
            </div>
          </Field>
          <ModalActions>
            <button type="submit" className={btnPrimary + ' w-full sm:w-auto'} disabled={busy}>
              Créer
            </button>
          </ModalActions>
        </form>
      </Modal>

      <Modal open={inviteOpen} title="Inviter dans le groupe" onClose={() => setInviteOpen(false)}>
        <form onSubmit={invite}>
          {outsiders.length === 0 ? (
            <p className="text-sm text-sage-600">Tout le monde est déjà membre.</p>
          ) : (
            <div className="flex flex-wrap gap-2 rounded-xl border border-sage-200 bg-white p-3">
              {outsiders.map((u) => {
                const on = picked.includes(u.id)
                return (
                  <button
                    key={u.id}
                    type="button"
                    className={`min-h-11 rounded-lg px-3 py-2 text-sm ${
                      on ? 'bg-sage-700 text-white' : 'bg-sage-100 text-sage-700'
                    }`}
                    onClick={() =>
                      setPicked(on ? picked.filter((id) => id !== u.id) : [...picked, u.id])
                    }
                  >
                    {u.fullName}
                  </button>
                )
              })}
            </div>
          )}
          <ModalActions>
            <button
              type="submit"
              className={btnPrimary + ' w-full sm:w-auto'}
              disabled={busy || picked.length === 0}
            >
              Ajouter
            </button>
          </ModalActions>
        </form>
      </Modal>
    </div>
  )
}
