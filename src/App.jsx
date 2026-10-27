import { useEffect, useMemo, useState } from 'react'
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
} from 'lucide-react'
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
  pushLocalToFirebase,
  pullFirebaseToLocal,
} from './lib/store'
import { firebaseConfigured, missingFirebaseVars, getFirebaseStatus } from './lib/firebase'
import { canReadEntity, canEditEntity, canDeleteEntity, isAdmin, ROLES } from './lib/rbac'
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

const NAV = [
  { id: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
  { id: 'notes', label: 'Notes', icon: StickyNote },
  { id: 'ideas', label: 'Boîte à idées', icon: Lightbulb },
  { id: 'projects', label: 'Projets', icon: FolderKanban },
  { id: 'calendar', label: 'Calendrier', icon: CalendarDays },
  { id: 'search', label: 'Recherche', icon: Search },
  { id: 'export', label: 'Exportation', icon: Download },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'settings', label: 'Paramètres', icon: Settings },
]

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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-3 sm:items-center">
      <button type="button" className="absolute inset-0" aria-label="Fermer" onClick={onClose} />
      <div
        className={`relative z-10 max-h-[92vh] w-full overflow-y-auto rounded-2xl bg-sage-50 p-5 shadow-xl animate-fade-up xx-scroll ${
          wide ? 'max-w-3xl' : 'max-w-lg'
        }`}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <h3 className="font-display text-xl text-sage-900">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-sage-600 hover:bg-sage-200"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
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
  'w-full rounded-xl border border-sage-300 bg-white px-3 py-2.5 text-sage-900 outline-none ring-sage-400 placeholder:text-sage-400 focus:ring-2'
const btnPrimary =
  'inline-flex items-center justify-center gap-2 rounded-xl bg-sage-700 px-4 py-2.5 text-sm font-semibold text-sage-50 transition hover:bg-sage-800 disabled:opacity-50'
const btnGhost =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-sage-300 bg-white/70 px-3 py-2 text-sm font-medium text-sage-800 transition hover:bg-sage-100'

function ShareEditor({ users, shares, onChange, excludeId }) {
  const options = users.filter((u) => u.id !== excludeId)
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
              className={inputClass + ' !w-auto py-1.5'}
              value={share?.permission || ''}
              onChange={(e) => {
                const permission = e.target.value
                const next = shares.filter((s) => s.userId !== u.id)
                if (permission) next.push({ userId: u.id, permission })
                onChange(next)
              }}
            >
              <option value="">Aucun</option>
              <option value="Lecture seule">Lecture seule</option>
              <option value="Édition">Édition</option>
            </select>
          </div>
        )
      })}
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

  const flash = (message, type = 'ok') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3200)
  }

  useEffect(() => {
    let unsub = () => {}
    ;(async () => {
      await bootStore()
      unsub = subscribeStore(setDb)
      const current = await getCurrentSession()
      if (current) {
        setUser(current.user)
        setSession(current.session)
      }
      setBooting(false)
    })()
    return () => unsub()
  }, [])

  const users = useMemo(() => (db ? listUsers() : []), [db])
  const notes = useMemo(
    () =>
      db && user
        ? Object.values(db.xx_notes).filter((n) => canReadEntity(user, n))
        : [],
    [db, user],
  )
  const ideas = useMemo(
    () =>
      db && user
        ? Object.values(db.xx_ideas).filter((i) => canReadEntity(user, i))
        : [],
    [db, user],
  )
  const projects = useMemo(
    () =>
      db && user
        ? Object.values(db.xx_projects).filter((p) => canReadEntity(user, p))
        : [],
    [db, user],
  )
  const events = useMemo(
    () =>
      db && user
        ? Object.values(db.xx_events).filter((e) => canReadEntity(user, e))
        : [],
    [db, user],
  )
  const notifications = useMemo(
    () =>
      db && user
        ? Object.values(db.xx_notifications)
            .filter((n) => n.userId === user.id)
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        : [],
    [db, user],
  )
  const unread = notifications.filter((n) => !n.read).length

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
        const res = await registerUser(authForm)
        flash(`Compte créé. Code de vérification : ${res.verificationCode}`)
        const logged = await loginUser(authForm.email, authForm.password)
        setUser(logged.user)
        setSession(logged.session)
      } else if (authMode === 'forgot') {
        const res = await requestPasswordReset(authForm.email)
        flash(
          res.debugToken
            ? `Jeton généré (aussi en notification) : ${res.debugToken}`
            : 'Si le compte existe, un jeton a été envoyé.',
        )
        setAuthMode('reset')
      } else if (authMode === 'reset') {
        await resetPasswordWithToken(authForm.resetToken, authForm.newPassword)
        flash('Mot de passe mis à jour. Vous pouvez vous connecter.')
        setAuthMode('login')
      }
    } catch (err) {
      flash(err.message || 'Erreur', 'err')
    } finally {
      setAuthBusy(false)
    }
  }

  const handleLogout = async () => {
    await logoutCurrentSession()
    setUser(null)
    setSession(null)
    setView('dashboard')
  }

  if (booting) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center animate-fade-up">
          <p className="font-display text-3xl text-sage-800">XXDashboard</p>
          <p className="mt-2 animate-soft-pulse text-sm text-sage-600">Chargement sécurisé…</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-md animate-fade-up">
          <div className="mb-8 text-center">
            <p className="font-display text-4xl tracking-tight text-sage-800 sm:text-5xl">
              XXDashboard
            </p>
            <p className="mt-2 text-sage-600">
              Notes, idées Kanban, projets et activités — en temps réel.
            </p>
          </div>
          <form
            onSubmit={handleAuth}
            className="rounded-3xl border border-sage-200 bg-white/80 p-6 shadow-sm backdrop-blur"
          >
            {firebaseConfigured ? (
              <div className="mb-4 rounded-xl border border-sage-200 bg-sage-50 px-3 py-2 text-xs text-sage-700">
                Backend <strong>Firebase</strong> — connexion et inscription écrivent dans Auth
                et Firestore.
              </div>
            ) : (
              <div className="mb-4 rounded-xl border border-warn/40 bg-warn/10 px-3 py-2.5 text-sm text-sage-800">
                <p className="font-semibold">Mode local — Firebase n’est pas configuré.</p>
                <p className="mt-1 text-xs text-sage-600">
                  Copiez <code className="rounded bg-white px-1">.env.example</code> vers{' '}
                  <code className="rounded bg-white px-1">.env</code>, renseignez{' '}
                  <code className="rounded bg-white px-1">VITE_FIREBASE_*</code> (console
                  Firebase → paramètres du projet), activez E-mail/mot de passe, puis
                  redémarrez Vite. Les comptes resteront ensuite dans Auth + Firestore.
                  Variables manquantes : {missingFirebaseVars.join(', ') || 'aucune'}.
                </p>
              </div>
            )}
            <div className="mb-5 flex gap-2 text-sm">
              {[
                ['login', 'Connexion'],
                ['register', 'Inscription'],
                ['forgot', 'Mot de passe'],
              ].map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setAuthMode(id === 'forgot' ? 'forgot' : id)}
                  className={`rounded-full px-3 py-1.5 ${
                    authMode === id || (id === 'forgot' && authMode === 'reset')
                      ? 'bg-sage-700 text-white'
                      : 'bg-sage-100 text-sage-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {authMode === 'register' && (
              <Field label="Nom complet">
                <input
                  className={inputClass}
                  value={authForm.fullName}
                  onChange={(e) => setAuthForm({ ...authForm, fullName: e.target.value })}
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
                  placeholder="vous@entreprise.fr"
                  required
                />
              </Field>
            )}

            {(authMode === 'login' || authMode === 'register') && (
              <Field label={`Mot de passe (min. ${getMinPasswordLength()} caractères)`}>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    className={inputClass + ' pr-10'}
                    value={authForm.password}
                    onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                    minLength={getMinPasswordLength()}
                    required
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-sage-500"
                    onClick={() => setShowPass((v) => !v)}
                  >
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </Field>
            )}

            {authMode === 'reset' && (
              <>
                <Field label="Jeton temporaire">
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
                    required
                  />
                </Field>
              </>
            )}

            <button type="submit" className={btnPrimary + ' mt-2 w-full'} disabled={authBusy}>
              {authBusy
                ? 'Patientez…'
                : authMode === 'login'
                  ? 'Se connecter'
                  : authMode === 'register'
                    ? "S'inscrire"
                    : authMode === 'forgot'
                      ? 'Générer un jeton'
                      : 'Réinitialiser'}
            </button>

            <p className="mt-4 text-center text-xs text-sage-500">
              Admin par défaut : admin@xxdashboard.fr / Admin123!
            </p>
          </form>
        </div>
        {toast && <Toast toast={toast} />}
      </div>
    )
  }

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[260px_1fr]">
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-[260px] border-r border-sage-200 bg-sage-800 text-sage-50 transition lg:static ${
          mobileNav ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex h-full flex-col p-4">
          <div className="mb-6 flex items-center justify-between px-2 pt-2">
            <div>
              <p className="font-display text-2xl leading-none">XXDashboard</p>
              <p className="mt-1 text-xs text-sage-300">
                {getBackendMode() === 'firebase' ? 'Firebase' : 'Mode local'} · {user.role}
              </p>
            </div>
            <button type="button" className="lg:hidden" onClick={() => setMobileNav(false)}>
              <X size={20} />
            </button>
          </div>
          <nav className="flex-1 space-y-1 xx-scroll overflow-y-auto">
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
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${
                    active ? 'bg-sage-600 text-white' : 'text-sage-100 hover:bg-sage-700'
                  }`}
                >
                  <Icon size={18} />
                  <span className="flex-1">{item.label}</span>
                  {item.id === 'notifications' && unread > 0 && (
                    <span className="rounded-full bg-cream-green px-2 py-0.5 text-[11px] font-bold text-sage-800">
                      {unread}
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

      <div className="min-w-0">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-sage-200/80 bg-cream-green/80 px-4 py-3 backdrop-blur">
          <button
            type="button"
            className="rounded-lg p-2 text-sage-800 hover:bg-sage-200 lg:hidden"
            onClick={() => setMobileNav(true)}
          >
            <Menu size={20} />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-xl text-sage-900 sm:text-2xl">
              {NAV.find((n) => n.id === view)?.label}
            </h1>
          </div>
          {!user.emailVerified && (
            <span className="hidden rounded-full bg-warn/15 px-3 py-1 text-xs font-semibold text-warn sm:inline">
              E-mail non vérifié
            </span>
          )}
        </header>

        <main className="p-4 sm:p-6">
          {view === 'dashboard' && (
            <DashboardView
              notes={notes}
              ideas={ideas}
              projects={projects}
              events={events}
              users={users}
              onQuick={(v) => setView(v)}
            />
          )}
          {view === 'notes' && (
            <NotesView user={user} notes={notes} users={users} projects={projects} flash={flash} />
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
              users={users}
              flash={flash}
            />
          )}
          {view === 'calendar' && (
            <CalendarView user={user} events={events} users={users} flash={flash} />
          )}
          {view === 'search' && (
            <SearchView notes={notes} ideas={ideas} projects={projects} events={events} />
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
            />
          )}
        </main>
      </div>
      {toast && <Toast toast={toast} />}
    </div>
  )
}

function Toast({ toast }) {
  return (
    <div
      className={`fixed bottom-4 right-4 z-[60] max-w-sm rounded-xl px-4 py-3 text-sm shadow-lg animate-slide-in ${
        toast.type === 'err' ? 'bg-danger text-white' : 'bg-sage-800 text-sage-50'
      }`}
    >
      {toast.message}
    </div>
  )
}

function DashboardView({ notes, ideas, projects, events, users, onQuick }) {
  const byStatus = PROJECT_STATUSES.map((s) => ({
    status: s,
    count: projects.filter((p) => p.status === s).length,
  }))
  const upcoming = events
    .filter((e) => e.date && new Date(`${e.date}T${e.time || '00:00'}`) >= new Date(Date.now() - 86400000))
    .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))
    .slice(0, 5)

  const cards = [
    { label: 'Notes', value: notes.length, tone: 'bg-sage-100' },
    { label: 'Idées', value: ideas.length, tone: 'bg-sage-200/70' },
    { label: 'Projets', value: projects.length, tone: 'bg-sage-100' },
    { label: 'Collaborateurs', value: users.length, tone: 'bg-sage-200/70' },
  ]

  return (
    <div className="space-y-6 animate-fade-up">
      <section className="rounded-3xl border border-sage-200 bg-gradient-to-br from-sage-700 to-sage-900 p-6 text-sage-50 sm:p-8">
        <p className="font-display text-3xl sm:text-4xl">Vue d’ensemble</p>
        <p className="mt-2 max-w-2xl text-sage-200">
          Indicateurs synchronisés depuis la base — aucune donnée fictive. Créez vos premiers
          contenus via les raccourcis.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          {[
            ['notes', 'Nouvelle note'],
            ['ideas', 'Nouvelle idée'],
            ['projects', 'Nouveau projet'],
            ['calendar', 'Nouvel événement'],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => onQuick(id)}
              className="inline-flex items-center gap-2 rounded-xl bg-cream-green px-3 py-2 text-sm font-semibold text-sage-900 hover:bg-white"
            >
              <Plus size={16} /> {label}
            </button>
          ))}
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
    </div>
  )
}

function NotesView({ user, notes, users, projects, flash }) {
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
    }
  }

  const filtered =
    filterCat === 'Tous' ? notes : notes.filter((n) => n.category === filterCat)

  const openCreate = () => {
    setEditing(null)
    setForm(emptyNote())
    setOpen(true)
  }

  const openEdit = (n) => {
    setEditing(n)
    setForm({
      title: n.title || '',
      content: n.content || '',
      category: n.category || 'Général',
      tags: (n.tags || []).join(', '),
      visibility: n.visibility || 'Privée',
      shares: n.shares || [],
      projectId: n.projectId || '',
    })
    setOpen(true)
  }

  const submit = async (e) => {
    e.preventDefault()
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
      }
      const saved = await saveNote(payload, user)
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
    await deleteNote(id)
    setConfirmId(null)
    flash('Note supprimée.')
  }

  return (
    <div className="space-y-4 animate-fade-up">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={btnPrimary} onClick={openCreate}>
          <Plus size={16} /> Nouvelle note
        </button>
        <select
          className={inputClass + ' !w-auto'}
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
            <button type="button" className={btnPrimary + ' mt-4'} onClick={openCreate}>
              <Plus size={16} /> Créer une note
            </button>
          }
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((n) => (
            <article
              key={n.id}
              className="rounded-2xl border border-sage-200 bg-white/80 p-4 transition hover:border-sage-400"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-display text-lg text-sage-900">{n.title}</h3>
                  <p className="text-xs text-sage-500">
                    {n.category} · {n.visibility}
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
            </article>
          ))}
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
          <div className="grid gap-3 sm:grid-cols-2">
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
          {form.visibility !== 'Privée' && (
            <ShareEditor
              users={users}
              shares={form.shares}
              excludeId={user.id}
              onChange={(shares) => setForm({ ...form, shares })}
            />
          )}
          <button type="submit" className={btnPrimary + ' mt-3 w-full'}>
            <Check size={16} /> Enregistrer
          </button>
        </form>
      </Modal>

      <Modal open={Boolean(confirmId)} title="Confirmer la suppression" onClose={() => setConfirmId(null)}>
        <p className="text-sm text-sage-700">Cette action est définitive.</p>
        <div className="mt-4 flex gap-2">
          <button type="button" className={btnGhost} onClick={() => setConfirmId(null)}>
            Annuler
          </button>
          <button
            type="button"
            className={btnPrimary + ' !bg-danger'}
            onClick={() => remove(confirmId)}
          >
            Supprimer
          </button>
        </div>
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
      <button type="button" className={btnPrimary} onClick={openCreate}>
        <Plus size={16} /> Nouvelle idée
      </button>

      {ideas.length === 0 ? (
        <EmptyState
          title="Boîte à idées vide"
          hint="Ajoutez une idée puis faites glisser son statut sur le Kanban."
          action={
            <button type="button" className={btnPrimary + ' mt-4'} onClick={openCreate}>
              <Plus size={16} /> Ajouter une idée
            </button>
          }
        />
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2 xx-scroll">
          {byCol.map((col) => (
            <div
              key={col.status}
              className="w-[260px] shrink-0 rounded-2xl border border-sage-200 bg-sage-100/60 p-3"
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
          <button type="submit" className={btnPrimary + ' mt-3 w-full'}>
            Enregistrer
          </button>
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
            <div className="flex flex-wrap gap-2">
              {canEditEntity(user, detail) && (
                <button
                  type="button"
                  className={btnGhost}
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
                  className={btnGhost + ' !text-danger'}
                  onClick={async () => {
                    await deleteIdea(detail.id)
                    setDetail(null)
                    flash('Idée supprimée.')
                  }}
                >
                  <Trash2 size={14} /> Supprimer
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

function ProjectsView({ user, projects, notes, ideas, users, flash }) {
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
      <button type="button" className={btnPrimary} onClick={openCreate}>
        <Plus size={16} /> Nouveau projet
      </button>

      {projects.length === 0 ? (
        <EmptyState
          title="Aucun projet"
          hint="Définissez un projet avec responsable, membres et progression."
          action={
            <button type="button" className={btnPrimary + ' mt-4'} onClick={openCreate}>
              <Plus size={16} /> Créer un projet
            </button>
          }
        />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
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
                          await deleteProject(p.id)
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
        <form onSubmit={submit} className="grid gap-1 sm:grid-cols-2 sm:gap-x-4">
          <div className="sm:col-span-2">
            <Field label="Titre">
              <input
                className={inputClass}
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
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
          <div className="sm:col-span-2">
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
                        className={`rounded-lg px-2.5 py-1 text-xs ${
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
          <div className="sm:col-span-2">
            <ShareEditor
              users={users}
              shares={form.shares}
              excludeId={user.id}
              onChange={(shares) => setForm({ ...form, shares })}
            />
          </div>
          <div className="sm:col-span-2">
            <button type="submit" className={btnPrimary + ' w-full'}>
              Enregistrer
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={Boolean(detail)} title={detail?.title || ''} onClose={() => setDetail(null)} wide>
        {detail && (
          <div className="space-y-4 text-sm">
            <p className="text-sage-700">{detail.description}</p>
            <p className="text-sage-500">
              {detail.startDate || '—'} → {detail.dueDate || '—'} · {detail.progress ?? 0}%
            </p>
            <div>
              <h4 className="font-semibold text-sage-800">Notes rattachées</h4>
              <ul className="mt-2 space-y-1">
                {notes.filter((n) => n.projectId === detail.id).length === 0 && (
                  <li className="text-sage-500">Aucune</li>
                )}
                {notes
                  .filter((n) => n.projectId === detail.id)
                  .map((n) => (
                    <li key={n.id}>{n.title}</li>
                  ))}
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-sage-800">Idées liées</h4>
              <ul className="mt-2 space-y-1">
                {ideas.filter((i) => i.id === detail.linkedIdeaId || i.projectId === detail.id)
                  .length === 0 && <li className="text-sage-500">Aucune</li>}
                {ideas
                  .filter((i) => i.id === detail.linkedIdeaId || i.projectId === detail.id)
                  .map((i) => (
                    <li key={i.id}>
                      {i.title} ({i.status})
                    </li>
                  ))}
              </ul>
            </div>
          </div>
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
      <button type="button" className={btnPrimary} onClick={() => setOpen(true)}>
        <Plus size={16} /> Nouvel événement
      </button>

      {sorted.length === 0 ? (
        <EmptyState
          title="Calendrier vide"
          hint="Planifiez un rendez-vous et notifiez les participants."
          action={
            <button type="button" className={btnPrimary + ' mt-4'} onClick={() => setOpen(true)}>
              <Plus size={16} /> Planifier
            </button>
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
                      await deleteEvent(ev.id)
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
          <div className="grid grid-cols-2 gap-3">
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
                      className={`rounded-lg px-2.5 py-1 text-xs ${
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
          <button type="submit" className={btnPrimary + ' w-full'}>
            Planifier
          </button>
        </form>
      </Modal>
    </div>
  )
}

function SearchView({ notes, ideas, projects, events }) {
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
      const blob = `${obj.title || ''} ${obj.description || ''} ${obj.content || ''} ${(obj.tags || []).join(' ')}`.toLowerCase()
      return !query || blob.includes(query)
    }
    let n = notes.filter(matchText)
    let i = ideas.filter(matchText)
    let p = projects.filter(matchText)
    let e = events.filter(matchText)
    if (category) n = n.filter((x) => x.category === category)
    if (status) {
      i = i.filter((x) => x.status === status)
      p = p.filter((x) => x.status === status)
    }
    if (tag) n = n.filter((x) => (x.tags || []).some((t) => t.toLowerCase().includes(tag.toLowerCase())))
    if (projectId) n = n.filter((x) => x.projectId === projectId)
    return [
      ...n.map((x) => ({ kind: 'Note', ...x })),
      ...i.map((x) => ({ kind: 'Idée', ...x })),
      ...p.map((x) => ({ kind: 'Projet', ...x })),
      ...e.map((x) => ({ kind: 'Événement', ...x })),
    ]
  }, [notes, ideas, projects, events, query, category, status, tag, projectId])

  const runExternal = async () => {
    if (!query) return
    setExtBusy(true)
    setExtErr('')
    try {
      const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(q)}&format=json&no_redirect=1&no_html=1`
      const res = await fetch(url)
      if (!res.ok) throw new Error('API indisponible')
      const data = await res.json()
      const items = []
      if (data.AbstractText) {
        items.push({
          title: data.Heading || q,
          snippet: data.AbstractText,
          url: data.AbstractURL,
          source: data.AbstractSource || 'DuckDuckGo',
        })
      }
      for (const t of data.RelatedTopics || []) {
        if (t.Text) {
          items.push({
            title: t.Text.split(' - ')[0],
            snippet: t.Text,
            url: t.FirstURL,
            source: 'DuckDuckGo',
          })
        } else if (t.Topics) {
          for (const sub of t.Topics.slice(0, 3)) {
            items.push({
              title: sub.Text?.split(' - ')[0] || 'Résultat',
              snippet: sub.Text,
              url: sub.FirstURL,
              source: 'DuckDuckGo',
            })
          }
        }
      }
      setExternal(items.slice(0, 12))
      if (!items.length) setExtErr('Aucun résultat externe.')
    } catch (err) {
      setExtErr(
        'Recherche externe bloquée (CORS ou réseau). Essayez depuis un navigateur avec accès réseau, ou reformulez la requête interne.',
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
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sage-400" size={16} />
            <input
              className={inputClass + ' pl-9'}
              placeholder="Rechercher notes, idées, projets…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <button type="button" className={btnPrimary} onClick={runExternal} disabled={extBusy || !query}>
            <ExternalLink size={16} /> {extBusy ? 'Recherche…' : 'Recherche externe'}
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <select className={inputClass + ' !w-auto'} value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">Catégorie</option>
            {NOTE_CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <select className={inputClass + ' !w-auto'} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Statut</option>
            {[...IDEA_STATUSES, ...PROJECT_STATUSES].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <input
            className={inputClass + ' !w-40'}
            placeholder="Étiquette"
            value={tag}
            onChange={(e) => setTag(e.target.value)}
          />
          <select className={inputClass + ' !w-auto'} value={projectId} onChange={(e) => setProjectId(e.target.value)}>
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
                  {item.description || item.content || item.status || ''}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-display text-lg text-sage-900">Ancrage documentaire externe</h2>
        {extErr && <p className="mb-2 text-sm text-warn">{extErr}</p>}
        {external.length === 0 && !extErr && (
          <p className="text-sm text-sage-500">Lancez une recherche externe pour ancrer vos contenus.</p>
        )}
        <ul className="space-y-2">
          {external.map((item, idx) => (
            <li key={idx} className="rounded-xl border border-sage-200 bg-white/70 px-4 py-3">
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
        exportPDF('Export XXDashboard', buildPdfTables({ notes, ideas, projects, events }))
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
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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

function SettingsView({ user, session, users, flash, onUserUpdated }) {
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
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
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
              Saisissez le code à 6 chiffres reçu dans vos notifications.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <input
                className={inputClass + ' !w-40'}
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

      <section className="rounded-2xl border border-sage-200 bg-white/80 p-5">
        <h2 className="flex items-center gap-2 font-display text-lg text-sage-900">
          <Database size={18} /> Diagnostic Firebase / déploiement
        </h2>
        <p className="mt-2 text-sm text-sage-600">
          Mode actuel : <strong>{getBackendMode()}</strong>
          {firebaseConfigured
            ? ' — Auth + Firestore actifs. Connexion, inscription, sessions et jetons de reset sont persistés dans Firebase.'
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
              <li>Firestore Database : créer la base, règles en mode test ou voir README</li>
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
            {getFirebaseStatus().firestoreReady ? 'OK' : 'indisponible'}
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
              exportJSON(kit, 'xxdashboard-deployment-kit.json')
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
          <ul className="mt-3 divide-y divide-sage-100 text-sm">
            {users.map((u) => (
              <li key={u.id} className="flex flex-wrap justify-between gap-2 py-2">
                <span>
                  {u.fullName} · {u.email}
                </span>
                <span className="text-sage-500">{u.role}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-sage-500">
            Rôles RBAC : {Object.values(ROLES).join(' · ')}
          </p>
        </section>
      )}
    </div>
  )
}
