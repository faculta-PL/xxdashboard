/** Nazix — notes, idées, projets, équipe */
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  LayoutDashboard,
  StickyNote,
  Lightbulb,
  FolderKanban,
  CalendarDays,
  Search,
  Download,
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
  ChevronRight,
  ChevronDown,
  Volume2,
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
  AlertTriangle,
  BoxSelect,
  Link2,
  Sparkles,
  Gamepad2,
  Mic,
  Star,
} from 'lucide-react'
import ImportModal from './ImportModal'
import CanvasView from './CanvasView'
import { AssistantFab, AssistantPanel, AssistantView, AiSettingsBlock } from './Assistant'
import { EmptyState, PriorityBadge, VisibilityBadge } from './components/ui'
import { Sidebar, NAV_FLAT, readNavCollapsed } from './components/Sidebar'
import DashboardView from './components/DashboardView'
import TodosView from './views/Todos'
import { FeedbackBoard } from './feedback'
import { StableChatPane } from './chat'
import MiniApp, { isMiniRequest } from './MiniApp'
import { useAutosave, useFormDraft } from './lib/formDraft'
import { InstallBanner, OrgAdmin, OrgGate, OrgHome, OrgSwitcher, SyncBadge } from './org/OrgScreens'
import CreateToolsView from './CreateToolsView'
import VoiceModal from './VoiceModal'
import { DocumentBody, NoteCardExcerpt, NoteLinkedFiles } from './NoteMedia'
import { LangToggle, useI18n, calendarLabels, dateLocale, landingPlanPoints, valueLabel } from './i18n'
import { GuideView } from './onboarding/GuideView'
import { GuideOverlay } from './onboarding/GuideOverlay'
import { ModuleIntro, HelpHeaderButton } from './onboarding/ModuleIntro'
import { DemoGrid } from './onboarding/DemoClips'
import { EmailNoticeModal } from './onboarding/EmailNotice'
import { readGuideDone } from './onboarding/guideContent'
import {
  verifyUserMessage,
  resetUserMessage,
  VERIFY_EMAIL,
  RESET_EMAIL,
  firebaseUnavailableLine,
} from './lib/emailCopy'
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
  saveTodoList,
  deleteTodoList,
  saveTodo,
  deleteTodo,
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
  toUserMessage,
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
  resolveOrganizations,
  selectOrganization,
  listOrgMemberships,
  getActiveOrgId,
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
  searchWeb,
  WEB_EMPTY_MESSAGE,
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
import {
  addMonths,
  formatDayLong,
  formatMonthTitle,
  groupEventsByDate,
  monthCells,
  parseIsoDate,
  toIsoDate,
  weekDates,
} from './lib/calendar'
import { bindNotifAudioUnlock, playNotifBeep, readSoundPref, writeSoundPref } from './lib/notifSound'

const GamesHub = lazy(() => import('./games/GamesHub.jsx'))

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

const inputClass =
  'w-full min-h-11 rounded-xl border border-sage-300 bg-white px-3 py-2.5 text-sage-900 outline-none ring-sage-400 placeholder:text-sage-400 focus:ring-2'
const btnPrimary =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-sage-700 px-4 py-2.5 text-sm font-semibold text-sage-50 transition hover:bg-sage-800 disabled:opacity-50'
const btnGhost =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-sage-300 bg-white/70 px-3 py-2 text-sm font-medium text-sage-800 transition hover:bg-sage-100'
const btnCardAction =
  'inline-flex min-h-10 min-w-10 items-center justify-center gap-1.5 rounded-xl border border-sage-500 bg-white px-2.5 py-2 text-xs font-semibold text-sage-800 shadow-sm transition hover:border-sage-700 hover:bg-sage-100 sm:text-sm'

function CardActionButton({ icon: Icon, label, onClick, danger = false, title }) {
  const text = title || label
  return (
    <button
      type="button"
      className={`${btnCardAction}${danger ? ' !border-danger/50 !text-danger hover:!border-danger hover:!bg-red-50' : ''}`}
      onClick={onClick}
      title={text}
      aria-label={text}
    >
      <Icon size={16} strokeWidth={2.25} className="shrink-0 text-current" aria-hidden="true" />
      <span>{label}</span>
    </button>
  )
}

function entityAuthorName(users, entity, selfId, fallback = '') {
  if (!entity?.ownerId || entity.ownerId === selfId) return null
  const u = users.find((x) => x.id === entity.ownerId)
  return u?.fullName || entity.ownerEmail || fallback
}

function Modal({
  open,
  title,
  onClose,
  children,
  wide,
  asForm = false,
  onSubmit,
  footer,
  submitLabel,
  cancelLabel,
  busy = false,
  danger = false,
}) {
  const { t } = useI18n()
  const saveLabel = submitLabel || t('common.save')
  const cancelText = cancelLabel || t('common.cancel')
  const bodyRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', onKey)
    const frame = window.requestAnimationFrame(() => {
      if (bodyRef.current) bodyRef.current.scrollTop = 0
    })
    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose, title])

  if (!open || typeof document === 'undefined') return null

  const showDefaultFooter = footer === undefined && asForm
  let footerNode = null
  if (footer === null) footerNode = null
  else if (footer !== undefined) footerNode = footer
  else if (showDefaultFooter) {
    footerNode = (
      <>
        <button type="button" className={btnGhost + ' w-full sm:w-auto'} onClick={onClose} disabled={busy}>
          {cancelText}
        </button>
        <button
          type="submit"
          className={`${btnPrimary} w-full sm:w-auto${danger ? ' !bg-danger hover:!bg-danger/90' : ''}`}
          disabled={busy}
        >
          {busy ? '…' : saveLabel}
        </button>
      </>
    )
  }

  const Tag = asForm ? 'form' : 'div'
  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-ink/45 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="nazix-modal-title"
    >
      <button type="button" className="absolute inset-0 cursor-default" aria-label={t('common.close')} onClick={onClose} />
      <Tag
        className={`relative z-10 flex max-h-[90vh] w-full max-w-full flex-col overflow-hidden rounded-t-2xl bg-sage-50 shadow-2xl animate-fade-up sm:rounded-2xl ${
          wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'
        }`}
        onSubmit={
          asForm
            ? (e) => {
                e.preventDefault()
                onSubmit?.(e)
              }
            : undefined
        }
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-20 flex shrink-0 items-start justify-between gap-3 border-b border-sage-200 bg-sage-50 px-4 py-3 sm:px-5">
          <h3 id="nazix-modal-title" className="min-w-0 break-words font-display text-xl text-sage-900">
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg p-2 text-sage-600 hover:bg-sage-200"
            aria-label={t('common.close')}
          >
            <X size={18} />
          </button>
        </div>
        <div ref={bodyRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4 xx-scroll sm:px-5">
          {children}
        </div>
        {footerNode ? (
          <div className="sticky bottom-0 z-20 flex shrink-0 flex-col-reverse gap-2 border-t border-sage-200 bg-sage-50 px-4 py-3 sm:flex-row sm:justify-end sm:px-5 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {footerNode}
          </div>
        ) : null}
      </Tag>
    </div>,
    document.body,
  )
}

function ModalActions({ children, onCancel }) {
  const { t } = useI18n()
  return (
    <div className="sticky bottom-0 z-10 -mx-4 mt-4 flex flex-col-reverse gap-2 border-t border-sage-200 bg-sage-50 px-4 py-3 sm:-mx-5 sm:flex-row sm:justify-end sm:px-5 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      {onCancel ? (
        <button type="button" className={btnGhost + ' w-full sm:w-auto'} onClick={onCancel}>
          {t('common.cancel')}
        </button>
      ) : null}
      {children}
    </div>
  )
}

function Field({ label, error, children }) {
  return (
    <label className="mb-3 block text-sm">
      <span className="mb-1 block font-medium text-sage-800">{label}</span>
      {children}
      {error ? (
        <span className="mt-1 block text-sm font-medium text-red-700" role="alert">
          {error}
        </span>
      ) : null}
    </label>
  )
}

function ShareEditor({ users, shares, onChange, excludeId, permissions }) {
  const { t, lang } = useI18n()
  const options = users.filter((u) => u.id !== excludeId)
  const perms = permissions || [
    ['Lecture seule', t('shareUi.readOnly')],
    ['Édition', t('shareUi.edit')],
  ]
  return (
    <div className="space-y-2 rounded-xl border border-sage-200 bg-white p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-sage-500">{t('shareUi.title')}</p>
      {options.length === 0 && (
        <p className="text-sm text-sage-500">{t('shareUi.noCollaborators')}</p>
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
              <option value="">{t('shareUi.none')}</option>
              {perms.map(([value, label]) => (
                <option key={value} value={value}>
                  {value === label ? valueLabel(lang, value, label) : label}
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
  const { t } = useI18n()
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
          <span className="font-medium text-sage-800">{t('shareUi.allTeam')}</span>
          <span className="mt-0.5 block text-xs text-sage-500">
            {t('shareUi.allTeamHint')}
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
  const { t } = useI18n()
  const [booting, setBooting] = useState(true)
  const [db, setDb] = useState(null)
  const [session, setSession] = useState(null)
  const [user, setUser] = useState(null)
  const [view, setView] = useState('dashboard')
  const [mobileNav, setMobileNav] = useState(false)
  const [navCollapsed, setNavCollapsed] = useState(readNavCollapsed)
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
  const [authError, setAuthError] = useState('')
  const [authFieldErrors, setAuthFieldErrors] = useState({})
  const [showPass, setShowPass] = useState(false)
  const toastTimer = useRef(null)
  const authBusyTimer = useRef(null)
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
  const [guideOpen, setGuideOpen] = useState(false)
  const [introForce, setIntroForce] = useState(null)
  const [emailNotice, setEmailNotice] = useState(null)
  const [voiceOpen, setVoiceOpen] = useState(false)
  const [voiceBusy, setVoiceBusy] = useState(false)
  const [pendingAiPrompt, setPendingAiPrompt] = useState('')

  const openImport = (defaults = {}) => {
    setImportDefaults({
      destination: defaults.destination || 'notes',
      projectId: defaults.projectId || '',
      folderId: defaults.folderId || '',
    })
    setImportOpen(true)
  }

  const flash = (message, type = 'ok') => {
    const kind = type === 'error' ? 'err' : type || 'ok'
    const fallback = kind === 'ok' ? String(message || '').trim() || 'OK' : t('errors.generic')
    const text = toUserMessage(message, fallback)
    setToast({ message: text, type: kind })
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), kind === 'ok' ? 3200 : 5600)
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
        if (!cancelled && hint) {
          setToast({ message: hint, type: 'warn' })
          if (toastTimer.current) clearTimeout(toastTimer.current)
          toastTimer.current = setTimeout(() => setToast(null), 5600)
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
      if (toastTimer.current) clearTimeout(toastTimer.current)
      if (authBusyTimer.current) clearTimeout(authBusyTimer.current)
      unsub()
    }
  }, [])

  useEffect(() => {
    setAuthError('')
    setAuthFieldErrors({})
  }, [authMode])

  const orgId = db?.activeOrgId || ''
  const inOrg = (row) => Boolean(orgId) && row?.orgId === orgId
  const allUsers = useMemo(() => (db ? listUsers() : []), [db])
  const users = useMemo(() => {
    if (!db || !user) return []
    const ids = new Set(
      Object.values(db.xx_org_members || {})
        .filter((m) => m.orgId === orgId && m.userId)
        .map((m) => m.userId),
    )
    ids.add(user.id)
    return allUsers.filter((u) => ids.has(u.id))
  }, [db, user, orgId, allUsers])
  const notes = useMemo(
    () =>
      db && user
        ? Object.values(db.xx_notes || {}).filter((n) => inOrg(n) && canReadEntity(user, n))
        : [],
    [db, user, orgId],
  )
  const ideas = useMemo(
    () =>
      db && user
        ? Object.values(db.xx_ideas || {}).filter((i) => inOrg(i) && canReadEntity(user, i))
        : [],
    [db, user, orgId],
  )
  const projects = useMemo(
    () =>
      db && user
        ? Object.values(db.xx_projects || {}).filter((p) => inOrg(p) && canReadEntity(user, p))
        : [],
    [db, user, orgId],
  )
  const events = useMemo(
    () =>
      db && user
        ? Object.values(db.xx_events || {}).filter((e) => inOrg(e) && canReadEntity(user, e))
        : [],
    [db, user, orgId],
  )
  const todoLists = useMemo(
    () =>
      db && user
        ? Object.values(db.xx_todo_lists || {})
            .filter((list) => inOrg(list) && canReadEntity(user, list))
            .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'fr'))
        : [],
    [db, user],
  )
  const todos = useMemo(
    () =>
      db && user
        ? Object.values(db.xx_todos || {}).filter((task) => inOrg(task) && canReadEntity(user, task))
        : [],
    [db, user, orgId],
  )
  const fileCtx = useMemo(
    () => ({ folders: db?.xx_folders || {}, projects: db?.xx_projects || {} }),
    [db],
  )
  const folders = useMemo(
    () =>
      db && user
        ? Object.values(db.xx_folders || {}).filter((f) => inOrg(f) && canReadFileOrFolder(user, f, fileCtx))
        : [],
    [db, user, fileCtx, orgId],
  )
  const files = useMemo(
    () =>
      db && user
        ? Object.values(db.xx_files || {}).filter((f) => inOrg(f) && canReadFileOrFolder(user, f, fileCtx))
        : [],
    [db, user, fileCtx, orgId],
  )
  const projectsById = useMemo(
    () => Object.fromEntries(projects.map((p) => [p.id, p])),
    [projects],
  )
  const budgets = useMemo(
    () =>
      db && user
        ? Object.values(db.xx_budgets || {})
            .filter((b) => inOrg(b) && canReadEntity(user, b))
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
            .filter((r) => inOrg(r) && canReadEntity(user, r))
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
            .filter((n) => n.userId === user.id && inOrg(n))
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        : [],
    [db, user],
  )
  const unread = notifications.filter((n) => !n.read).length
  const unreadReadyRef = useRef(false)
  const unreadPrevRef = useRef(0)
  const unreadArmedAtRef = useRef(0)
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
  const links = useMemo(() => (db ? Object.values(db.xx_links || {}).filter((row) => inOrg(row)) : []), [db, orgId])
  const canvasLayout = useMemo(
    () => (db && user ? db.xx_canvas_layout?.[orgId ? `${user.id}__${orgId}` : user.id] || null : null),
    [db, user, orgId],
  )
  const aiThreads = useMemo(
    () =>
      db && user
        ? Object.values(db.xx_ai_threads || {})
            .filter((thread) => thread.userId === user.id && inOrg(thread))
            .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))
        : [],
    [db, user, orgId],
  )
  const dashboardPrefs = useMemo(
    () => (db && user ? db.xx_dashboard_prefs?.[user.id] || null : null),
    [db, user],
  )
  const gameProfiles = useMemo(() => (db ? Object.values(db.xx_game_profiles || {}) : []), [db])
  const gameScores = useMemo(
    () => (db ? Object.values(db.xx_game_scores || {}).filter((row) => inOrg(row)) : []),
    [db, orgId],
  )
  const memberships = useMemo(() => (user && db ? listOrgMemberships(user) : []), [user, db])
  const memberKey = memberships.map((m) => `${m.id}:${m.role}`).join('|')
  const [orgResolved, setOrgResolved] = useState(false)
  useEffect(() => {
    if (!user) {
      setOrgResolved(false)
      return undefined
    }
    let cancel = false
    resolveOrganizations(user)
      .catch((err) => console.warn('orgs:', err?.message || err))
      .finally(() => {
        if (!cancel) setOrgResolved(true)
      })
    return () => {
      cancel = true
    }
  }, [user?.id, memberKey])
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

  useEffect(() => {
    unreadReadyRef.current = false
    unreadPrevRef.current = 0
    unreadArmedAtRef.current = 0
  }, [user?.id])

  useEffect(() => bindNotifAudioUnlock(), [])

  useEffect(() => {
    if (!user || !db) return
    if (!unreadReadyRef.current) {
      unreadReadyRef.current = true
      unreadPrevRef.current = unread
      unreadArmedAtRef.current = Date.now()
      return
    }
    const hydrating = Date.now() - unreadArmedAtRef.current < 1500
    if (unread > unreadPrevRef.current && !hydrating) playNotifBeep()
    unreadPrevRef.current = unread
  }, [user, db, unread])

  useEffect(() => {
    if (!user) return
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
    document.documentElement.scrollTop = 0
    document.body.scrollTop = 0
    const main = document.getElementById('nazix-main')
    if (main) main.scrollTop = 0
  }, [view, user])

  useEffect(() => {
    if (!user) return
    if (emailNotice) return
    if (readGuideDone()) return
    setGuideOpen(true)
  }, [user, emailNotice])

  const chatUnread = useMemo(() => {
    if (!user) return 0
    return chatMessages.filter((m) => {
      if (m.authorId === user.id) return false
      const seen = chatReadMap[m.groupId]
      return !seen || m.createdAt > seen
    }).length
  }, [chatMessages, chatReadMap, user])

  const handleVoiceConfirm = async ({ dest, text, title, budgetId, shareIds }) => {
    setVoiceBusy(true)
    try {
      const shares = (shareIds || []).map((userId) => ({
        userId,
        permission: dest === 'event' ? 'Lecture seule' : 'Lecture',
      }))
      const visibility = shares.length ? 'Partagée' : 'Privée'
      if (dest === 'ai') {
        setPendingAiPrompt(text)
        setAiOpen(true)
        setAiCollapsed(false)
        setVoiceOpen(false)
        flash(t('voice.sentAi'))
        return
      }
      if (!canWriteRole(user)) {
        flash(t('common.permissionDenied'), 'err')
        return
      }
      let created = null
      if (dest === 'note') {
        created = await saveNote({ title, content: text, category: 'Général', visibility, shares }, user)
        flash(t('voice.createdNote'))
      } else if (dest === 'event') {
        created = await saveEvent(
          {
            title,
            description: text,
            date: toIsoDate(new Date()),
            time: '09:00',
            visibility,
            participantIds: shareIds || [],
            shares,
          },
          user,
        )
        flash(t('voice.createdEvent'))
      } else if (dest === 'idea') {
        created = await saveIdea(
          {
            title,
            description: text,
            status: 'Nouvelle',
            visibility: shares.length ? 'Partagée' : 'Publique',
            shares,
            votes: [],
            history: [{ type: 'create', userId: user.id, label: 'voice', at: new Date().toISOString() }],
          },
          user,
        )
        flash(t('voice.createdIdea'))
      } else if (dest === 'budget') {
        created = await saveBudgetLine(
          {
            budgetId,
            kind: 'planned',
            name: title,
            notes: text,
            amount: 0,
            category: BUDGET_CATEGORIES[0],
          },
          user,
        )
        flash(t('voice.createdBudget'))
      }
      if (shareIds?.length && created) {
        await notifyUsers(
          shareIds.filter((id) => id !== user.id),
          {
            type: 'voice_share',
            title: t('common.share'),
            body: `${user.fullName}: ${title}`,
            meta: { dest, id: created.id },
          },
        )
      }
      setVoiceOpen(false)
    } catch (err) {
      flash(err.message, 'err')
    } finally {
      setVoiceBusy(false)
    }
  }

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
    setAuthError('')
    const fields = {}
    const email = String(authForm.email || '').trim()
    const password = authForm.password
    const minLen = getMinPasswordLength()
    if (authMode === 'login' || authMode === 'register' || authMode === 'forgot') {
      if (!email) fields.email = t('auth.emailRequired')
      else if (!email.includes('@')) fields.email = t('auth.emailInvalid')
    }
    if (authMode === 'login' || authMode === 'register') {
      if (!password) fields.password = t('auth.passwordRequired')
      else if (authMode === 'register' && password.length < minLen) {
        fields.password = t('auth.passwordMin', { n: minLen })
      }
    }
    if (authMode === 'register' && !String(authForm.fullName || '').trim()) {
      fields.fullName = t('auth.nameRequired')
    }
    if (authMode === 'reset') {
      if (!String(authForm.resetToken || '').trim()) fields.resetToken = t('auth.codeRequired')
      if (!authForm.newPassword) fields.newPassword = t('auth.passwordRequired')
      else if (authForm.newPassword.length < minLen) {
        fields.newPassword = t('auth.passwordMin', { n: minLen })
      }
    }
    if (Object.keys(fields).length) {
      setAuthFieldErrors(fields)
      const first = Object.values(fields)[0]
      setAuthError(first)
      flash(first, 'err')
      return
    }
    setAuthFieldErrors({})
    setAuthBusy(true)
    let timedOut = false
    if (authBusyTimer.current) clearTimeout(authBusyTimer.current)
    authBusyTimer.current = setTimeout(() => {
      timedOut = true
      setAuthBusy(false)
      const msg = t('auth.timeout')
      setAuthError(msg)
      flash(msg, 'err')
    }, 12000)
    try {
      if (authMode === 'login') {
        const res = await loginUser(authForm.email, authForm.password)
        setUser(res.user)
        setSession(res.session)
        if (res.warning) flash(res.warning, 'warn')
        else flash(t('auth.sessionOpen'))
      } else if (authMode === 'register') {
        const created = await registerUser(authForm)
        const logged = await loginUser(authForm.email, authForm.password)
        setUser(logged.user)
        setSession(logged.session)
        const notice = {
          kind: 'verify',
          email: String(authForm.email || '').trim().toLowerCase(),
          code: created.verificationCode,
          firebaseSent: Boolean(created.firebaseSent),
        }
        setEmailNotice(notice)
        const msg = verifyUserMessage(notice)
        flash(msg, created.firebaseSent ? 'ok' : 'warn')
        if (logged.warning) flash(logged.warning, 'warn')
      } else if (authMode === 'forgot') {
        const reset = await requestPasswordReset(authForm.email)
        const notice = {
          kind: 'reset',
          email: String(authForm.email || '').trim().toLowerCase(),
          code: reset?.localCode || '',
          firebaseSent: Boolean(reset?.firebaseSent),
        }
        setEmailNotice(notice)
        const msg = reset?.message || resetUserMessage(notice)
        flash(msg, reset?.firebaseSent ? 'ok' : 'warn')
        setAuthError('')
        setAuthMode('reset')
      } else if (authMode === 'reset') {
        await resetPasswordWithToken(authForm.resetToken, authForm.newPassword)
        flash(t('auth.passwordUpdated'))
        setAuthMode('login')
      }
    } catch (err) {
      const msg = toUserMessage(err, t('auth.failed'))
      setAuthError(msg)
      const nextFields = {}
      if (authMode === 'register') {
        if (/nom/i.test(msg) && /requis|saisissez/i.test(msg)) nextFields.fullName = msg
        if (/existe déjà|invalide/i.test(msg)) nextFields.email = msg
        if (/caractères|faible/i.test(msg)) nextFields.password = msg
      }
      if (authMode === 'login') {
        if (/e-mail ou mot de passe|mot de passe incorrect|aucun compte/i.test(msg)) {
          nextFields.email = msg
          nextFields.password = msg
        } else if (/e-mail|adresse/i.test(msg)) nextFields.email = msg
        else if (/mot de passe/i.test(msg)) nextFields.password = msg
      }
      if (authMode === 'reset' && /code|jeton/i.test(msg)) nextFields.resetToken = msg
      if (authMode === 'forgot' && /invalide/i.test(msg)) nextFields.email = msg
      if (Object.keys(nextFields).length) setAuthFieldErrors(nextFields)
      flash(msg, 'err')
    } finally {
      if (authBusyTimer.current) clearTimeout(authBusyTimer.current)
      if (!timedOut) setAuthBusy(false)
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
          <p className="mt-2 animate-soft-pulse text-sm text-sage-600">{t('common.loading')}</p>
        </div>
      </div>
    )
  }

  const openFullNazix = () => {
    const url = new URL(window.location.href)
    url.searchParams.delete('mini')
    if (url.pathname === '/mini') url.pathname = '/'
    window.location.assign(url.toString())
  }

  if (!user) {
    return (
      <>
        <LandingPage
          authMode={authMode}
          setAuthMode={setAuthMode}
          authForm={authForm}
          setAuthForm={setAuthForm}
          authBusy={authBusy}
          showPass={showPass}
          setShowPass={setShowPass}
          handleAuth={handleAuth}
          authError={authError}
          authFieldErrors={authFieldErrors}
          emailNotice={emailNotice}
        />
        {toast && <Toast toast={toast} />}
        <EmailNoticeModal notice={emailNotice} onClose={() => setEmailNotice(null)} />
      </>
    )
  }

  if (!orgResolved) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center">
        <p className="text-sm text-sage-700">{t('orgs.loading')}</p>
      </div>
    )
  }

  if (!orgId) {
    return (
      <>
        <OrgGate user={user} memberships={memberships} onLogout={handleLogout} />
        {toast && <Toast toast={toast} />}
      </>
    )
  }

  if (isMiniRequest()) {
    return (
      <MiniApp
        user={user}
        orgId={orgId}
        notes={notes}
        todos={todos}
        events={events}
        messages={chatMessages}
        syncStatus={db?.syncStatus || 'local'}
        onOpenFull={openFullNazix}
        onLogout={handleLogout}
      />
    )
  }

  if (view === 'games') {
    return (
      <>
        <Suspense
          fallback={
            <div className="flex min-h-[100dvh] items-center justify-center bg-cream-green">
              <p className="font-display text-2xl text-sage-800">{t('gamesUi.loading')}</p>
            </div>
          }
        >
          <GamesHub
            user={user}
            profiles={gameProfiles}
            scores={gameScores}
            flash={flash}
            onBack={() => setView('dashboard')}
          />
        </Suspense>
        {toast && <Toast toast={toast} />}
        <EmailNoticeModal notice={emailNotice} onClose={() => setEmailNotice(null)} />
      </>
    )
  }

  return (
    <div
      className={`min-h-[100dvh] overflow-x-hidden lg:grid ${
        navCollapsed ? 'lg:grid-cols-[72px_minmax(0,1fr)]' : 'lg:grid-cols-[minmax(0,260px)_minmax(0,1fr)]'
      }`}
    >
      <div
        className={`fixed inset-y-0 left-0 z-40 h-full w-[min(260px,100%)] transition motion-reduce:transition-none lg:static lg:h-auto lg:w-auto ${
          mobileNav ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <Sidebar
          user={user}
          view={view}
          onView={(id) => {
            setView(id)
            setMobileNav(false)
          }}
          onCloseMobile={() => setMobileNav(false)}
          onLogout={handleLogout}
          unread={unread}
          chatUnread={chatUnread}
          collapsed={navCollapsed}
          onCollapsed={setNavCollapsed}
        />
      </div>

      {mobileNav && (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-ink/40 lg:hidden"
          aria-label={t('nav.closeMenu')}
          onClick={() => setMobileNav(false)}
        />
      )}

      <div className="relative z-0 min-w-0">
        <header className="sticky top-0 z-20 flex min-h-14 items-center gap-3 border-b border-sage-200/80 bg-cream-green/80 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur">
          <button
            type="button"
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg p-2 text-sage-800 hover:bg-sage-200 lg:hidden"
            onClick={() => setMobileNav(true)}
            aria-label={t('nav.openMenu')}
          >
            <Menu size={20} />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="flex items-center gap-2 truncate font-display text-xl text-sage-900 md:text-2xl">
              {NAV_FLAT.find((n) => n.id === view)?.icon
                ? (() => {
                    const Icon = NAV_FLAT.find((n) => n.id === view).icon
                    return <Icon size={22} className="shrink-0 text-sage-700" aria-hidden="true" />
                  })()
                : null}
              <span className="truncate">{t(`nav.${view}`) || NAV_FLAT.find((n) => n.id === view)?.label}</span>
            </h1>
            {t(`chrome.${view}`) && t(`chrome.${view}`) !== `chrome.${view}` ? (
              <p className="mt-0.5 truncate text-xs text-sage-600">{t(`chrome.${view}`)}</p>
            ) : null}
          </div>
          <OrgSwitcher user={user} activeOrgId={orgId} onSwitch={(id) => selectOrganization(id, user)} />
          <SyncBadge status={db?.syncStatus || 'local'} />
          <button
            type="button"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-sage-300 bg-white/80 px-3 text-sm font-semibold text-sage-800 hover:bg-sage-100"
            onClick={() => setVoiceOpen(true)}
            aria-label={t('voice.dictate')}
          >
            <Mic size={16} aria-hidden="true" />
            <span className="hidden sm:inline">{t('voice.dictate')}</span>
          </button>
          <LangToggle />
          <HelpHeaderButton
            onClick={() => {
              if (view === 'guide') {
                setGuideOpen(true)
                return
              }
              setIntroForce((cur) => (cur === view ? null : view))
            }}
            label={t('nav.help', { label: t(`nav.${view}`) || 'module' })}
          />
          {!user.emailVerified && (
            <span className="hidden rounded-full bg-warn/15 px-3 py-1 text-xs font-semibold text-warn md:inline">
              {t('nav.emailUnverified')}
            </span>
          )}
        </header>

        <main
          id="nazix-main"
          className={`min-w-0 ${view === 'chat' ? 'p-2 md:p-4' : 'p-4 md:p-6'} pb-[max(1.25rem,env(safe-area-inset-bottom))]`}
        >
          {view !== 'guide' && (
            <ModuleIntro
              view={view}
              forceOpen={introForce === view}
              onOpenGuide={() => setView('guide')}
            />
          )}
          {view === 'guide' && (
            <GuideView
              onGoView={(id) => setView(id)}
              onReplayTour={() => {
                setView('dashboard')
                setGuideOpen(true)
              }}
            />
          )}
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
              pendingPrompt={pendingAiPrompt}
              onPendingConsumed={() => setPendingAiPrompt('')}
              onDictate={() => setVoiceOpen(true)}
            />
          )}
          {view === 'create' && <CreateToolsView user={user} flash={flash} />}
          {view === 'feedback' && (
            // FEEDBACK-LAYER START
            <FeedbackBoard user={user} users={users} flash={flash} />
            // FEEDBACK-LAYER END
          )}
          {view === 'important' && (
            <NotesView
              onlyImportant
              user={user}
              notes={notes.filter((n) => n.important)}
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
                setSelectedNoteIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]))
              }
              onDictate={() => setVoiceOpen(true)}
            />
          )}
          {view === 'org' && <OrgHome user={user} activeOrgId={orgId} flash={flash} />}
          {view === 'orgadmin' && isAdmin(user) && <OrgAdmin user={user} flash={flash} peek={db?.orgPeek} />}
          {view === 'dashboard' && (
            <DashboardView
              user={user}
              notes={notes}
              ideas={ideas}
              projects={projects}
              files={files}
              events={events}
              budgets={budgets}
              budgetLines={budgetLines}
              risks={risks}
              riskActions={riskActions}
              chatMessages={chatMessages}
              groups={groups}
              users={users}
              todos={todos}
              storedPrefs={dashboardPrefs}
              onQuick={(v) => setView(v)}
              onImport={() => openImport({ destination: 'notes' })}
              onDictate={() => setVoiceOpen(true)}
            />
          )}
          {view === 'canvas' && (
            <CanvasView
              user={user}
              users={users}
              projects={projects}
              notes={notes}
              ideas={ideas}
              files={files}
              folders={folders}
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
              onDictate={() => setVoiceOpen(true)}
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
          {view === 'todos' && (
            <TodosView
              user={user}
              users={users}
              lists={todoLists}
              tasks={todos}
              flash={flash}
              onSaveList={(data) => saveTodoList(data, user)}
              onDeleteList={(id) => deleteTodoList(id, user)}
              onSaveTask={(data) => saveTodo(data, user)}
              onDeleteTask={(id) => deleteTodo(id, user)}
            />
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
              users={allUsers}
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
            pendingPrompt={pendingAiPrompt}
            onPendingConsumed={() => setPendingAiPrompt('')}
            onDictate={() => setVoiceOpen(true)}
          />
        </>
      )}
      <VoiceModal
        open={voiceOpen}
        onClose={() => setVoiceOpen(false)}
        user={user}
        users={users}
        budgets={budgets}
        busy={voiceBusy}
        onConfirm={handleVoiceConfirm}
      />
      {toast && <Toast toast={toast} />}
      <InstallBanner />
      <EmailNoticeModal notice={emailNotice} onClose={() => setEmailNotice(null)} />
      <GuideOverlay
        open={guideOpen}
        onClose={() => setGuideOpen(false)}
        onGoView={(id) => setView(id)}
      />
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
  authError,
  authFieldErrors,
  emailNotice = null,
}) {
  const { t, lang } = useI18n()
  const [authOpen, setAuthOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [ctaEmail, setCtaEmail] = useState('')
  const [faqOpen, setFaqOpen] = useState(0)
  const landingModules = [
    { id: 'notes', title: t('landing.modNotes'), hint: t('landing.modNotesHint'), icon: StickyNote },
    { id: 'kanban', title: t('landing.modKanban'), hint: t('landing.modKanbanHint'), icon: Columns3 },
    { id: 'projets', title: t('landing.modProjects'), hint: t('landing.modProjectsHint'), icon: FolderKanban },
    { id: 'calendrier', title: t('landing.modCalendar'), hint: t('landing.modCalendarHint'), icon: CalendarDays },
    { id: 'fichiers', title: t('landing.modFiles'), hint: t('landing.modFilesHint'), icon: FolderOpen },
    { id: 'canvas', title: t('landing.modCanvas'), hint: t('landing.modCanvasHint'), icon: BoxSelect },
    { id: 'assistant', title: t('landing.modAssistant'), hint: t('landing.modAssistantHint'), icon: Sparkles },
    { id: 'equipe', title: t('landing.modTeam'), hint: t('landing.modTeamHint'), icon: Users },
    { id: 'chat', title: t('landing.modChat'), hint: t('landing.modChatHint'), icon: MessageCircle },
    { id: 'export', title: t('landing.modExport'), hint: t('landing.modExportHint'), icon: Download },
    { id: 'jeux', title: t('landing.modGames'), hint: t('landing.modGamesHint'), icon: Gamepad2 },
  ]
  const landingPlans = [
    { name: t('landing.planFree'), price: t('landing.planFreePrice'), tag: t('landing.planFreeTag'), points: landingPlanPoints(lang, 'free'), cta: t('landing.planFreeCta') },
    { name: t('landing.planTeam'), price: t('landing.planTeamPrice'), tag: t('landing.planTeamTag'), featured: true, points: landingPlanPoints(lang, 'team'), cta: t('landing.planTeamCta') },
    { name: t('landing.planOrga'), price: t('landing.planOrgaPrice'), tag: t('landing.planOrgaTag'), points: landingPlanPoints(lang, 'orga'), cta: t('landing.planOrgaCta') },
  ]
  const landingFaq = [
    { q: t('landing.faqFirebaseQ'), a: t('landing.faqFirebaseA') },
    { q: t('landing.faqLangQ'), a: t('landing.faqLangA') },
    { q: t('landing.faqRolesQ'), a: t('landing.faqRolesA') },
    { q: t('landing.faqFilesQ'), a: t('landing.faqFilesA') },
  ]

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
            <button type="button" className="hover:text-sage-950" onClick={() => goSection('demo')}>
              {t('landing.demo')}
            </button>
            <button type="button" className="hover:text-sage-950" onClick={() => goSection('fonctionnalites')}>
              {t('landing.features')}
            </button>
            <button type="button" className="hover:text-sage-950" onClick={() => goSection('tarifs')}>
              {t('landing.pricing')}
            </button>
            <button type="button" className="hover:text-sage-950" onClick={() => goSection('ressources')}>
              {t('landing.resources')}
            </button>
          </nav>
          <div className="flex items-center justify-end gap-2 sm:gap-3">
            <LangToggle />
            <button
              type="button"
              className="hidden min-h-11 px-2 text-[15px] font-medium text-sage-800 hover:text-sage-950 sm:inline"
              onClick={() => openAuth('login')}
            >
              {t('landing.login')}
            </button>
            <button
              type="button"
              className="inline-flex min-h-10 items-center rounded-full bg-sage-800 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-sage-900 sm:min-h-11 sm:px-5"
              onClick={() => openAuth('register')}
            >
              {t('landing.freeTrial')}
            </button>
            <button
              type="button"
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full text-sage-800 hover:bg-sage-200/70 lg:hidden"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label={mobileOpen ? t('nav.closeMenu') : t('nav.openMenu')}
            >
              {mobileOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
        {mobileOpen && (
          <div className="border-t border-sage-200/70 bg-[#f5f6f1] px-4 py-3 lg:hidden">
            <div className="flex flex-col gap-1">
              {[
                ['demo', t('landing.demo')],
                ['fonctionnalites', t('landing.features')],
                ['tarifs', t('landing.pricing')],
                ['ressources', t('landing.resources')],
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
                {t('landing.login')}
              </button>
            </div>
          </div>
        )}
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-6 pt-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-8 lg:pb-4 lg:pt-12">
        <div className="max-w-xl animate-fade-up">
          <h1 className="font-display text-[2.35rem] font-medium leading-[1.12] tracking-tight text-sage-900 sm:text-5xl lg:text-[3.35rem]">
            {t('landing.heroTitle')}{' '}
            <span className="align-middle font-display text-[0.55em] font-medium text-sage-700">Nazix</span>
          </h1>
          <p className="mt-5 max-w-md text-[1.05rem] leading-relaxed text-sage-700">
            {t('landing.heroHint')}
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <button
              type="button"
              className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-sage-800 px-6 text-[15px] font-semibold text-white shadow-sm transition hover:bg-sage-900 sm:w-auto"
              onClick={() => openAuth('register')}
            >
              {t('landing.startFree')}
            </button>
            <button
              type="button"
              className="inline-flex min-h-12 w-full items-center justify-center rounded-full border border-sage-300 bg-transparent px-6 text-[15px] font-semibold text-sage-800 transition hover:bg-white/70 sm:w-auto"
              onClick={() => goSection('demo')}
            >
              {t('landing.seeDemo')}
            </button>
          </div>
        </div>
        <div className="relative mx-auto w-full max-w-[640px] animate-fade-up-d4 pb-6 lg:max-w-none lg:pb-10">
          <ProductMockup />
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-3 md:gap-6 lg:py-12">
        {[
          { icon: StickyNote, title: t('landing.featNotes'), hint: t('landing.featNotesHint') },
          { icon: Columns3, title: t('landing.featKanban'), hint: t('landing.featKanbanHint') },
          { icon: MessageCircle, title: t('landing.featChat'), hint: t('landing.featChatHint') },
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
            {t('landing.ctaReady')}
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
              placeholder={t('landing.ctaPlaceholder')}
              value={ctaEmail}
              onChange={(e) => setCtaEmail(e.target.value)}
              autoComplete="email"
              required
            />
            <button
              type="submit"
              className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-full bg-sage-800 px-6 text-sm font-semibold text-white hover:bg-sage-900"
            >
              {t('landing.ctaSignup')}
            </button>
          </form>
        </div>
      </section>

      <section id="demo" className="scroll-mt-24 mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sage-500">{t('landing.demoKicker')}</p>
          <h2 className="mt-2 font-display text-3xl text-sage-900 md:text-4xl">{t('landing.demoTitle')}</h2>
          <p className="mt-3 text-sage-600">{t('landing.demoHint')}</p>
        </div>
        <figure className="mt-8 w-full max-w-3xl">
          <video
            className="aspect-video w-full rounded-2xl border border-sage-200/80 bg-sage-950 shadow-[0_8px_24px_rgba(47,56,44,0.12)]"
            controls
            playsInline
            preload="metadata"
            poster="/nazix-brag.jpg"
          >
            <source src="/nazix-brag.mp4" type="video/mp4" />
          </video>
          <figcaption className="mt-3 text-center text-sm text-sage-600">
            {t('landing.demoVideoCaption')}
          </figcaption>
        </figure>
        <div className="mt-8">
          <DemoGrid />
        </div>
      </section>

      <section id="fonctionnalites" className="scroll-mt-24 mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sage-500">{t('landing.featuresKicker')}</p>
          <h2 className="mt-2 font-display text-3xl text-sage-900 md:text-4xl">
            {t('landing.featuresTitle')}
          </h2>
          <p className="mt-3 text-sage-600">{t('landing.featuresHint')}</p>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {landingModules.map((mod) => {
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
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sage-500">{t('landing.pricingKicker')}</p>
            <h2 className="mt-2 font-display text-3xl text-sage-900 md:text-4xl">{t('landing.pricingTitle')}</h2>
            <p className="mt-3 text-sage-600">{t('landing.pricingHint')}</p>
          </div>
          <div className="mt-10 grid gap-4 lg:grid-cols-3">
            {landingPlans.map((plan) => (
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
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sage-500">{t('landing.faqKicker')}</p>
          <h2 className="mt-2 font-display text-3xl text-sage-900 md:text-4xl">{t('landing.faqTitle')}</h2>
        </div>
        <div className="mt-8 divide-y divide-sage-200 overflow-hidden rounded-2xl border border-sage-200 bg-white/70">
          {landingFaq.map((item, i) => {
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
              {t('landing.footerTagline')}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-sage-500">{t('landing.footerProduct')}</p>
            <ul className="mt-3 space-y-2 text-sm text-sage-700">
              <li>
                <button type="button" className="hover:text-sage-900" onClick={() => goSection('fonctionnalites')}>
                  {t('landing.features')}
                </button>
              </li>
              <li>
                <button type="button" className="hover:text-sage-900" onClick={() => goSection('tarifs')}>
                  {t('landing.pricing')}
                </button>
              </li>
              <li>
                <button type="button" className="hover:text-sage-900" onClick={() => goSection('ressources')}>
                  {t('landing.resources')}
                </button>
              </li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-sage-500">{t('landing.footerAccount')}</p>
            <ul className="mt-3 space-y-2 text-sm text-sage-700">
              <li>
                <button type="button" className="hover:text-sage-900" onClick={() => openAuth('login')}>
                  {t('landing.login')}
                </button>
              </li>
              <li>
                <button type="button" className="hover:text-sage-900" onClick={() => openAuth('register')}>
                  {t('landing.freeTrial')}
                </button>
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-sage-200/80 px-4 py-4 text-center text-xs text-sage-500 sm:px-6">
          {t('landing.footerCopy')}
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
        authError={authError}
        authFieldErrors={authFieldErrors}
        emailNotice={emailNotice}
      />
    </div>
  )
}

function ProductMockup() {
  const { t } = useI18n()
  const mockNav = [LayoutDashboard, StickyNote, Lightbulb, FolderKanban, FolderOpen, MessageCircle]
  return (
    <div className="relative mx-auto aspect-[16/11] w-full max-w-[640px] lg:max-w-none">
      <div className="pointer-events-none absolute -inset-6 rounded-[2.5rem] bg-gradient-to-br from-sage-200/50 via-transparent to-sage-300/30 blur-2xl" />
      <div className="landing-float absolute left-2 top-[18%] z-20 hidden flex-col gap-2 sm:flex sm:left-[-8px] lg:left-[-18px]">
        {[t('nav.notes'), t('nav.ideas'), t('nav.chat')].map((label) => (
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
          <span className="rounded-md bg-sage-100 px-2 py-0.5 text-[10px] font-medium text-sage-600">
            {t('landing.mockDashboard')}
          </span>
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
            <p className="text-[10px] font-semibold text-sage-800">{t('landing.mockNotesIdeas')}</p>
            {[
              [t('landing.mockNote1t'), t('landing.mockNote1d')],
              [t('landing.mockNote2t'), t('landing.mockNote2d')],
              [t('landing.mockNote3t'), t('landing.mockNote3d')],
            ].map(([title, d]) => (
              <div key={title} className="rounded-lg bg-white p-1.5 shadow-sm">
                <p className="text-[9px] font-semibold text-sage-800">{title}</p>
                <p className="text-[8px] leading-snug text-sage-500">{d}</p>
              </div>
            ))}
          </div>
          <div className="flex min-w-0 flex-col overflow-hidden bg-white p-2">
            <p className="mb-1.5 text-[10px] font-semibold text-sage-800">{t('landing.mockKanban')}</p>
            <div className="grid min-h-0 flex-1 grid-cols-3 gap-1.5">
              {[
                ['#dce6d4', [t('landing.mockCol1a'), t('landing.mockCol1b')]],
                ['#edd8d2', [t('landing.mockCol2a'), t('landing.mockCol2b')]],
                ['#efe3c4', [t('landing.mockCol3a'), t('landing.mockCol3b')]],
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
            <p className="mb-1.5 text-[10px] font-semibold text-sage-800">{t('nav.chat')}</p>
            <div className="space-y-1.5">
              <div className="max-w-[90%] rounded-xl rounded-tl-sm bg-sage-100 px-2 py-1 text-[8px] text-sage-800">
                {t('landing.mockChat1')}
              </div>
              <div className="ml-auto max-w-[90%] rounded-xl rounded-tr-sm bg-sage-700 px-2 py-1 text-[8px] text-sage-50">
                {t('landing.mockChat2')}
              </div>
              <div className="max-w-[90%] rounded-xl rounded-tl-sm bg-sage-100 px-2 py-1 text-[8px] text-sage-800">
                {t('landing.mockChat3')}
              </div>
            </div>
            <div className="mt-auto flex items-center gap-1 rounded-full bg-white px-2 py-1 text-[8px] text-sage-400">
              {t('landing.mockWrite')}
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
  authError,
  authFieldErrors = {},
  emailNotice = null,
}) {
  const { t } = useI18n()
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
      ? t('auth.registerTitle')
      : authMode === 'forgot'
        ? t('auth.forgotTitle')
        : authMode === 'reset'
          ? t('auth.resetTitle')
          : t('auth.loginTitle')

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-end sm:items-stretch">
      <button type="button" className="absolute inset-0 bg-ink/40" aria-label={t('auth.close')} onClick={onClose} />
      <div
        className="landing-drawer relative z-10 flex max-h-[min(94dvh,100%)] w-full max-w-full flex-col overflow-hidden rounded-t-2xl bg-[#f5f6f1] shadow-2xl sm:h-full sm:max-h-none sm:w-[26.5rem] sm:rounded-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-sage-200 px-5 py-4 pt-[max(1rem,env(safe-area-inset-top))]">
          <div>
            <p className="font-display text-2xl text-sage-900">{title}</p>
            <p className="mt-0.5 text-sm text-sage-600">
              {authMode === 'register' ? t('auth.registerHint') : t('auth.loginHint')}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg text-sage-600 hover:bg-sage-200"
            aria-label={t('auth.close')}
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
                {t('auth.login')}
              </button>
              <button
                type="button"
                onClick={() => setAuthMode('register')}
                className={`min-h-10 rounded-full font-medium ${
                  authMode === 'register' ? 'bg-sage-800 text-white' : 'text-sage-700'
                }`}
              >
                {t('auth.register')}
              </button>
            </div>
          )}
          <form onSubmit={handleAuth} noValidate>
            {authMode === 'register' && (
              <Field label={t('auth.name')} error={authFieldErrors.fullName}>
                <input
                  className={inputClass}
                  value={authForm.fullName}
                  onChange={(e) => setAuthForm({ ...authForm, fullName: e.target.value })}
                  autoComplete="name"
                />
              </Field>
            )}
            {(authMode === 'login' || authMode === 'register' || authMode === 'forgot') && (
              <Field label={t('auth.email')} error={authFieldErrors.email}>
                <input
                  type="email"
                  className={inputClass}
                  value={authForm.email}
                  onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
                  autoComplete="email"
                />
              </Field>
            )}
            {(authMode === 'login' || authMode === 'register') && (
              <Field label={t('auth.password')} error={authFieldErrors.password}>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    className={inputClass + ' pr-12'}
                    value={authForm.password}
                    onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                    autoComplete={authMode === 'login' ? 'current-password' : 'new-password'}
                  />
                  <button
                    type="button"
                    className="absolute right-1 top-1/2 min-h-11 min-w-11 -translate-y-1/2 p-2 text-sage-500"
                    onClick={() => setShowPass((v) => !v)}
                    aria-label={showPass ? t('auth.hidePassword') : t('auth.showPassword')}
                  >
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </Field>
            )}
            {authMode === 'forgot' && (
              <div className="mb-3 rounded-xl border border-sage-200 bg-white/80 px-3 py-3 text-sm text-sage-700">
                <p className="font-medium text-sage-900">{RESET_EMAIL.subject}</p>
                <ol className="mt-2 list-decimal space-y-1 pl-4">
                  {RESET_EMAIL.steps.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ol>
              </div>
            )}
            {authMode === 'reset' && (
              <>
                <div className="mb-3 rounded-xl border border-sage-200 bg-white/80 px-3 py-3 text-sm text-sage-700">
                  <p>{RESET_EMAIL.summary(authForm.email || emailNotice?.email || 'votre adresse')}</p>
                  <ol className="mt-2 list-decimal space-y-1 pl-4">
                    {RESET_EMAIL.steps.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ol>
                  {emailNotice?.code ? (
                    <p className="mt-2 rounded-lg bg-sage-100 px-2 py-2 text-center font-display text-lg tracking-wide text-sage-900">
                      {emailNotice.code}
                    </p>
                  ) : null}
                  {!emailNotice?.firebaseSent && emailNotice?.kind === 'reset' && (
                    <p className="mt-2 text-sm font-medium text-warn">{resetUserMessage(emailNotice)}</p>
                  )}
                  <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-sage-50 px-2 py-2 text-[11px] leading-relaxed text-sage-700">
                    {RESET_EMAIL.body(authForm.email || emailNotice?.email || '', emailNotice?.code || '…')}
                  </pre>
                </div>
                <Field label={t('auth.code')} error={authFieldErrors.resetToken}>
                  <input
                    className={inputClass}
                    value={authForm.resetToken}
                    onChange={(e) => setAuthForm({ ...authForm, resetToken: e.target.value })}
                  />
                </Field>
                <Field label={t('auth.newPassword')} error={authFieldErrors.newPassword}>
                  <input
                    type="password"
                    className={inputClass}
                    value={authForm.newPassword}
                    onChange={(e) => setAuthForm({ ...authForm, newPassword: e.target.value })}
                    autoComplete="new-password"
                  />
                </Field>
              </>
            )}
            <button type="submit" className="mt-1 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-sage-800 px-4 text-sm font-semibold text-white hover:bg-sage-900 disabled:opacity-50" disabled={authBusy}>
              {authBusy
                ? authMode === 'login'
                  ? t('auth.busyLogin')
                  : authMode === 'register'
                    ? t('auth.busyRegister')
                    : authMode === 'forgot'
                      ? t('auth.busyForgot')
                      : t('auth.busyReset')
                : authMode === 'login'
                  ? t('auth.submitLogin')
                  : authMode === 'register'
                    ? t('auth.submitRegister')
                    : authMode === 'forgot'
                      ? t('auth.submitForgot')
                      : t('auth.submitReset')}
            </button>
            {authError ? (
              <p className="mt-3 text-center text-sm font-medium text-red-700" role="alert">
                {authError}
              </p>
            ) : null}
            {authMode === 'login' && (
              <button
                type="button"
                className="mt-3 w-full text-center text-sm text-sage-600 hover:text-sage-900"
                onClick={() => setAuthMode('forgot')}
              >
                {t('auth.forgotLink')}
              </button>
            )}
            {isResetish && (
              <button
                type="button"
                className="mt-3 w-full text-center text-sm text-sage-600 hover:text-sage-900"
                onClick={() => setAuthMode('login')}
              >
                {t('auth.backToLogin')}
              </button>
            )}
          </form>
        </div>
      </div>
    </div>
  )
}

function Toast({ toast }) {
  if (typeof document === 'undefined' || !toast?.message) return null
  const tone =
    toast.type === 'err'
      ? 'bg-red-600 text-white'
      : toast.type === 'warn'
        ? 'bg-amber-500 text-stone-900'
        : 'bg-emerald-700 text-white'
  return createPortal(
    <div
      className={`pointer-events-none fixed left-1/2 top-4 z-[100] w-[min(28rem,calc(100%-1.5rem))] -translate-x-1/2 break-words rounded-xl px-4 py-3 text-sm font-medium shadow-lg animate-slide-in ${tone}`}
      role={toast.type === 'err' ? 'alert' : 'status'}
      aria-live={toast.type === 'err' ? 'assertive' : 'polite'}
    >
      {toast.message}
    </div>,
    document.body,
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
  const signed = (line) => (line.flow === 'income' ? -1 : 1) * Number(line.amount || 0)
  const estimated = mine
    .filter((l) => l.kind === 'planned')
    .reduce((s, l) => s + signed(l), 0)
  const actuals = mine.filter((l) => l.kind === 'actual' && l.status !== 'cancelled')
  const actual = actuals.reduce((s, l) => s + signed(l), 0)
  const paid = mine
    .filter((l) => l.kind === 'actual' && l.status === 'paid')
    .reduce((s, l) => s + signed(l), 0)
  const plannedTotal = Number(budget?.plannedTotal || 0)
  const remaining = plannedTotal - paid
  const variance = estimated - actual
  const usedPct = plannedTotal > 0 ? (paid / plannedTotal) * 100 : 0
  return { estimated, actual, paid, plannedTotal, remaining, variance, usedPct }
}

function LocalBanner() {
  const { t } = useI18n()
  if (getBackendMode() !== 'local') return null
  return (
    <div className="rounded-xl border border-warn/30 bg-warn/10 px-4 py-3 text-sm text-sage-800">
      {t('common.localBanner')}
    </div>
  )
}

function dueTone(dateStr, done) {
  if (done || !dateStr) return 'border-sage-200 bg-white/80'
  if (isDateOverdue(dateStr)) return 'border-danger/40 bg-danger/10'
  if (isDateNearDue(dateStr)) return 'border-warn/40 bg-warn/10'
  return 'border-sage-200 bg-white/80'
}

function BudgetView({ user, budgets, lines, projects, projectsById, users, flash, onImport, onFocusBudget }) {
  const { t, lang } = useI18n()
  const moneyLocale = dateLocale(lang)
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
  const budgetDraft = useFormDraft(
    'budget',
    getActiveOrgId(),
    open || lineOpen ? JSON.stringify({ form, lineForm, open, lineOpen }) : '',
    (data) => {
      if (data?.form) setForm(data.form)
      if (data?.lineForm) setLineForm((cur) => ({ ...cur, ...data.lineForm }))
      if (data?.open) setOpen(true)
      if (data?.lineOpen) setLineOpen(true)
    },
  )

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
      flow: 'expense',
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
      flash(editing ? t('budgetUi.updated') : t('budgetUi.created'))
      budgetDraft.clear()
      setOpen(false)
    } catch (err) {
      flash(err.message || t('common.error'), 'err')
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
          flow: line.flow === 'income' ? 'income' : 'expense',
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
      flash(lineEditing ? t('budgetUi.lineUpdated') : t('budgetUi.lineAdded'))
      setLineOpen(false)
    } catch (err) {
      flash(err.message || t('common.error'), 'err')
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
      flash(t('common.commentAdded'))
      const updated = lines.find((l) => l.id === commentLine.id)
      if (updated) setCommentLine({ ...updated, comments: [...(updated.comments || [])] })
    } catch (err) {
      flash(err.message || t('common.error'), 'err')
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
        flash(t('budgetUi.deleted'))
        setSelectedId('')
      } else {
        await deleteBudgetLine(confirm.id, user)
        flash(t('budgetUi.lineDeleted'))
      }
      setConfirm(null)
    } catch (err) {
      flash(err.message || t('common.error'), 'err')
    } finally {
      setBusy(false)
    }
  }

  const liveCommentLine = commentLine ? lines.find((l) => l.id === commentLine.id) || commentLine : null

  const cards = selected
    ? [
        { label: t('budgetUi.totalPlanned'), value: formatMoney(summary.plannedTotal, selected.currency, moneyLocale) },
        { label: t('budgetUi.estimated'), value: formatMoney(summary.estimated, selected.currency, moneyLocale) },
        { label: t('budgetUi.actualSum'), value: formatMoney(summary.actual, selected.currency, moneyLocale) },
        { label: t('budgetUi.paid'), value: formatMoney(summary.paid, selected.currency, moneyLocale) },
        { label: t('budgetUi.remaining'), value: formatMoney(summary.remaining, selected.currency, moneyLocale) },
        { label: t('budgetUi.variance'), value: formatMoney(summary.variance, selected.currency, moneyLocale) },
        { label: t('budgetUi.consumedPct'), value: `${Math.round(summary.usedPct)} %` },
      ]
    : []

  if (projects.length === 0) {
    return (
      <div className="space-y-4 animate-fade-up">
        <LocalBanner />
        <EmptyState
          title={t('projectsUi.empty')}
          hint={t('budgetUi.needProject')}
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
              <Plus size={16} /> {t('budgetUi.new')}
            </button>
            <button type="button" className={btnGhost} onClick={onImport}>
              <Upload size={16} /> {t('common.import')}
            </button>
          </>
        )}
        {selected && canManage && (
          <button type="button" className={btnGhost} onClick={openEdit}>
            <Pencil size={14} /> {t('common.edit')}
          </button>
        )}
        {selected && canRemove && (
          <button
            type="button"
            className={btnGhost + ' !text-danger'}
            onClick={() => setConfirm({ type: 'budget', id: selected.id })}
          >
            <Trash2 size={14} /> {t('common.delete')}
          </button>
        )}
      </div>

      {denied ? (
        <EmptyState title={t('budgetUi.accessDenied')} hint={t('budgetUi.accessHint')} />
      ) : !selected ? (
        <EmptyState
          title={t('budgetUi.empty')}
          hint={t('budgetUi.emptyHint')}
          action={
            canWriteRole(user) ? (
              <button type="button" className={btnPrimary + ' mt-4'} onClick={openCreate}>
                <Plus size={16} /> {t('budgetUi.create')}
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
            {BUDGET_TABS.map((tabDef) => (
              <button
                key={tabDef.id}
                type="button"
                onClick={() => setTab(tabDef.id)}
                className={`min-h-11 rounded-xl px-4 py-2 text-sm font-semibold ${
                  tab === tabDef.id ? 'bg-sage-700 text-white' : 'bg-white/80 text-sage-800 border border-sage-200'
                }`}
              >
                {t(`budgetUi.tab${tabDef.id.charAt(0).toUpperCase()}${tabDef.id.slice(1)}`)}
              </button>
            ))}
            {canManage && (
              <button type="button" className={btnPrimary} onClick={() => openLine(null)}>
                <Plus size={16} /> {t('budgetUi.addLine')}
              </button>
            )}
          </div>

          {tabLines.length === 0 ? (
            <EmptyState
              title={t('budgetUi.noLines')}
              hint={tab === 'salary' ? t('budgetUi.noSalaryHint') : t('budgetUi.noLinesHint')}
            />
          ) : (
            <>
              <div className="hidden overflow-x-auto rounded-2xl border border-sage-200 bg-white/80 md:block">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-sage-100 text-sage-700">
                    <tr>
                      <th className="px-4 py-3 font-semibold">{t('budgetUi.label')}</th>
                      <th className="px-4 py-3 font-semibold">{t('budgetUi.category')}</th>
                      <th className="px-4 py-3 font-semibold">{t('budgetUi.amount')}</th>
                      <th className="px-4 py-3 font-semibold">{tab === 'salary' ? t('budgetUi.period') : t('budgetUi.date')}</th>
                      <th className="px-4 py-3 font-semibold">{tab === 'actual' ? t('budgetUi.status') : t('budgetUi.responsible')}</th>
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
                            <Pencil size={14} /> {t('common.edit')}
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

      <Modal
        open={open}
        title={editing ? t('budgetUi.edit') : t('budgetUi.new')}
        onClose={() => setOpen(false)}
        wide
        asForm
        onSubmit={submitBudget}
        busy={busy}
      >
        <div className="space-y-1">
          <Field label={t('budgetUi.name')}>
            <input
              className={inputClass}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
            {budgetDraft.hasDraft ? (
              <button type="button" className="mt-1 text-xs font-semibold text-sage-700 underline" onClick={budgetDraft.clear}>
                {t('draft.clear')}
              </button>
            ) : null}
          </Field>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label={t('budgetUi.project')}>
              <select
                className={inputClass}
                value={form.projectId}
                onChange={(e) => setForm({ ...form, projectId: e.target.value })}
                required
              >
                <option value="">{t('common.choose')}</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t('budgetUi.currency')}>
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
          <Field label={t('budgetUi.totalPlanned')}>
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
            <Field label={t('budgetUi.start')}>
              <input
                className={inputClass}
                type="date"
                value={form.periodStart}
                onChange={(e) => setForm({ ...form, periodStart: e.target.value })}
              />
            </Field>
            <Field label={t('budgetUi.end')}>
              <input
                className={inputClass}
                type="date"
                value={form.periodEnd}
                onChange={(e) => setForm({ ...form, periodEnd: e.target.value })}
              />
            </Field>
            <Field label={t('budgetUi.launch')}>
              <input
                className={inputClass}
                type="date"
                value={form.launchDate}
                onChange={(e) => setForm({ ...form, launchDate: e.target.value })}
              />
            </Field>
          </div>
          <Field label={t('notes.visibility')}>
            <select
              className={inputClass}
              value={form.visibility}
              onChange={(e) => setForm({ ...form, visibility: e.target.value })}
            >
              {SCOPED_VISIBILITIES.map((v) => (
                <option key={v} value={v}>
                  {valueLabel(lang, v)}
                </option>
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
        </div>
      </Modal>

      <Modal
        open={lineOpen}
        title={lineEditing ? t('budgetUi.editLine') : t('budgetUi.newLine')}
        onClose={() => setLineOpen(false)}
        wide
        asForm
        onSubmit={submitLine}
        busy={busy}
      >
        <div className="space-y-1">
          <Field label={t('budgetUi.label')}>
            <input
              className={inputClass}
              value={lineForm.name}
              onChange={(e) => setLineForm({ ...lineForm, name: e.target.value })}
              required
            />
          </Field>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label={t('budgetUi.flow')}>
            <select
              className={inputClass}
              value={lineForm.flow || 'expense'}
              onChange={(e) => setLineForm({ ...lineForm, flow: e.target.value })}
            >
              <option value="expense">{t('budgetUi.expense')}</option>
              <option value="income">{t('budgetUi.income')}</option>
            </select>
          </Field>
          <Field label={t('budgetUi.category')}>
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
            <Field label={t('budgetUi.amount')}>
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
            <Field label={t('budgetUi.date')}>
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
              <Field label={t('budgetUi.status')}>
                <select
                  className={inputClass}
                  value={lineForm.status}
                  onChange={(e) => setLineForm({ ...lineForm, status: e.target.value })}
                >
                  {BUDGET_ACTUAL_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {valueLabel(lang, s)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t('budgetUi.receipt')}>
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
              <Field label={t('budgetUi.roleTitle')}>
                <input
                  className={inputClass}
                  value={lineForm.roleTitle}
                  onChange={(e) => setLineForm({ ...lineForm, roleTitle: e.target.value })}
                  placeholder={t('budgetUi.rolePlaceholder')}
                />
              </Field>
              <Field label={t('budgetUi.duePeriod')}>
                <input
                  className={inputClass}
                  type="month"
                  value={lineForm.duePeriod}
                  onChange={(e) => setLineForm({ ...lineForm, duePeriod: e.target.value })}
                />
              </Field>
            </>
          )}
          <Field label={t('budgetUi.responsible')}>
            <select
              className={inputClass}
              value={lineForm.responsibleId}
              onChange={(e) => setLineForm({ ...lineForm, responsibleId: e.target.value })}
            >
              <option value="">{t('common.none')}</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.fullName}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('budgetUi.notes')}>
            <textarea
              className={inputClass + ' min-h-20'}
              value={lineForm.notes}
              onChange={(e) => setLineForm({ ...lineForm, notes: e.target.value })}
            />
          </Field>
        </div>
      </Modal>

      <Modal
        open={Boolean(liveCommentLine)}
        title={liveCommentLine ? `${t('risksUi.comments')} — ${liveCommentLine.name}` : t('risksUi.comments')}
        onClose={() => {
          setCommentLine(null)
          setCommentBody('')
        }}
      >
        {liveCommentLine && (
          <div className="space-y-3">
            {(liveCommentLine.comments || []).length === 0 ? (
              <p className="text-sm text-sage-500">{t('common.noComments')}</p>
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
                  placeholder={t('common.addComment')}
                />
                <ModalActions>
                  <button type="submit" className={btnPrimary + ' w-full sm:w-auto'} disabled={busy}>
                    {t('common.send')}
                  </button>
                </ModalActions>
              </form>
            )}
          </div>
        )}
      </Modal>

      <Modal
        open={Boolean(confirm)}
        title={t('common.confirmDelete')}
        onClose={() => setConfirm(null)}
        footer={
          <>
            <button type="button" className={btnGhost + ' w-full sm:w-auto'} onClick={() => setConfirm(null)}>
              {t('common.cancel')}
            </button>
            <button
              type="button"
              className={btnPrimary + ' w-full sm:w-auto !bg-danger'}
              disabled={busy}
              onClick={runConfirm}
            >
              {t('common.delete')}
            </button>
          </>
        }
      >
        <p className="text-sm text-sage-700">
          {confirm?.type === 'budget' ? t('budgetUi.confirmBudget') : t('budgetUi.confirmLine')}
        </p>
      </Modal>
    </div>
  )
}

function RisksView({ user, risks, actions, projects, projectsById, users, flash, onImport }) {
  const { t, lang } = useI18n()
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
  const riskFormRef = useRef(form)
  const riskEditingRef = useRef(editing)
  const riskCreated = useRef('')
  riskFormRef.current = form
  riskEditingRef.current = editing
  const riskDraft = useFormDraft('risks', getActiveOrgId(), open ? JSON.stringify({ form, editingId: editing?.id || '' }) : '', (data) => {
    if (!data?.form) return
    setForm(data.form)
    setOpen(true)
  })
  const riskAuto = useAutosave({
    text: open ? form.description || '' : '',
    enabled: open,
    storageKey: `risk:${getActiveOrgId()}:${editing?.id || 'new'}`,
    onSave: async (value) => {
      const current = riskFormRef.current
      if (!String(current.title || '').trim()) return
      const saved = await saveRisk(
        { id: riskEditingRef.current?.id || riskCreated.current || undefined, ...current, title: String(current.title).trim(), description: value },
        user,
      )
      if (saved?.id) {
        riskCreated.current = saved.id
        if (!riskEditingRef.current) setEditing(saved)
      }
    },
  })

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
      flash(editing ? t('risksUi.updated') : t('risksUi.created'))
      riskDraft.clear()
      setOpen(false)
    } catch (err) {
      flash(err.message || t('common.error'), 'err')
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
      flash(actionEditing ? t('risksUi.actionUpdated') : t('risksUi.actionAdded'))
      setActionOpen(false)
    } catch (err) {
      flash(err.message || t('common.error'), 'err')
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
      flash(t('common.commentAdded'))
    } catch (err) {
      flash(err.message || t('common.error'), 'err')
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
        flash(t('risksUi.deleted'))
      } else {
        await deleteRiskAction(confirm.id, user)
        flash(t('risksUi.actionDeleted'))
      }
      setConfirm(null)
    } catch (err) {
      flash(err.message || t('common.error'), 'err')
    } finally {
      setBusy(false)
    }
  }

  if (projects.length === 0) {
    return (
      <div className="space-y-4 animate-fade-up">
        <LocalBanner />
        <EmptyState
          title={t('projectsUi.empty')}
          hint={t('risksUi.needProject')}
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
              <Plus size={16} /> {t('risksUi.new')}
            </button>
            <button type="button" className={btnGhost} onClick={onImport}>
              <Upload size={16} /> {t('common.import')}
            </button>
          </>
        )}
        <select
          className={inputClass + ' max-w-full md:!w-auto'}
          value={filterProject}
          onChange={(e) => setFilterProject(e.target.value)}
        >
          <option value="">{t('risksUi.allProjects')}</option>
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
          <option value="">{t('risksUi.allPeople')}</option>
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
          <option value="">{t('risksUi.allPriorities')}</option>
          {['élevée', 'moyenne', 'faible'].map((p) => (
            <option key={p} value={p}>
              {valueLabel(lang, p)}
            </option>
          ))}
        </select>
        <select
          className={inputClass + ' max-w-full md:!w-auto'}
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option value="">{t('risksUi.allStatuses')}</option>
          {RISK_STATUSES.map((s) => (
            <option key={s} value={s}>
              {valueLabel(lang, s)}
            </option>
          ))}
        </select>
      </div>

      {denied ? (
        <EmptyState title={t('common.accessDenied')} hint={t('risksUi.accessHint')} />
      ) : filtered.length === 0 && !detail ? (
        <EmptyState
          title={t('risksUi.empty')}
          hint={t('risksUi.emptyHint')}
          action={
            canWriteRole(user) ? (
              <button type="button" className={btnPrimary + ' mt-4'} onClick={openCreate}>
                <Plus size={16} /> {t('risksUi.new')}
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
              <DocumentBody content={detail.description} className="mt-3" />
              <p className="mt-2 text-xs text-sage-500">
                {detail.probability} × {detail.impact} · détecté {detail.detectedAt || '—'} · statut {detail.status}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {canManageBudgetRisk(user, detail, projectsById) && (
                  <button type="button" className={btnGhost} onClick={() => openEdit(detail)}>
                    <Pencil size={14} /> {t('common.edit')}
                  </button>
                )}
                {canDeleteBudgetRisk(user, detail, projectsById) && (
                  <button
                    type="button"
                    className={btnGhost + ' !text-danger'}
                    onClick={() => setConfirm({ type: 'risk', id: detail.id })}
                  >
                    <Trash2 size={14} /> {t('common.delete')}
                  </button>
                )}
                <button type="button" className={btnGhost + ' lg:hidden'} onClick={() => setDetailId(null)}>
                  {t('common.close')}
                </button>
              </div>

              <div className="mt-5 flex items-center justify-between gap-2">
                <h3 className="font-display text-lg text-sage-900">{t('risksUi.actions')}</h3>
                {canManage && (
                  <button type="button" className={btnPrimary} onClick={() => openAction(null)}>
                    <Plus size={14} /> {t('risksUi.addAction')}
                  </button>
                )}
              </div>
              {detailActions.length === 0 ? (
                <p className="mt-2 text-sm text-sage-500">{t('risksUi.noActions')}</p>
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

              <h3 className="mt-5 font-display text-lg text-sage-900">{t('risksUi.comments')}</h3>
              {(detail.comments || []).length === 0 ? (
                <p className="mt-2 text-sm text-sage-500">{t('risksUi.noComments')}</p>
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
                    placeholder={t('common.addComment')}
                  />
                  <button type="submit" className={btnPrimary + ' mt-2'} disabled={busy}>
                    {t('common.send')}
                  </button>
                </form>
              )}
            </article>
          )}
        </div>
      )}

      <Modal
        open={open}
        title={editing ? t('risksUi.edit') : t('risksUi.new')}
        onClose={() => setOpen(false)}
        wide
        asForm
        onSubmit={submitRisk}
        busy={busy}
      >
        <div className="space-y-1">
          <Field label={t('risksUi.title')}>
            <input
              className={inputClass}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
            />
          </Field>
          <Field label={t('risksUi.description')}>
            <textarea
              className={inputClass + ' min-h-24 whitespace-pre-wrap'}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
            <AutosaveLine status={riskAuto.status} savedAt={riskAuto.savedAt} />
            {riskDraft.hasDraft ? (
              <button type="button" className="mt-1 text-xs font-semibold text-sage-700 underline" onClick={riskDraft.clear}>
                {t('draft.clear')}
              </button>
            ) : null}
          </Field>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label={t('risksUi.project')}>
              <select
                className={inputClass}
                value={form.projectId}
                onChange={(e) => setForm({ ...form, projectId: e.target.value })}
                required
              >
                <option value="">{t('common.choose')}</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t('risksUi.category')}>
              <select
                className={inputClass}
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                {RISK_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {valueLabel(lang, c)}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Field label={t('risksUi.probability')}>
              <select
                className={inputClass}
                value={form.probability}
                onChange={(e) => setForm({ ...form, probability: e.target.value })}
              >
                {RISK_PROBABILITIES.map((p) => (
                  <option key={p} value={p}>
                    {valueLabel(lang, p)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t('risksUi.impact')}>
              <select
                className={inputClass}
                value={form.impact}
                onChange={(e) => setForm({ ...form, impact: e.target.value })}
              >
                {RISK_IMPACTS.map((p) => (
                  <option key={p} value={p}>
                    {valueLabel(lang, p)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t('risksUi.computedPriority')}>
              <div className="flex min-h-11 items-center">
                <PriorityBadge value={computeRiskPriority(form.probability, form.impact)} />
              </div>
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label={t('risksUi.assignee')}>
              <select
                className={inputClass}
                value={form.assigneeId}
                onChange={(e) => setForm({ ...form, assigneeId: e.target.value })}
              >
                <option value="">{t('common.none')}</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.fullName}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t('common.status')}>
              <select
                className={inputClass}
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                {RISK_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {valueLabel(lang, s)}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label={t('risksUi.detected')}>
              <input
                className={inputClass}
                type="date"
                value={form.detectedAt}
                onChange={(e) => setForm({ ...form, detectedAt: e.target.value })}
              />
            </Field>
            <Field label={t('risksUi.due')}>
              <input
                className={inputClass}
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
              />
            </Field>
          </div>
          <Field label={t('notes.visibility')}>
            <select
              className={inputClass}
              value={form.visibility}
              onChange={(e) => setForm({ ...form, visibility: e.target.value })}
            >
              {SCOPED_VISIBILITIES.map((v) => (
                <option key={v} value={v}>
                  {valueLabel(lang, v)}
                </option>
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
        </div>
      </Modal>

      <Modal
        open={actionOpen}
        title={actionEditing ? t('risksUi.editAction') : t('risksUi.newAction')}
        onClose={() => setActionOpen(false)}
        asForm
        onSubmit={submitAction}
        busy={busy}
      >
        <div className="space-y-1">
          <Field label={t('risksUi.title')}>
            <input
              className={inputClass}
              value={actionForm.title}
              onChange={(e) => setActionForm({ ...actionForm, title: e.target.value })}
              required
            />
          </Field>
          <Field label={t('risksUi.assignee')}>
            <select
              className={inputClass}
              value={actionForm.assigneeId}
              onChange={(e) => setActionForm({ ...actionForm, assigneeId: e.target.value })}
            >
              <option value="">{t('common.none')}</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.fullName}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('risksUi.due')}>
            <input
              className={inputClass}
              type="date"
              value={actionForm.dueDate}
              onChange={(e) => setActionForm({ ...actionForm, dueDate: e.target.value })}
            />
          </Field>
          <Field label={t('common.status')}>
            <select
              className={inputClass}
              value={actionForm.status}
              onChange={(e) => setActionForm({ ...actionForm, status: e.target.value })}
            >
              {RISK_ACTION_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {valueLabel(lang, s)}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </Modal>

      <Modal
        open={Boolean(confirm)}
        title={t('common.confirmDelete')}
        onClose={() => setConfirm(null)}
        footer={
          <>
            <button type="button" className={btnGhost + ' w-full sm:w-auto'} onClick={() => setConfirm(null)}>
              {t('common.cancel')}
            </button>
            <button
              type="button"
              className={btnPrimary + ' w-full sm:w-auto !bg-danger'}
              disabled={busy}
              onClick={runConfirm}
            >
              {t('common.delete')}
            </button>
          </>
        }
      >
        <p className="text-sm text-sage-700">
          {confirm?.type === 'risk' ? t('risksUi.confirmRisk') : t('risksUi.confirmAction')}
        </p>
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
  onDictate,
  onlyImportant = false,
}) {
  const { t, lang } = useI18n()
  const attachRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [viewing, setViewing] = useState(null)
  const [confirmId, setConfirmId] = useState(null)
  const [filterCat, setFilterCat] = useState('Tous')
  const [form, setForm] = useState(emptyNote())
  const [attachBusy, setAttachBusy] = useState(false)
  const formRef = useRef(form)
  const editingRef = useRef(editing)
  const noteCreated = useRef('')
  formRef.current = form
  editingRef.current = editing
  const noteDraft = useFormDraft('notes', getActiveOrgId(), open ? JSON.stringify({ form, editingId: editing?.id || '' }) : '', (data) => {
    if (!data?.form) return
    setForm({ ...emptyNote(), ...data.form })
    setOpen(true)
  })
  const noteAuto = useAutosave({
    text: open ? form.content || '' : '',
    enabled: open,
    storageKey: `note:${getActiveOrgId()}:${editing?.id || 'new'}`,
    onSave: async (text) => {
      const current = formRef.current
      const body = String(text || '')
      if (body.trim().length < 2 && !String(current.title || '').trim()) return
      const saved = await saveNote(
        {
          id: editingRef.current?.id || noteCreated.current || undefined,
          title: String(current.title || '').trim() || body.trim().split('\n')[0].slice(0, 80) || 'Note',
          content: body,
          category: current.category,
          tags: String(current.tags || '')
            .split(',')
            .map((part) => part.trim())
            .filter(Boolean),
          visibility: current.visibility,
          shares: current.visibility === 'Privée' ? [] : current.shares || [],
          projectId: current.projectId || null,
          parentId: current.parentId || null,
          important: Boolean(editingRef.current?.important),
          imageUrl: String(current.imageUrl || '').trim(),
        },
        user,
      )
      if (saved?.id) {
        noteCreated.current = saved.id
        if (!editingRef.current) setEditing(saved)
      }
    },
  })

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
      imageUrl: '',
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

  const openView = (n) => {
    if (!canReadEntity(user, n)) {
      flash(t('common.permissionDenied'), 'err')
      return
    }
    setViewing(n)
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
      imageUrl: n.imageUrl || '',
    })
    setOpen(true)
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!editing && !canWriteRole(user)) {
      flash(t('common.permissionDenied'), 'err')
      return
    }
    if (!canEditEntity(user, editing || { ownerId: user.id, shares: [] }) && editing) {
      flash(t('common.permissionDenied'), 'err')
      return
    }
    try {
      const payload = {
        id: editing?.id,
        title: form.title.trim(),
        content: form.content.replace(/^\uFEFF/, '').replace(/\s+$/, ''),
        category: form.category,
        tags: form.tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        visibility: form.visibility,
        shares: form.visibility === 'Privée' ? [] : form.shares,
        projectId: form.projectId || null,
        parentId: form.parentId || null,
        imageUrl: String(form.imageUrl || '').trim(),
      }
      const saved = await saveNote(payload, user)
      noteDraft.clear()
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
      flash(editing ? t('notes.updated') : t('notes.created'))
      setOpen(false)
    } catch (err) {
      flash(err.message, 'err')
    }
  }

  const remove = async (id) => {
    const n = notes.find((x) => x.id === id)
    if (!canDeleteEntity(user, n)) {
      flash(t('common.permissionDenied'), 'err')
      return
    }
    await deleteNote(id, user)
    setConfirmId(null)
    flash(t('notes.deleted'))
  }

  const renderNoteCard = (n, depth = 0) => {
    const children = filterCat === 'Tous' ? noteChildList(notes, n.id) : []
    const related = noteLinksOf(n.id)
    return (
      <div key={n.id} className={depth ? 'mt-2 border-l border-sage-200 pl-3' : ''}>
        <article className={`rounded-2xl border p-4 transition hover:border-sage-400 ${selectedNoteIds.includes(n.id) ? 'border-sage-500 bg-sage-100/80' : 'border-sage-200 bg-white/80'}`}>
          <div className="flex flex-col gap-3">
            <div className="min-w-0">
              {onToggleNote && (
                <label className="mb-1 flex items-center gap-1.5 text-[11px] text-sage-600">
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 accent-sage-700"
                    checked={selectedNoteIds.includes(n.id)}
                    onChange={() => onToggleNote(n.id)}
                  />
                  {t('notes.contextAi')}
                </label>
              )}
              <h3 className="flex items-center gap-2 break-words font-display text-lg leading-snug text-sage-900">
                {n.important ? <Star size={16} className="shrink-0 fill-sage-700 text-sage-700" aria-hidden="true" /> : null}
                <span className="min-w-0">{n.title}</span>
              </h3>
              <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-sage-500">
                <span>{valueLabel(lang, n.category)}</span>
                <VisibilityBadge value={n.visibility} />
                {n.parentId ? <span>{t('notes.subnoteOf', { title: notesById[n.parentId]?.title || '…' })}</span> : null}
              </p>
            </div>
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              {canWriteRole(user) && (
                <CardActionButton
                  icon={Star}
                  label={n.important ? t('notes.unmarkImportant') : t('notes.markImportant')}
                  title={n.important ? t('notes.unmarkImportant') : t('notes.markImportant')}
                  onClick={() => saveNote({ ...n, important: !n.important }, user).then(() => flash(t('notes.important'))).catch((err) => flash(err.message, 'err'))}
                />
              )}
              {canReadEntity(user, n) && (
                <CardActionButton icon={Eye} label={t('common.view')} title={t('notes.viewNote')} onClick={() => openView(n)} />
              )}
              {canEditEntity(user, n) && (
                <CardActionButton icon={Pencil} label={t('common.edit')} title={t('notes.editNote')} onClick={() => openEdit(n)} />
              )}
              {canDeleteEntity(user, n) && (
                <CardActionButton
                  icon={Trash2}
                  label={t('common.delete')}
                  title={t('notes.deleteNote')}
                  danger
                  onClick={() => setConfirmId(n.id)}
                />
              )}
            </div>
          </div>
          <NoteCardExcerpt content={n.content} className="mt-3" />
          <NoteLinkedFiles
            files={files}
            ids={related.filter((r) => r.type === 'file').map((r) => r.id)}
          />
          {(n.tags || []).length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1">
              {n.tags.map((tag) => (
                <span key={tag} className="rounded-md bg-sage-100 px-2 py-0.5 text-xs text-sage-700">
                  #{tag}
                </span>
              ))}
            </div>
          )}
          {related.length > 0 && (
            <p className="mt-2 flex items-center gap-1 text-xs text-sage-500">
              <Link2 size={12} /> {related.length > 1 ? t('common.linksCountMany', { n: related.length }) : t('common.linksCount', { n: related.length })}
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

  const viewingAuthor = viewing ? entityAuthorName(users, viewing, user.id) : null

  return (
    <div className="space-y-4 animate-fade-up">
      <LocalBanner />
      {onlyImportant && notes.length === 0 ? (
        <EmptyState title={t('notes.importantEmpty')} hint={t('notes.importantEmptyHint')} />
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        {canWriteRole(user) && (
          <>
            <button type="button" className={btnPrimary} onClick={openCreate}>
              <Plus size={16} /> {t('notes.new')}
            </button>
            <button type="button" className={btnGhost} onClick={onImport}>
              <Upload size={16} /> {t('common.import')}
            </button>
            {onDictate && (
              <button type="button" className={btnGhost} onClick={onDictate}>
                <Mic size={16} /> {t('voice.dictate')}
              </button>
            )}
          </>
        )}
        <select
          className={inputClass + ' max-w-full md:!w-auto'}
          value={filterCat}
          onChange={(e) => setFilterCat(e.target.value)}
        >
          <option value="Tous">{t('common.all')}</option>
          {NOTE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {valueLabel(lang, c)}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title={t('notes.none')}
          hint={t('notes.noneHint')}
          action={
            canWriteRole(user) ? (
              <button type="button" className={btnPrimary + ' mt-4'} onClick={openCreate}>
                <Plus size={16} /> {t('notes.create')}
              </button>
            ) : null
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {(filterCat === 'Tous' ? treeNotes : filtered).map((n) => renderNoteCard(n))}
        </div>
      )}

      <Modal
        open={open}
        title={editing ? t('notes.editTitle') : t('notes.new')}
        onClose={() => setOpen(false)}
        wide
        asForm
        onSubmit={submit}
      >
        <div className="space-y-1">
          <Field label={t('notes.title')}>
            <input
              className={inputClass}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
            />
          </Field>
          <Field label={t('notes.content')}>
            <textarea
              className={inputClass + ' min-h-36 whitespace-pre-wrap'}
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
            />
            <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-xs text-sage-500">
              <span>
                {noteAuto.status === 'saving'
                  ? t('autosave.saving')
                  : noteAuto.status === 'unsaved'
                    ? t('autosave.unsaved')
                    : noteAuto.status === 'saved'
                      ? `${t('autosave.saved')}${noteAuto.savedAt ? ` ${t('autosave.at', { time: noteAuto.savedAt.toLocaleTimeString(dateLocale(lang), { hour: '2-digit', minute: '2-digit' }) })}` : ''}`
                      : ''}
              </span>
              {noteDraft.hasDraft ? (
                <button type="button" className="font-semibold text-sage-700 underline" onClick={noteDraft.clear}>
                  {t('draft.clear')}
                </button>
              ) : null}
            </div>
          </Field>
          <Field label={t('notes.imageUrl')}>
            <input
              className={inputClass}
              value={form.imageUrl || ''}
              onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
              placeholder="https://"
            />
            <p className="mt-1 text-[11px] text-sage-500">{t('notes.imageUrlHint')}</p>
          </Field>
          <div className="flex flex-wrap gap-2">
            <input
              ref={attachRef}
              type="file"
              accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,image/*,application/pdf"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0]
                e.target.value = ''
                if (!file || !canWriteRole(user)) return
                setAttachBusy(true)
                try {
                  const task = startFileUpload({ file, description: form.title || 'note' }, user)
                  const saved = await task.done
                  setForm((f) => ({
                    ...f,
                    linkFileIds: f.linkFileIds.includes(saved.id) ? f.linkFileIds : [...f.linkFileIds, saved.id],
                  }))
                  flash(t('notes.attached'))
                } catch (err) {
                  flash(err.message, 'err')
                } finally {
                  setAttachBusy(false)
                }
              }}
            />
            <button
              type="button"
              className={btnGhost}
              disabled={attachBusy}
              onClick={() => attachRef.current?.click()}
            >
              <Upload size={16} /> {attachBusy ? t('common.loading') : t('notes.attach')}
            </button>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label={t('notes.category')}>
              <select
                className={inputClass}
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                {NOTE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {valueLabel(lang, c)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t('notes.visibility')}>
              <select
                className={inputClass}
                value={form.visibility}
                onChange={(e) => setForm({ ...form, visibility: e.target.value })}
              >
                {VISIBILITIES.map((v) => (
                  <option key={v} value={v}>
                    {valueLabel(lang, v)}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label={t('notes.tags')}>
            <input
              className={inputClass}
              value={form.tags}
              onChange={(e) => setForm({ ...form, tags: e.target.value })}
            />
          </Field>
          <Field label={t('notes.project')}>
            <select
              className={inputClass}
              value={form.projectId}
              onChange={(e) => setForm({ ...form, projectId: e.target.value })}
            >
              <option value="">{t('common.none')}</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('notes.parent')}>
            <select
              className={inputClass}
              value={form.parentId}
              onChange={(e) => setForm({ ...form, parentId: e.target.value })}
            >
              <option value="">{t('notes.parentNone')}</option>
              {parentOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </Field>
          <div className="rounded-xl border border-sage-200 bg-white p-3">
            <p className="mb-2 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-sage-500">
              <Link2 size={12} /> {t('notes.links')}
            </p>
            <Field label={t('notes.files')}>
              <div className="flex max-h-28 flex-wrap gap-1 overflow-auto xx-scroll">
                {files.length === 0 && <span className="text-xs text-sage-500">{t('notes.noFiles')}</span>}
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
            <Field label={t('notes.risks')}>
              <div className="flex max-h-28 flex-wrap gap-1 overflow-auto xx-scroll">
                {risks.length === 0 && <span className="text-xs text-sage-500">{t('notes.noRisks')}</span>}
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
            <Field label={t('notes.expenses')}>
              <div className="flex max-h-28 flex-wrap gap-1 overflow-auto xx-scroll">
                {budgetLines.length === 0 && <span className="text-xs text-sage-500">{t('notes.noLines')}</span>}
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
            <Field label={t('notes.ideas')}>
              <div className="flex max-h-28 flex-wrap gap-1 overflow-auto xx-scroll">
                {ideas.length === 0 && <span className="text-xs text-sage-500">{t('notes.noIdeas')}</span>}
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
        </div>
      </Modal>

      <Modal
        open={Boolean(viewing)}
        title={viewing?.title || 'Note'}
        onClose={() => setViewing(null)}
        wide
        footer={
          <>
            <button type="button" className={btnGhost + ' w-full sm:w-auto'} onClick={() => setViewing(null)}>
              {t('common.close')}
            </button>
            {viewing && canEditEntity(user, viewing) && (
              <button
                type="button"
                className={btnPrimary + ' w-full sm:w-auto'}
                onClick={() => {
                  const n = viewing
                  setViewing(null)
                  openEdit(n)
                }}
              >
                <Pencil size={16} /> {t('common.edit')}
              </button>
            )}
          </>
        }
      >
        {viewing && (
          <div className="space-y-3">
            <p className="flex flex-wrap items-center gap-2 text-sm text-sage-600">
              <span>{t('notes.categoryLine', { cat: valueLabel(lang, viewing.category || 'Général'), vis: valueLabel(lang, viewing.visibility || 'Privée') })}</span>
              <VisibilityBadge value={viewing.visibility || 'Privée'} />
              {viewing.parentId ? <span>{t('notes.subnoteOf', { title: notesById[viewing.parentId]?.title || '…' })}</span> : null}
            </p>
            {viewingAuthor ? <p className="text-sm text-sage-600">{t('notes.author', { name: viewingAuthor })}</p> : null}
            <DocumentBody content={viewing.content} imageUrl={viewing.imageUrl} />
            <NoteLinkedFiles
              files={files}
              ids={noteLinksOf(viewing.id)
                .filter((r) => r.type === 'file')
                .map((r) => r.id)}
            />
            {(viewing.tags || []).length > 0 && (
              <div className="flex flex-wrap gap-1">
                {viewing.tags.map((t) => (
                  <span key={t} className="rounded-md bg-sage-100 px-2 py-0.5 text-xs text-sage-700">
                    #{t}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal
        open={Boolean(confirmId)}
        title={t('notes.confirmDelete')}
        onClose={() => setConfirmId(null)}
        footer={
          <>
            <button type="button" className={btnGhost + ' w-full sm:w-auto'} onClick={() => setConfirmId(null)}>
              {t('common.cancel')}
            </button>
            <button
              type="button"
              className={btnPrimary + ' w-full sm:w-auto !bg-danger'}
              onClick={() => remove(confirmId)}
            >
              {t('common.delete')}
            </button>
          </>
        }
      >
        <p className="text-sm text-sage-700">
          {t('notes.confirmDeleteHint')}
        </p>
      </Modal>
    </div>
  )
}

function fileIconFor(ext) {
  if (isImageExt(ext)) return ImageIcon
  return FileText
}

function FilesView({ user, files, folders, foldersMap, projects, users, flash, onImport }) {
  const { t, lang } = useI18n()
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
    .sort((a, b) => String(a.name).localeCompare(String(b.name), dateLocale(lang)))
  const childFiles = files
    .filter((f) => (f.folderId || null) === folderId)
    .sort((a, b) => String(a.name).localeCompare(String(b.name), dateLocale(lang)))

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
      flash(t('filesUi.folderCreated'))
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
      setUpload((u) => ({ ...u, error: t('filesUi.chooseFile'), status: 'error' }))
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
      flash(t('filesUi.imported'))
      setImportOpen(false)
    } catch (err) {
      uploadJob.current = null
      setUpload((u) => ({
        ...u,
        status: 'error',
        error: err.message || t('filesUi.uploadFail'),
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
      flash(err.message || t('common.accessDenied'), 'err')
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
      flash(t('filesUi.saved'))
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
      flash(t('filesUi.shareUpdated'))
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
        title: t('filesUi.deleteFolder'),
        body: t('filesUi.deleteFolderBody', { files: summary.fileCount, folders: summary.folderCount }),
      })
    } else {
      setConfirm({
        kind,
        item,
        title: t('filesUi.deleteFile'),
        body: t('filesUi.deleteForever'),
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
        flash(t('filesUi.folderDeleted'))
      } else {
        await deleteFile(confirm.item.id, user)
        flash(t('filesUi.fileDeleted'))
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
        <button type="button" className={btnGhost + ' !px-2'} onClick={() => openPreview(item)} title={t('filesUi.preview')}>
          <Eye size={14} />
        </button>
      )}
      {canModifyFileOrFolder(user, item, ctx) && (
        <button type="button" className={btnGhost + ' !px-2'} onClick={() => openEdit(item, kind)} title={t('common.edit')}>
          <Pencil size={14} />
        </button>
      )}
      {canManageFileOrFolder(user, item, ctx) && (
        <button type="button" className={btnGhost + ' !px-2'} onClick={() => openShare(item, kind)} title={t('common.share')}>
          <Share2 size={14} />
        </button>
      )}
      {canDeleteFileOrFolder(user, item, ctx) && (
        <button
          type="button"
          className={btnGhost + ' !px-2 !text-danger'}
          onClick={() => openDelete(item, kind)}
          title={t('common.delete')}
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
            <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-sage-500">
              {kind !== 'folder' ? (
                <span>
                  {(item.ext || '').toUpperCase()} · {formatFileSize(item.size)}
                </span>
              ) : null}
              <VisibilityBadge value={item.visibility} />
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
            <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-sage-500">
              {kind === 'folder' ? (
                <span>{nameOf(item.ownerId)}</span>
              ) : (
                <span>
                  {(item.ext || '').toUpperCase()} · {formatFileSize(item.size)} ·{' '}
                  {nameOf(item.uploadedBy || item.ownerId)}
                </span>
              )}
              <VisibilityBadge value={item.visibility} />
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
          {t('filesUi.localBanner')}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {canWriteRole(user) && canAddHere && (
          <>
            <button type="button" className={btnPrimary} onClick={() => onImport?.(folderId)}>
              <Upload size={16} /> {t('common.import')}
            </button>
            <button type="button" className={btnGhost} onClick={openImport}>
              <Upload size={16} /> {t('filesUi.uploadDevice')}
            </button>
            <button type="button" className={btnGhost} onClick={openNewFolder}>
              <FolderPlus size={16} /> {t('filesUi.newFolder')}
            </button>
          </>
        )}
        <div className="relative min-w-0 flex-1 basis-full sm:basis-48">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sage-400" size={16} />
          <input
            className={inputClass + ' pl-9'}
            placeholder={t('filesUi.search')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <select
          className={inputClass + ' max-w-full sm:!w-auto'}
          value={filterExt}
          onChange={(e) => setFilterExt(e.target.value)}
        >
          <option value="">{t('filesUi.type')}</option>
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
          <option value="">{t('filesUi.author')}</option>
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
          <option value="">{t('filesUi.root')}</option>
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
            aria-label={t('common.list')}
          >
            <List size={16} />
          </button>
          <button
            type="button"
            className={`inline-flex min-h-9 min-w-9 items-center justify-center rounded-lg ${
              layout === 'grid' ? 'bg-sage-200' : ''
            }`}
            onClick={() => setLayout('grid')}
            aria-label={t('common.grid')}
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
          title={t('filesUi.emptyRoot')}
          hint={
            canWriteRole(user)
              ? t('filesUi.emptyRootHint', { size: maxFileSizeLabel(), exts: ALLOWED_FILE_EXTS.join(', ') })
              : t('filesUi.emptyRootRead')
          }
          action={
            canWriteRole(user) && canAddHere ? (
              <button type="button" className={btnPrimary + ' mt-4'} onClick={() => onImport?.(folderId)}>
                <Upload size={16} /> {t('filesUi.upload')}
              </button>
            ) : null
          }
        />
      ) : emptyHere && filtersOn ? (
        <EmptyState title={t('filesUi.noResults')} hint={t('filesUi.noResultsHint')} />
      ) : emptyHere ? (
        <EmptyState
          title={t('filesUi.emptyFolder')}
          hint={t('filesUi.emptyFolderHint')}
          action={
            canWriteRole(user) && canAddHere ? (
              <button type="button" className={btnPrimary + ' mt-4'} onClick={() => onImport?.(folderId)}>
                <Upload size={16} /> {t('common.import')}
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

      <Modal
        open={importOpen}
        title={t('filesUi.upload')}
        onClose={() => setImportOpen(false)}
        wide
        asForm
        onSubmit={runUpload}
        busy={upload.status === 'progress'}
        footer={
          upload.status === 'progress' ? (
            <button type="button" className={btnGhost + ' w-full sm:w-auto'} onClick={cancelUpload}>
              {t('common.cancel')}
            </button>
          ) : (
            <>
              <button type="button" className={btnGhost + ' w-full sm:w-auto'} onClick={() => setImportOpen(false)}>
                {t('common.cancel')}
              </button>
              <button type="submit" className={btnPrimary + ' w-full sm:w-auto'} disabled={!upload.file}>
                <Upload size={16} /> {t('filesUi.uploadDevice')}
              </button>
            </>
          )
        }
      >
        <div className="space-y-1">
          <Field label={t('filesUi.fileMax', { size: maxFileSizeLabel() })}>
            <input
              type="file"
              className={inputClass}
              accept={ALLOWED_FILE_EXTS.map((e) => `.${e}`).join(',')}
              onChange={(e) => pickUploadFile(e.target.files?.[0] || null)}
            />
          </Field>
          <p className="mb-3 text-xs text-sage-500">
            {t('filesUi.typesHint', { exts: ALLOWED_FILE_EXTS.join(', ') })}
          </p>
          <Field label={t('filesUi.folder')}>
            <select
              className={inputClass}
              value={upload.folderId}
              onChange={(e) => setUpload((u) => ({ ...u, folderId: e.target.value }))}
            >
              <option value="">{t('filesUi.root')}</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('filesUi.description')}>
            <textarea
              className={inputClass + ' min-h-20'}
              value={upload.description}
              onChange={(e) => setUpload((u) => ({ ...u, description: e.target.value }))}
            />
          </Field>
          <Field label={t('filesUi.linkedProject')}>
            <select
              className={inputClass}
              value={upload.projectId}
              onChange={(e) => setUpload((u) => ({ ...u, projectId: e.target.value }))}
            >
              <option value="">{t('common.none')}</option>
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
        </div>
      </Modal>

      <Modal open={folderOpen} title={t('filesUi.newFolder')} onClose={() => setFolderOpen(false)} asForm onSubmit={submitFolder} submitLabel={t('filesUi.create')} busy={busy}>
        <div>
          <Field label={t('filesUi.name')}>
            <input
              className={inputClass}
              value={folderForm.name}
              onChange={(e) => setFolderForm({ ...folderForm, name: e.target.value })}
              required
            />
          </Field>
          <Field label={t('filesUi.parentFolder')}>
            <select
              className={inputClass}
              value={folderForm.parentId}
              onChange={(e) => setFolderForm({ ...folderForm, parentId: e.target.value })}
            >
              <option value="">{t('filesUi.root')}</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('filesUi.linkedProject')}>
            <select
              className={inputClass}
              value={folderForm.projectId}
              onChange={(e) => setFolderForm({ ...folderForm, projectId: e.target.value })}
            >
              <option value="">{t('common.none')}</option>
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
        </div>
      </Modal>

      <Modal
        open={Boolean(preview)}
        title={t('filesUi.preview')}
        onClose={closePreview}
        wide
      >
        {previewStatus === 'loading' && <p className="text-sm text-sage-600">{t('filesUi.loading')}</p>}
        {previewStatus === 'denied' && (
          <p className="text-sm text-danger">{t('filesUi.denied')}</p>
        )}
        {previewStatus === 'done' && preview && (
          <div className="space-y-3">
            {isImageExt(preview.ext) && previewUrl ? (
              <img src={previewUrl} alt="" className="max-h-[70vh] w-full rounded-xl object-contain bg-white" />
            ) : isPdfExt(preview.ext) && previewUrl ? (
              <iframe title="PDF" src={previewUrl} className="h-[70vh] w-full rounded-xl bg-white" />
            ) : (
              <p className="text-sm text-sage-600">{t('filesUi.unavailable')}</p>
            )}
            <button type="button" className={btnPrimary} onClick={downloadPreview}>
              <Download size={16} /> {t('filesUi.download')}
            </button>
          </div>
        )}
      </Modal>

      <Modal
        open={Boolean(editItem)}
        title={editItem?.kind === 'folder' ? t('filesUi.editFolder') : t('filesUi.editFile')}
        onClose={() => setEditItem(null)}
        asForm
        onSubmit={submitEdit}
        busy={busy}
      >
        <div>
          <Field label={t('filesUi.name')}>
            <input
              className={inputClass}
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              required
            />
          </Field>
          {editItem?.kind === 'file' && (
            <Field label={t('filesUi.description')}>
              <textarea
                className={inputClass + ' min-h-20'}
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
              />
            </Field>
          )}
          <Field label={editItem?.kind === 'folder' ? t('filesUi.parentFolder') : t('filesUi.folder')}>
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
              <option value="">{t('filesUi.root')}</option>
              {(editItem?.kind === 'folder' ? folderChoices : folders).map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('filesUi.linkedProject')}>
            <select
              className={inputClass}
              value={editForm.projectId}
              onChange={(e) => setEditForm({ ...editForm, projectId: e.target.value })}
            >
              <option value="">{t('common.none')}</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </Modal>

      <Modal open={Boolean(shareItem)} title={t('shareUi.title')} onClose={() => setShareItem(null)} asForm onSubmit={submitShare} busy={busy}>
        <div>
          <FileShareBlock
            users={users}
            user={user}
            shares={shareForm.shares}
            teamWide={shareForm.teamWide}
            onShares={(shares) => setShareForm({ ...shareForm, shares })}
            onTeamWide={(teamWide) => setShareForm({ ...shareForm, teamWide })}
          />
        </div>
      </Modal>

      <Modal
        open={Boolean(confirm)}
        title={confirm?.title || t('common.confirm')}
        onClose={() => setConfirm(null)}
        footer={
          <>
            <button type="button" className={btnGhost + ' w-full sm:w-auto'} onClick={() => setConfirm(null)}>
              {t('common.cancel')}
            </button>
            <button
              type="button"
              className={btnPrimary + ' w-full sm:w-auto !bg-danger'}
              onClick={runDelete}
              disabled={busy}
            >
              {t('common.delete')}
            </button>
          </>
        }
      >
        <p className="text-sm text-sage-700">{confirm?.body}</p>
      </Modal>
    </div>
  )
}

function AutosaveLine({ status, savedAt }) {
  const { t, lang } = useI18n()
  if (!status || status === 'idle') return null
  const key = status === 'saving' ? 'saving' : status === 'saved' ? 'saved' : 'unsaved'
  const time =
    status === 'saved' && savedAt
      ? ` ${t('autosave.at', { time: savedAt.toLocaleTimeString(dateLocale(lang), { hour: '2-digit', minute: '2-digit' }) })}`
      : ''
  return (
    <p className="mt-1 text-xs text-sage-500">
      {t(`autosave.${key}`)}
      {time}
    </p>
  )
}

function IdeasView({ user, ideas, users, flash }) {
  const { t, lang } = useI18n()
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
  const ideaFormRef = useRef(form)
  const ideaEditingRef = useRef(editing)
  const ideaCreated = useRef('')
  ideaFormRef.current = form
  ideaEditingRef.current = editing
  const ideaDraft = useFormDraft('ideas', getActiveOrgId(), open ? JSON.stringify({ form, editingId: editing?.id || '' }) : '', (data) => {
    if (!data?.form) return
    setForm(data.form)
    setOpen(true)
  })
  const ideaAuto = useAutosave({
    text: open ? form.description || '' : '',
    enabled: open,
    storageKey: `idea:${getActiveOrgId()}:${editing?.id || 'new'}`,
    onSave: async (value) => {
      const current = ideaFormRef.current
      if (!String(current.title || '').trim()) return
      const saved = await saveIdea(
        {
          id: ideaEditingRef.current?.id || ideaCreated.current || undefined,
          ...current,
          title: String(current.title).trim(),
          description: value,
          votes: ideaEditingRef.current?.votes || [],
          history: ideaEditingRef.current?.history || [],
        },
        user,
      )
      if (saved?.id) {
        ideaCreated.current = saved.id
        if (!ideaEditingRef.current) setEditing(saved)
      }
    },
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
      flash(t('common.permissionDenied'), 'err')
      return
    }
    if (editing && !canEditEntity(user, editing)) {
      flash(t('common.permissionDenied'), 'err')
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
      ideaDraft.clear()
      if (editing && editing.status !== saved.status) {
        await appendIdeaHistory(saved.id, {
          type: 'status',
          userId: user.id,
          label: `Statut → ${saved.status}`,
        })
      }
      flash(editing ? t('ideasUi.updated') : t('ideasUi.created'))
      setOpen(false)
    } catch (err) {
      flash(err.message, 'err')
    }
  }

  const move = async (idea, status) => {
    if (!canEditEntity(user, idea)) {
      flash(t('common.permissionDenied'), 'err')
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
      flash(t('ideasUi.onlyKept'), 'err')
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
      flash(t('ideasUi.transformedNote'))
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
      flash(t('ideasUi.transformedProject'))
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
          <Plus size={16} /> {t('ideasUi.new')}
        </button>
      )}

      {ideas.length === 0 ? (
        <EmptyState
          title={t('ideasUi.empty')}
          hint={t('ideasUi.emptyHint')}
          action={
            canWriteRole(user) ? (
              <button type="button" className={btnPrimary + ' mt-4'} onClick={openCreate}>
                <Plus size={16} /> {t('ideasUi.add')}
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
                <h3 className="text-sm font-semibold text-sage-800">{valueLabel(lang, col.status)}</h3>
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
                      <p className="break-words font-medium text-sage-900">{idea.title}</p>
                      <p className="mt-1 line-clamp-2 whitespace-pre-wrap break-words text-xs text-sage-600">{idea.description}</p>
                    </button>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <CardActionButton
                        icon={Eye}
                        label={t('common.view')}
                        title={t('ideasUi.view')}
                        onClick={() => setDetail(idea)}
                      />
                      {canEditEntity(user, idea) && (
                        <CardActionButton
                          icon={Pencil}
                          label={t('common.edit')}
                          title={t('ideasUi.edit')}
                          onClick={() => {
                            setEditing(idea)
                            setForm({
                              title: idea.title,
                              description: idea.description || '',
                              status: idea.status,
                              visibility: idea.visibility || 'Publique',
                              shares: idea.shares || [],
                            })
                            setOpen(true)
                          }}
                        />
                      )}
                      {canDeleteEntity(user, idea) && (
                        <CardActionButton
                          icon={Trash2}
                          label={t('common.delete')}
                          title={t('ideasUi.delete')}
                          danger
                          onClick={async () => {
                            if (confirm(t('ideasUi.confirmDelete'))) {
                              await deleteIdea(idea.id, user)
                              flash(t('ideasUi.deleted'))
                            }
                          }}
                        />
                      )}
                      <button
                        type="button"
                        className={`${btnCardAction} text-xs ${
                          (idea.votes || []).includes(user.id) ? '!bg-sage-200' : ''
                        }`}
                        title={t('ideasUi.vote')}
                        aria-label={t('ideasUi.vote')}
                        onClick={async () => {
                          await voteIdea(idea.id, user.id)
                        }}
                      >
                        <ThumbsUp size={16} strokeWidth={2.25} className="shrink-0" aria-hidden="true" />
                        {(idea.votes || []).length}
                      </button>
                      {idea.status === 'Retenue' && (
                        <>
                          <CardActionButton
                            icon={StickyNote}
                            label={t('ideasUi.toNote')}
                            title={t('ideasUi.toNote')}
                            onClick={() => transform(idea, 'note')}
                          />
                          <CardActionButton
                            icon={FolderKanban}
                            label={t('ideasUi.toProject')}
                            title={t('ideasUi.toProject')}
                            onClick={() => transform(idea, 'project')}
                          />
                        </>
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

      <Modal
        open={open}
        title={editing ? t('ideasUi.edit') : t('ideasUi.new')}
        onClose={() => setOpen(false)}
        asForm
        onSubmit={submit}
      >
        <div>
          <Field label={t('ideasUi.title')}>
            <input
              className={inputClass}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
            />
          </Field>
          <Field label={t('ideasUi.description')}>
            <textarea
              className={inputClass + ' min-h-24 whitespace-pre-wrap'}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
            <AutosaveLine status={ideaAuto.status} savedAt={ideaAuto.savedAt} />
            {ideaDraft.hasDraft ? (
              <button type="button" className="mt-1 text-xs font-semibold text-sage-700 underline" onClick={ideaDraft.clear}>
                {t('draft.clear')}
              </button>
            ) : null}
          </Field>
          <Field label={t('ideasUi.status')}>
            <select
              className={inputClass}
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              {IDEA_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {valueLabel(lang, s)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('notes.visibility')}>
            <select
              className={inputClass}
              value={form.visibility}
              onChange={(e) => setForm({ ...form, visibility: e.target.value })}
            >
              {VISIBILITIES.map((v) => (
                <option key={v} value={v}>
                  {valueLabel(lang, v)}
                </option>
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
        </div>
      </Modal>

      <Modal
        open={Boolean(detail)}
        title={detail?.title || ''}
        onClose={() => setDetail(null)}
        wide
      >
        {detail && (
          <div className="space-y-4">
            <p className="flex flex-wrap items-center gap-2 text-sm text-sage-600">
              <span>{t('ideasUi.status')} : {valueLabel(lang, detail.status)}</span>
              <VisibilityBadge value={detail.visibility || 'Publique'} />
              <span>{t('ideasUi.vote')} : {(detail.votes || []).length}</span>
            </p>
            {entityAuthorName(users, detail, user.id, t('common.authorFallback')) ? (
              <p className="text-sm text-sage-600">
                {t('notes.author', { name: entityAuthorName(users, detail, user.id, t('common.authorFallback')) })}
              </p>
            ) : null}
            <DocumentBody content={detail.description} />
            <div>
              <h4 className="mb-2 font-semibold text-sage-800">{t('ideasUi.history')}</h4>
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
                  <Pencil size={14} /> {t('common.edit')}
                </button>
              )}
              {canDeleteEntity(user, detail) && (
                <button
                  type="button"
                  className={btnGhost + ' w-full sm:w-auto !text-danger'}
                  onClick={async () => {
                    await deleteIdea(detail.id, user)
                    setDetail(null)
                    flash(t('ideasUi.deleted'))
                  }}
                >
                  <Trash2 size={14} /> {t('common.delete')}
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
  const { t } = useI18n()
  const ids = new Set(notes.map((n) => n.id))
  let children = noteChildList(notes, parentId)
  if (depth === 0) {
    const orphans = notes.filter((n) => n.parentId && !ids.has(n.parentId))
    const seen = new Set(children.map((n) => n.id))
    children = [...children, ...orphans.filter((n) => !seen.has(n.id))]
  }
  if (!children.length && depth === 0) return <p className="text-sage-500">{t('common.none')}</p>
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
  const { t, lang } = useI18n()
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
    [t('nav.files'), linkedFiles.map((f) => f.name)],
    [t('nav.ideas'), linkedIdeas.map((i) => `${i.title} (${valueLabel(lang, i.status)})`)],
    [t('nav.calendar'), linkedEvents.map((e) => `${e.title} · ${e.date || ''}`)],
    [t('nav.budget'), linkedBudgets.map((b) => b.name)],
    [t('nav.risks'), linkedRisks.map((r) => r.title)],
  ]
  return (
    <div className="space-y-4 text-sm">
      <DocumentBody content={detail.description} />
      <p className="text-sage-500">
        {detail.startDate || '—'} → {detail.dueDate || '—'} · {detail.progress ?? 0}%
      </p>
      <div>
        <h4 className="font-semibold text-sage-800">{t('projectsUi.linkedNotes')}</h4>
        <NoteTreeList notes={linkedNotes} />
      </div>
      {sections.map(([label, items]) => (
        <div key={label}>
          <h4 className="font-semibold text-sage-800">{label}</h4>
          <ul className="mt-2 space-y-1">
            {items.length === 0 && <li className="text-sage-500">{t('common.none')}</li>}
            {items.map((item, idx) => (
              <li key={`${label}-${idx}`}>{item}</li>
            ))}
          </ul>
        </div>
      ))}
      <p className="text-xs text-sage-500">{t('projectsUi.chatHint')}</p>
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
  const { t, lang } = useI18n()
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
  const projectFormRef = useRef(form)
  const projectEditingRef = useRef(editing)
  const projectCreated = useRef('')
  projectFormRef.current = form
  projectEditingRef.current = editing
  const projectDraft = useFormDraft('projects', getActiveOrgId(), open ? JSON.stringify({ form, editingId: editing?.id || '' }) : '', (data) => {
    if (!data?.form) return
    setForm(data.form)
    setOpen(true)
  })
  const projectAuto = useAutosave({
    text: open ? form.description || '' : '',
    enabled: open,
    storageKey: `project:${getActiveOrgId()}:${editing?.id || 'new'}`,
    onSave: async (value) => {
      const current = projectFormRef.current
      if (!String(current.title || '').trim()) return
      const saved = await saveProject(
        {
          id: projectEditingRef.current?.id || projectCreated.current || undefined,
          ...current,
          title: String(current.title).trim(),
          description: value,
          progress: Number(current.progress) || 0,
        },
        user,
      )
      if (saved?.id) {
        projectCreated.current = saved.id
        if (!projectEditingRef.current) setEditing(saved)
      }
    },
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
      flash(t('common.permissionDenied'), 'err')
      return
    }
    if (editing && !canEditEntity(user, editing)) {
      flash(t('common.permissionDenied'), 'err')
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
      flash(editing ? t('projectsUi.updated') : t('projectsUi.created'))
      projectDraft.clear()
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
            <Plus size={16} /> {t('projectsUi.new')}
          </button>
          <button type="button" className={btnGhost} onClick={onImport}>
            <Upload size={16} /> {t('common.import')}
          </button>
        </div>
      )}

      {projects.length === 0 ? (
        <EmptyState
          title={t('projectsUi.empty')}
          hint={t('projectsUi.emptyHint')}
          action={
            canWriteRole(user) ? (
              <button type="button" className={btnPrimary + ' mt-4'} onClick={openCreate}>
                <Plus size={16} /> {t('projectsUi.new')}
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
                <div className="flex flex-col gap-3">
                  <div className="min-w-0">
                    <h3 className="break-words font-display text-xl text-sage-900">{p.title}</h3>
                    <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-sage-500">
                      <span>{valueLabel(lang, p.status)}</span>
                      <VisibilityBadge value={p.visibility || 'Partagée'} />
                      <span>{t('projectsUi.lead', { name: lead?.fullName || '—' })}</span>
                    </p>
                  </div>
                  <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                    <CardActionButton icon={Eye} label={t('common.view')} title={t('projectsUi.view')} onClick={() => setDetail(p)} />
                    {canEditEntity(user, p) && (
                      <CardActionButton
                        icon={Pencil}
                        label={t('common.edit')}
                        title={t('projectsUi.edit')}
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
                      />
                    )}
                    {canDeleteEntity(user, p) && (
                      <CardActionButton
                        icon={Trash2}
                        label={t('common.delete')}
                        title={t('projectsUi.delete')}
                        danger
                        onClick={async () => {
                          if (confirm(t('projectsUi.confirmDelete'))) {
                            await deleteProject(p.id, user)
                            flash(t('projectsUi.deleted'))
                          }
                        }}
                      />
                    )}
                  </div>
                </div>
                <p className="mt-3 line-clamp-3 whitespace-pre-wrap break-words text-sm text-sage-700">{p.description}</p>
                <div className="mt-4">
                  <div className="mb-1 flex justify-between text-xs text-sage-600">
                    <span>{t('projectsUi.progress')}</span>
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
              </article>
            )
          })}
        </div>
      )}

      <Modal
        open={open}
        title={editing ? t('projectsUi.edit') : t('projectsUi.new')}
        onClose={() => setOpen(false)}
        wide
        asForm
        onSubmit={submit}
      >
        <div className="grid grid-cols-1 gap-1 md:grid-cols-2 md:gap-x-4">
          <div className="md:col-span-2">
            <Field label={t('projectsUi.title')}>
              <input
                className={inputClass}
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
                autoFocus
              />
            </Field>
          </div>
          <div className="md:col-span-2">
            <Field label={t('projectsUi.description')}>
              <textarea
                className={inputClass + ' min-h-20 whitespace-pre-wrap'}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
              <AutosaveLine status={projectAuto.status} savedAt={projectAuto.savedAt} />
              {projectDraft.hasDraft ? (
                <button type="button" className="mt-1 text-xs font-semibold text-sage-700 underline" onClick={projectDraft.clear}>
                  {t('draft.clear')}
                </button>
              ) : null}
            </Field>
          </div>
          <Field label={t('projectsUi.status')}>
            <select
              className={inputClass}
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              {PROJECT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {valueLabel(lang, s)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={`${t('projectsUi.progress')} (%)`}>
            <input
              type="number"
              min="0"
              max="100"
              className={inputClass}
              value={form.progress}
              onChange={(e) => setForm({ ...form, progress: e.target.value })}
            />
          </Field>
          <Field label={t('projectsUi.leadField')}>
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
          <Field label={t('notes.visibility')}>
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
          <Field label={t('projectsUi.startDate')}>
            <input
              type="date"
              className={inputClass}
              value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
            />
          </Field>
          <Field label={t('projectsUi.dueDate')}>
            <input
              type="date"
              className={inputClass}
              value={form.dueDate}
              onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
            />
          </Field>
          <div className="md:col-span-2">
            <Field label={t('projectsUi.members')}>
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
        </div>
      </Modal>

      <Modal open={Boolean(detail)} title={detail?.title || ''} onClose={() => setDetail(null)} wide>
        {detail && (
          <div className="space-y-3">
            <p className="flex flex-wrap items-center gap-2 text-sm text-sage-600">
              <span>{t('projectsUi.status')} : {valueLabel(lang, detail.status)}</span>
              <VisibilityBadge value={detail.visibility || 'Partagée'} />
            </p>
            {entityAuthorName(users, detail, user.id, t('common.authorFallback')) ? (
              <p className="text-sm text-sage-600">
                {t('notes.author', { name: entityAuthorName(users, detail, user.id, t('common.authorFallback')) })}
              </p>
            ) : null}
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
          </div>
        )}
      </Modal>
    </div>
  )
}

function CalendarView({ user, events, users, flash }) {
  const { t, lang } = useI18n()
  const cal = calendarLabels(lang)
  const [todayIso] = useState(() => toIsoDate(new Date()))
  const [cursor, setCursor] = useState(() => {
    const t = new Date()
    return { year: t.getFullYear(), month: t.getMonth() }
  })
  const [mode, setMode] = useState('month')
  const [selectedDate, setSelectedDate] = useState(todayIso)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({
    title: '',
    description: '',
    date: todayIso,
    time: '09:00',
    participantIds: [],
    visibility: 'Partagée',
    shares: [],
  })
  const eventFormRef = useRef(form)
  const eventCreated = useRef('')
  eventFormRef.current = form
  const eventDraft = useFormDraft('events', getActiveOrgId(), open ? JSON.stringify(form) : '', (data) => {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return
    setForm((cur) => ({ ...cur, ...data }))
    setOpen(true)
  })
  const eventAuto = useAutosave({
    text: open ? form.description || '' : '',
    enabled: open,
    storageKey: `event:${getActiveOrgId()}:${form.date || 'new'}`,
    onSave: async (value) => {
      const current = eventFormRef.current
      if (!String(current.title || '').trim()) return
      const saved = await saveEvent(
        { id: eventCreated.current || undefined, ...current, title: String(current.title).trim(), description: value },
        user,
      )
      if (saved?.id) eventCreated.current = saved.id
    },
  })

  const byDate = useMemo(() => groupEventsByDate(events), [events])
  const sorted = [...events].sort((a, b) =>
    `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`),
  )
  const cells = useMemo(() => monthCells(cursor.year, cursor.month), [cursor.year, cursor.month])
  const weekIso = useMemo(() => {
    const anchor = parseIsoDate(selectedDate) || new Date(cursor.year, cursor.month, 1)
    return weekDates(anchor)
  }, [selectedDate, cursor.year, cursor.month])
  const dayEvents = byDate[selectedDate] || []

  const blankForm = (date) => ({
    title: '',
    description: '',
    date: date || selectedDate || todayIso,
    time: '09:00',
    participantIds: [],
    visibility: 'Partagée',
    shares: [],
  })

  const openCreate = (date) => {
    const iso = date || selectedDate || todayIso
    setSelectedDate(iso)
    setForm(blankForm(iso))
    setOpen(true)
  }

  const pickDay = (iso) => {
    if (!iso) return
    setSelectedDate(iso)
    const d = parseIsoDate(iso)
    if (d) setCursor({ year: d.getFullYear(), month: d.getMonth() })
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!canWriteRole(user)) {
      flash(t('common.permissionDenied'), 'err')
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
      flash(t('calendar.planned'))
      eventDraft.clear()
      eventCreated.current = ''
      setSelectedDate(saved.date || form.date)
      setOpen(false)
      setForm(blankForm(saved.date || form.date))
    } catch (err) {
      flash(err.message, 'err')
    }
  }

  const renderEventChip = (ev) => (
    <span
      key={ev.id}
      className="block truncate rounded bg-sage-700/90 px-1 py-0.5 text-[10px] leading-tight text-white"
      title={`${ev.time || ''} ${ev.title}`}
    >
      {ev.time ? `${ev.time} · ` : ''}
      {ev.title}
    </span>
  )

  const dayButton = (iso, dayNum, inMonth) => {
    const list = byDate[iso] || []
    const isToday = iso === todayIso
    const isSelected = iso === selectedDate
    return (
      <button
        key={iso}
        type="button"
        onClick={() => pickDay(iso)}
        className={`flex min-h-[4.25rem] flex-col items-stretch gap-0.5 rounded-none p-1 text-left transition sm:min-h-[6.5rem] sm:p-1.5 ${
          inMonth ? 'bg-white' : 'bg-sage-50/80 text-sage-400'
        } ${isSelected ? 'ring-2 ring-inset ring-sage-600' : ''} ${
          isToday && !isSelected ? 'bg-sage-100' : ''
        } hover:bg-sage-50`}
      >
        <span
          className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
            isToday ? 'bg-sage-700 text-white' : 'text-sage-800'
          }`}
        >
          {dayNum}
        </span>
        <div className="hidden min-h-0 flex-1 space-y-0.5 overflow-hidden sm:block">
          {list.slice(0, 3).map(renderEventChip)}
          {list.length > 3 && (
            <span className="text-[10px] font-medium text-sage-600">+{list.length - 3}</span>
          )}
        </div>
        {list.length > 0 && (
          <span className="mt-auto flex gap-0.5 sm:hidden">
            {list.slice(0, 3).map((ev) => (
              <span key={ev.id} className="h-1.5 w-1.5 rounded-full bg-sage-700" />
            ))}
          </span>
        )}
      </button>
    )
  }

  return (
    <div className="space-y-4 animate-fade-up">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={btnGhost + ' !min-h-11 !min-w-11 !px-2'}
            aria-label={mode === 'week' ? t('calendar.prevWeek') : t('calendar.prevMonth')}
            onClick={() => {
              if (mode === 'week') {
                const d = parseIsoDate(weekIso[0])
                if (d) {
                  d.setDate(d.getDate() - 7)
                  pickDay(toIsoDate(d))
                }
              } else {
                setCursor(addMonths(cursor.year, cursor.month, -1))
              }
            }}
          >
            <ChevronLeft size={18} />
          </button>
          <h2 className="min-w-[10rem] text-center font-display text-xl capitalize text-sage-900 sm:text-2xl">
            {mode === 'week'
              ? t('calendar.weekOf', { date: formatDayLong(weekIso[0], lang) })
              : formatMonthTitle(cursor.year, cursor.month, lang)}
          </h2>
          <button
            type="button"
            className={btnGhost + ' !min-h-11 !min-w-11 !px-2'}
            aria-label={mode === 'week' ? t('calendar.nextWeek') : t('calendar.nextMonth')}
            onClick={() => {
              if (mode === 'week') {
                const d = parseIsoDate(weekIso[0])
                if (d) {
                  d.setDate(d.getDate() + 7)
                  pickDay(toIsoDate(d))
                }
              } else {
                setCursor(addMonths(cursor.year, cursor.month, 1))
              }
            }}
          >
            <ChevronRight size={18} />
          </button>
          <button
            type="button"
            className={btnGhost}
            onClick={() => {
              const t = new Date()
              setCursor({ year: t.getFullYear(), month: t.getMonth() })
              setSelectedDate(todayIso)
            }}
          >
            {t('calendar.today')}
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="inline-flex rounded-xl border border-sage-300 bg-white p-0.5">
            {[
              ['month', t('calendar.month')],
              ['week', t('calendar.week')],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={`min-h-10 rounded-lg px-3 text-sm font-medium ${
                  mode === id ? 'bg-sage-700 text-white' : 'text-sage-700 hover:bg-sage-100'
                }`}
                onClick={() => setMode(id)}
              >
                {label}
              </button>
            ))}
          </div>
          {canWriteRole(user) && (
            <button type="button" className={btnPrimary} onClick={() => openCreate(selectedDate)}>
              <Plus size={16} /> {t('calendar.newEvent')}
            </button>
          )}
        </div>
      </div>

      {mode === 'month' ? (
        <div className="overflow-x-auto rounded-2xl border border-sage-200 bg-sage-200/80 shadow-sm">
          <div className="grid min-w-[36rem] grid-cols-7 gap-px sm:min-w-0">
            {cal.weekdays.map((d) => (
              <div
                key={d}
                className="border-b border-sage-200 bg-sage-100 px-1 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-sage-600 sm:text-xs"
              >
                {d}
              </div>
            ))}
            {cells.map((cell) => dayButton(cell.iso, cell.day, cell.inMonth))}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-sage-200 bg-sage-200/80 sm:grid-cols-7">
          {weekIso.map((iso, i) => {
            const d = parseIsoDate(iso)
            const list = byDate[iso] || []
            const isSelected = iso === selectedDate
            const isToday = iso === todayIso
            return (
              <button
                key={iso}
                type="button"
                onClick={() => pickDay(iso)}
                className={`min-h-[8rem] bg-white p-2 text-left ${isSelected ? 'ring-2 ring-inset ring-sage-600' : ''} ${
                  isToday ? 'bg-sage-50' : ''
                }`}
              >
                <p className="text-[11px] font-semibold uppercase text-sage-500">{cal.weekdays[i]}</p>
                <p
                  className={`mb-2 inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold ${
                    isToday ? 'bg-sage-700 text-white' : 'text-sage-900'
                  }`}
                >
                  {d?.getDate()}
                </p>
                <div className="space-y-0.5">
                  {list.length === 0 ? (
                    <p className="text-[11px] text-sage-400">—</p>
                  ) : (
                    list.map(renderEventChip)
                  )}
                </div>
              </button>
            )
          })}
        </div>
      )}

      <div className="rounded-2xl border border-sage-200 bg-white/80 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="font-display text-lg capitalize text-sage-900">{formatDayLong(selectedDate)}</h3>
            <p className="text-xs text-sage-500">
              {dayEvents.length
                ? t('calendar.countDay', { n: dayEvents.length })
                : t('calendar.noneDay')}
            </p>
          </div>
          {canWriteRole(user) && (
            <button type="button" className={btnPrimary} onClick={() => openCreate(selectedDate)}>
              <Plus size={16} /> {t('calendar.createToday')}
            </button>
          )}
        </div>
        {dayEvents.length > 0 && (
          <ul className="mt-3 space-y-2">
            {dayEvents.map((ev) => (
              <li
                key={ev.id}
                className="flex flex-wrap items-start justify-between gap-2 rounded-xl border border-sage-200 bg-sage-50 px-3 py-2"
              >
                <div>
                  <p className="font-medium text-sage-900">
                    {ev.time ? `${ev.time} · ` : ''}
                    {ev.title}
                  </p>
                  {ev.description ? <p className="text-sm text-sage-700">{ev.description}</p> : null}
                </div>
                {canDeleteEntity(user, ev) && (
                  <button
                    type="button"
                    className={btnGhost + ' !text-danger'}
                    onClick={async () => {
                      if (confirm(t('calendar.confirmDelete'))) {
                        await deleteEvent(ev.id, user)
                        flash(t('calendar.deleted'))
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
      </div>

      {sorted.length === 0 ? (
        <EmptyState
          title={t('calendar.empty')}
          hint={t('calendar.emptyHint')}
          action={
            canWriteRole(user) ? (
              <button type="button" className={btnPrimary + ' mt-4'} onClick={() => openCreate(todayIso)}>
                <Plus size={16} /> {t('calendar.schedule')}
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
              <button type="button" className="min-w-0 flex-1 text-left" onClick={() => pickDay(toIsoDate(ev.date))}>
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
              </button>
              {canDeleteEntity(user, ev) && (
                <button
                  type="button"
                  className={btnGhost + ' !text-danger'}
                  onClick={async () => {
                    if (confirm(t('calendar.confirmDelete'))) {
                      await deleteEvent(ev.id, user)
                      flash(t('calendar.deleted'))
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

      <Modal open={open} title={t('calendar.newEvent')} onClose={() => setOpen(false)} asForm onSubmit={submit} submitLabel={t('calendar.schedule')}>
        <div>
          <Field label={t('calendar.title')}>
            <input
              className={inputClass}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
            />
          </Field>
          <Field label={t('calendar.description')}>
            <textarea
              className={inputClass}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
            <AutosaveLine status={eventAuto.status} savedAt={eventAuto.savedAt} />
            {eventDraft.hasDraft ? (
              <button type="button" className="mt-1 text-xs font-semibold text-sage-700 underline" onClick={eventDraft.clear}>
                {t('draft.clear')}
              </button>
            ) : null}
          </Field>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label={t('calendar.date')}>
              <input
                type="date"
                className={inputClass}
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                required
              />
            </Field>
            <Field label={t('calendar.time')}>
              <input
                type="time"
                className={inputClass}
                value={form.time}
                onChange={(e) => setForm({ ...form, time: e.target.value })}
                required
              />
            </Field>
          </div>
          <Field label={t('calendar.participants')}>
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
                <p className="text-xs text-sage-500">{t('common.inviteHint')}</p>
              )}
            </div>
          </Field>
        </div>
      </Modal>
    </div>
  )
}

function SearchView({ notes, ideas, projects, events, files = [], budgets = [], risks = [] }) {
  const { t, lang } = useI18n()
  const [q, setQ] = useState('')
  const [category, setCategory] = useState('')
  const [status, setStatus] = useState('')
  const [tag, setTag] = useState('')
  const [projectId, setProjectId] = useState('')
  const [external, setExternal] = useState([])
  const [extBusy, setExtBusy] = useState(false)
  const [extErr, setExtErr] = useState('')
  const [webHidden, setWebHidden] = useState(false)

  const query = q.trim().toLowerCase()

  const internal = useMemo(() => {
    const matchText = (obj) => {
      const blob = `${obj.title || ''} ${obj.name || ''} ${obj.description || ''} ${obj.content || ''} ${(obj.tags || []).join(' ')}`.toLowerCase()
      return !query || blob.includes(query)
    }
    const collect = (applyFilters) => {
      let n = notes.filter(matchText)
      let i = ideas.filter(matchText)
      let p = projects.filter(matchText)
      let e = events.filter(matchText)
      let f = files.filter(matchText)
      let b = budgets.filter(matchText)
      let r = risks.filter(matchText)
      if (applyFilters) {
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
      }
      const notesById = Object.fromEntries(notes.map((x) => [x.id, x]))
      return [
        ...n.map((x) => ({
          kind: x.parentId ? t('searchUi.subnote') : t('searchUi.note'),
          parentTitle: x.parentId ? notesById[x.parentId]?.title : '',
          ...x,
        })),
        ...i.map((x) => ({ kind: t('searchUi.idea'), ...x })),
        ...p.map((x) => ({ kind: t('searchUi.project'), ...x })),
        ...e.map((x) => ({ kind: t('searchUi.event'), ...x })),
        ...f.map((x) => ({ kind: t('searchUi.file'), title: x.name, ...x })),
        ...b.map((x) => ({ kind: t('searchUi.budget'), title: x.name, ...x })),
        ...r.map((x) => ({ kind: t('searchUi.risk'), ...x })),
      ]
    }
    const filtered = collect(true)
    if (filtered.length || !query) return filtered
    if (category || status || tag || projectId) return collect(false)
    return filtered
  }, [notes, ideas, projects, events, files, budgets, risks, query, category, status, tag, projectId, t])

  const runExternal = async () => {
    if (!query) return
    setExtBusy(true)
    setExtErr('')
    setWebHidden(false)
    try {
      const data = await searchWeb(q)
      const items = (data.results || []).map((r) => ({
        title: r.title,
        snippet: r.snippet,
        url: r.url,
        source: r.source || 'DuckDuckGo',
        searchedAt: data.searchedAt,
      }))
      setExternal(items.slice(0, 12))
      setExtErr(items.length ? '' : WEB_EMPTY_MESSAGE)
    } catch (err) {
      setExternal([])
      if (err?.offline || (typeof navigator !== 'undefined' && navigator.onLine === false)) {
        setWebHidden(true)
        setExtErr('')
      } else {
        setExtErr(WEB_EMPTY_MESSAGE)
      }
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
              placeholder={t('searchUi.placeholder')}
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <button type="button" className={btnPrimary} onClick={runExternal} disabled={extBusy || !query}>
            <ExternalLink size={16} /> {extBusy ? t('searchUi.searching') : t('searchUi.external')}
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <select className={inputClass + ' max-w-full md:!w-auto'} value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">{t('searchUi.category')}</option>
            {NOTE_CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <select className={inputClass + ' max-w-full md:!w-auto'} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">{t('searchUi.status')}</option>
            {[...IDEA_STATUSES, ...PROJECT_STATUSES].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <input
            className={inputClass + ' w-full max-w-full md:!w-40'}
            placeholder={t('searchUi.tag')}
            value={tag}
            onChange={(e) => setTag(e.target.value)}
          />
          <select className={inputClass + ' max-w-full md:!w-auto'} value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            <option value="">{t('searchUi.project')}</option>
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
          <Filter size={16} /> {t('searchUi.internalResults', { n: internal.length })}
        </h2>
        {internal.length === 0 ? (
          <p className="text-sm text-sage-500">
            {query ? t('searchUi.noInternal') : t('searchUi.typeKeyword')}
          </p>
        ) : (
          <ul className="space-y-2">
            {internal.map((item) => (
              <li key={`${item.kind}-${item.id}`} className="rounded-xl border border-sage-200 bg-white/70 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-sage-500">{item.kind}</p>
                <p className="font-medium text-sage-900">{item.title}</p>
                <p className="line-clamp-2 text-sm text-sage-600">
                  {item.parentTitle ? `${t('searchUi.underTitle', { title: item.parentTitle })} · ` : ''}
                  {item.description || item.content || item.status || ''}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {!webHidden && (
        <section>
          <h2 className="mb-3 font-display text-lg text-sage-900">{t('searchUi.web')}</h2>
          {extErr && <p className="mb-2 text-sm text-sage-500">{extErr}</p>}
          {external.length === 0 && !extErr && (
            <p className="text-sm text-sage-500">{t('searchUi.webLaunch')}</p>
          )}
          {external[0]?.searchedAt && (
            <p className="mb-2 text-xs text-sage-500">
              {t('searchUi.webOf', { date: new Date(external[0].searchedAt).toLocaleString(dateLocale(lang)) })}
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
      )}
    </div>
  )
}

function ExportView({ notes, ideas, projects, events, flash }) {
  const { t } = useI18n()
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
      flash(t('exportUi.downloaded', { kind: kind.toUpperCase() }))
    } catch (err) {
      flash(err.message || t('exportUi.failed'), 'err')
    }
  }

  return (
    <div className="animate-fade-up">
      <p className="mb-4 max-w-2xl text-sm text-sage-600">{t('exportUi.hint')}</p>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {[
          ['csv', t('exportUi.csv')],
          ['xlsx', t('exportUi.xlsx')],
          ['docx', t('exportUi.docx')],
          ['json', t('exportUi.json')],
          ['pdf', t('exportUi.pdf')],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => run(id)}
            className="rounded-2xl border border-sage-200 bg-white/80 p-5 text-left transition hover:border-sage-500 hover:bg-sage-50"
          >
            <Download className="text-sage-600" size={22} />
            <p className="mt-3 font-display text-lg text-sage-900">{label}</p>
            <p className="text-xs text-sage-500">{t('exportUi.rows', { n: rows.length })}</p>
          </button>
        ))}
      </div>
    </div>
  )
}

function NotificationsView({ notifications, flash, user }) {
  const { t, lang } = useI18n()
  return (
    <div className="space-y-4 animate-fade-up">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={btnPrimary}
          onClick={async () => {
            await markAllNotificationsRead(user.id)
            flash(t('notif.marked'))
          }}
        >
          <Check size={16} /> {t('notif.markAll')}
        </button>
      </div>
      {notifications.length === 0 ? (
        <EmptyState title={t('empty.notificationsTitle')} hint={t('empty.notificationsHint')} />
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
                    {new Date(n.createdAt).toLocaleString(dateLocale(lang))}
                  </p>
                </div>
                {!n.read && (
                  <button
                    type="button"
                    className={btnGhost}
                    onClick={() => markNotificationRead(n.id)}
                  >
                    {t('notif.read')}
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
  const { t, lang } = useI18n()
  const [fullName, setFullName] = useState(user.fullName)
  const [code, setCode] = useState('')
  const [diag, setDiag] = useState(null)
  const [soundOn, setSoundOn] = useState(readSoundPref)
  const sessions = listSessionsForUser(user.id)

  useEffect(() => {
    setFullName(user.fullName)
  }, [user])

  return (
    <div className="space-y-6 animate-fade-up">
      <section className="rounded-2xl border border-sage-200 bg-white/80 p-5">
        <h2 className="flex items-center gap-2 font-display text-lg text-sage-900">
          <Users size={18} /> {t('settingsUi.profile')}
        </h2>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          <Field label={t('settingsUi.fullName')}>
            <input className={inputClass} value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </Field>
          <Field label={t('auth.email')}>
            <input className={inputClass} value={user.email} disabled />
          </Field>
          <Field label={t('settingsUi.role')}>
            <input className={inputClass} value={user.role} disabled />
          </Field>
          <Field label={t('settingsUi.emailVerified')}>
            <input className={inputClass} value={user.emailVerified ? t('settingsUi.yes') : t('settingsUi.no')} disabled />
          </Field>
        </div>
        <button
          type="button"
          className={btnPrimary + ' mt-2'}
          onClick={async () => {
            await updateProfile(user.id, { fullName })
            await onUserUpdated()
            flash(t('settingsUi.profileUpdated'))
          }}
        >
          {t('settingsUi.saveProfile')}
        </button>

        {!user.emailVerified && (
          <div className="mt-4 rounded-xl border border-warn/30 bg-warn/10 p-3">
            <p className="text-sm font-medium text-sage-900">{VERIFY_EMAIL.subject}</p>
            <p className="mt-1 text-sm text-sage-800">
              {VERIFY_EMAIL.summary(user.email)} Cliquez le lien, ou saisissez le code à 6 chiffres.
            </p>
            <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-white/70 px-3 py-2 text-[11px] leading-relaxed text-sage-700">
              {VERIFY_EMAIL.body(user.email, '______')}
            </pre>
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
                    flash(t('settingsUi.emailVerifiedToast'))
                  } catch (err) {
                    flash(err.message, 'err')
                  }
                }}
              >
                {t('settingsUi.verify')}
              </button>
              <button
                type="button"
                className={btnGhost}
                onClick={async () => {
                  try {
                    await verifyEmail(user.id, '')
                    await onUserUpdated()
                    flash(t('settingsUi.firebaseVerified'))
                  } catch (err) {
                    flash(err.message, 'err')
                  }
                }}
              >
                {t('settingsUi.clickedLink')}
              </button>
              <button
                type="button"
                className={btnGhost}
                onClick={async () => {
                  try {
                    await resendVerificationEmail()
                    flash(VERIFY_EMAIL.summary(user.email), 'ok')
                  } catch (err) {
                    flash(`${err.message}. ${firebaseUnavailableLine()}`, 'err')
                  }
                }}
              >
                <Mail size={14} /> {t('settingsUi.resendEmail')}
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-sage-200 bg-white/80 p-5">
        <h2 className="flex items-center gap-2 font-display text-lg text-sage-900">
          <Shield size={18} /> {t('settingsUi.sessions')}
        </h2>
        <ul className="mt-3 space-y-2">
          {sessions.map((s) => (
            <li
              key={s.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-sage-50 px-3 py-2 text-sm"
            >
              <div>
                <p className="font-medium text-sage-900">
                  {s.active ? t('settingsUi.active') : t('settingsUi.revoked')}
                  {session?.id === s.id ? t('settingsUi.currentSession') : ''}
                </p>
                <p className="text-xs text-sage-500">
                  {t('settingsUi.created', { date: new Date(s.createdAt).toLocaleString(dateLocale(lang)) })} ·{' '}
                  {t('settingsUi.expires', { date: new Date(s.expiresAt).toLocaleString(dateLocale(lang)) })}
                </p>
              </div>
              {s.active && (
                <button
                  type="button"
                  className={btnGhost + ' !text-danger'}
                  onClick={async () => {
                    await revokeSession(s.id, user)
                    await onUserUpdated()
                    flash(t('settingsUi.revokedToast'))
                  }}
                >
                  {t('settingsUi.revoke')}
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-sage-200 bg-white/80 p-5">
        <h2 className="flex items-center gap-2 font-display text-lg text-sage-900">
          <Volume2 size={18} /> {t('settingsUi.soundTitle')}
        </h2>
        <p className="mt-2 text-sm text-sage-700">{t('settingsUi.soundHint')}</p>
        <label className="mt-3 flex min-h-11 cursor-pointer items-center gap-2 text-sm font-medium text-sage-800">
          <input
            type="checkbox"
            className="h-4 w-4 accent-sage-700"
            checked={soundOn}
            onChange={(e) => {
              const on = e.target.checked
              setSoundOn(on)
              writeSoundPref(on)
              flash(on ? t('settingsUi.soundEnabled') : t('settingsUi.soundMuted'))
            }}
          />
          {t('settingsUi.soundOn')}
        </label>
      </section>

      <AiSettingsBlock user={user} allowExternal={allowExternal} onChange={onAllowExternal} />

      <section className="rounded-2xl border border-sage-200 bg-white/80 p-5">
        <h2 className="flex items-center gap-2 font-display text-lg text-sage-900">
          <FolderOpen size={18} /> {t('settingsUi.filesTitle')}
        </h2>
        <p className="mt-2 text-sm text-sage-700">
          {t('settingsUi.filesMax', { size: maxFileSizeLabel() })}
        </p>
        <p className="mt-1 text-sm text-sage-600">
          {t('settingsUi.filesTypes', { exts: ALLOWED_FILE_EXTS.join(', ') })}
        </p>
        <p className="mt-2 text-xs text-sage-500">
          La région Firebase Storage ne peut pas être définie depuis le client. Choisissez-la dans
          Firebase Console <strong>avant</strong> de créer le bucket. Bucket attendu :{' '}
          <code className="rounded bg-sage-100 px-1">partagio.firebasestorage.app</code>.
        </p>
      </section>

      <section className="rounded-2xl border border-sage-200 bg-white/80 p-5">
        <h2 className="flex items-center gap-2 font-display text-lg text-sage-900">
          <Database size={18} /> {t('settingsUi.diagTitle')}
        </h2>
        <p className="mt-2 text-sm text-sage-600">
          Mode actuel : <strong>{getBackendMode()}</strong>
          {firebaseConfigured
            ? ' — Auth + Firestore actifs. Vérification et reset passent par les e-mails Firebase. Collez firestore.rules (isolation) dans la console.'
            : ' — repli localStorage. Remplissez VITE_FIREBASE_* dans .env puis redémarrez Vite pour brancher Firebase.'}
        </p>
        {!firebaseConfigured && (
          <div className="mt-3 rounded-xl border border-warn/30 bg-warn/10 p-3 text-sm text-sage-800">
            <p className="font-medium">{t('settingsUi.firebaseMissing')}</p>
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
            {getFirebaseStatus().authReady ? t('settingsUi.firebaseOk') : t('settingsUi.firebaseDown')} · Firestore{' '}
            {getFirebaseStatus().firestoreReady ? t('settingsUi.firebaseOk') : t('settingsUi.firebaseDown')} · Storage{' '}
            {getFirebaseStatus().storageReady ? t('settingsUi.firebaseOk') : t('settingsUi.firebaseDown')}
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className={btnGhost}
            onClick={() => setDiag(diagnoseDatabase())}
          >
            <RefreshCw size={14} /> {t('settingsUi.diagnose')}
          </button>
          <button
            type="button"
            className={btnGhost}
            onClick={async () => {
              const kit = await exportDeploymentKit()
              exportJSON(kit, 'nazix-deployment-kit.json')
              flash(t('settingsUi.exportKit'))
            }}
          >
            <Download size={14} /> {t('settingsUi.exportKitBtn')}
          </button>
          {isAdmin(user) && (
            <>
              <button
                type="button"
                className={btnGhost}
                onClick={async () => {
                  try {
                    setDiag(await pushLocalToFirebase())
                    flash(t('settingsUi.pushOk'))
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
                    flash(t('settingsUi.pullOk'))
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
  const { t, lang } = useI18n()
  const present = new Set(presentIds)
  const sorted = [...users].sort((a, b) =>
    String(a.fullName || '').localeCompare(String(b.fullName || ''), dateLocale(lang)),
  )

  if (sorted.length === 0) {
    return <EmptyState title={t('empty.teamTitle')} hint={t('empty.teamHint')} />
  }

  return (
    <div className="space-y-3 animate-fade-up">
      <p className="text-sm text-sage-600">
        {sorted.length === 1
          ? t('teamUi.countOne', { n: sorted.length })
          : t('teamUi.countMany', { n: sorted.length })}
      </p>
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
                    {online ? t('teamUi.online') : t('teamUi.offline')}
                  </span>
                </div>
                <p className="break-all text-sm text-sage-600 md:truncate md:break-normal">{u.email}</p>
                <p className="mt-1 text-xs text-sage-500">{valueLabel(lang, u.role)}</p>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function ChatView({ user, groups, messages, users, flash, readMap, onReadGroup }) {
  const { t, lang } = useI18n()
  const [selectedId, setSelectedId] = useState(null)
  const [draft, setDraft] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [groupName, setGroupName] = useState('')
  const [picked, setPicked] = useState([])
  const [busy, setBusy] = useState(false)
  const onReadRef = useRef(onReadGroup)
  onReadRef.current = onReadGroup

  useEffect(() => {
    ensureGeneralGroup(user).catch((err) => flash(err.message || t('chatUi.unavailable'), 'err'))
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

  const nameOf = (id, fallback) => users.find((u) => u.id === id)?.fullName || fallback || 'Membre'

  const submitMessage = async () => {
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
      flash(t('chatUi.created'))
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
      flash(t('chatUi.invited'))
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
    <div className="flex h-[calc(100dvh-8rem)] max-h-[calc(100dvh-8rem)] flex-col overflow-hidden rounded-2xl border border-sage-200 bg-white/80 lg:h-[72vh] lg:max-h-[72vh] lg:flex-row">
      <aside
        className={`${showThread ? 'hidden lg:flex' : 'flex'} min-h-0 w-full min-w-0 flex-col overflow-hidden border-sage-200 lg:h-full lg:w-72 lg:shrink-0 lg:border-r`}
      >
        <div className="flex items-center justify-between gap-2 border-b border-sage-100 p-3">
          <p className="font-display text-lg text-sage-900">{t('chatUi.groups')}</p>
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
              <span className="sm:inline">{t('chatUi.new')}</span>
            </button>
          )}
        </div>
        {groups.length === 0 ? (
          <p className="p-4 text-sm text-sage-500">{t('chatUi.none')}</p>
        ) : (
          <ul className="min-h-0 flex-1 overflow-y-auto xx-scroll">
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

      <section className={`${showThread ? 'flex' : 'hidden lg:flex'} min-h-0 min-w-0 flex-1 flex-col overflow-hidden`}>
        {!selected ? (
          <div className="flex flex-1 items-center justify-center p-6">
            <EmptyState title={t('empty.chatTitle')} hint={t('empty.chatHint')} />
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
            {/* // CHAT-LAYER START */}
            <StableChatPane
              threadKey={selected.id}
              messages={thread}
              draft={draft}
              onDraftChange={setDraft}
              onSend={submitMessage}
              busy={busy}
              renderMessage={(m) => {
                const mine = m.authorId === user.id
                return (
                  <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
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
                        {m.createdAt ? new Date(m.createdAt).toLocaleString(dateLocale(lang)) : ''}
                      </p>
                    </div>
                  </div>
                )
              }}
            />
            {/* // CHAT-LAYER END */}
          </>
        )}
      </section>

      <Modal open={createOpen} title={t('chatUi.newGroup')} onClose={() => setCreateOpen(false)} asForm onSubmit={createGroup} submitLabel={t('common.create')} busy={busy}>
        <div>
          <Field label={t('chatUi.name')}>
            <input
              className={inputClass}
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              required
            />
          </Field>
          <Field label={t('chatUi.invite')}>
            <div className="flex flex-wrap gap-2 rounded-xl border border-sage-200 bg-white p-3">
              {users.filter((u) => u.id !== user.id).length === 0 && (
                <p className="text-xs text-sage-500">{t('chatUi.noAccounts')}</p>
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
        </div>
      </Modal>

      <Modal
        open={inviteOpen}
        title={t('chatUi.inviteTitle')}
        onClose={() => setInviteOpen(false)}
        asForm
        onSubmit={invite}
        submitLabel={t('chatUi.add')}
        busy={busy}
      >
        <div>
          {outsiders.length === 0 ? (
            <p className="text-sm text-sage-600">{t('chatUi.allMembers')}</p>
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
        </div>
      </Modal>
    </div>
  )
}
