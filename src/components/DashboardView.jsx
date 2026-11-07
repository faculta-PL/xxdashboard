import { useEffect, useMemo, useState } from 'react'
import {
  Plus,
  Eye,
  EyeOff,
  ChevronUp,
  ChevronDown,
  StickyNote,
  FolderKanban,
  Lightbulb,
  CalendarDays,
  ShieldAlert,
  Wallet,
  Upload,
  RotateCcw,
  Mic,
} from 'lucide-react'
import { useI18n } from '../i18n'
import { isDateOverdue, isOpenRisk } from '../lib/rbac'
import { getBackendMode, saveDashboardPrefs } from '../lib/store'
import {
  EmptyState,
  MemberAvatar,
  PriorityBadge,
  ProgressBar,
  StatusBadge,
  VisibilityBadge,
  btnGhost,
  btnPrimary,
  clipText,
  formatMoney,
} from './ui'

export const DEFAULT_WIDGET_ORDER = [
  'shortcuts',
  'projects',
  'tasks',
  'events',
  'notes',
  'files',
  'budget',
  'risks',
  'chat',
]

const WIDGET_LABELS = {
  shortcuts: 'Raccourcis',
  projects: 'Projets récents',
  tasks: 'Tâches / idées à faire',
  events: 'Événements à venir',
  notes: 'Notes récentes',
  files: 'Fichiers récents',
  budget: 'Reste budgétaire',
  risks: 'Risques élevés',
  chat: 'Chat récent',
}

const IDEA_DONE = new Set(['Abandonnée'])

function prefsKey(userId) {
  return `nazix_dashboard_prefs_${userId}`
}

function readLocalPrefs(userId) {
  try {
    const raw = JSON.parse(localStorage.getItem(prefsKey(userId)) || 'null')
    if (!raw || typeof raw !== 'object') return null
    return raw
  } catch {
    return null
  }
}

function writeLocalPrefs(userId, prefs) {
  try {
    localStorage.setItem(prefsKey(userId), JSON.stringify(prefs))
  } catch {
    /* ignore */
  }
}

function normalizePrefs(raw) {
  const hidden = Array.isArray(raw?.hidden) ? raw.hidden.filter((id) => WIDGET_LABELS[id]) : []
  const seen = new Set()
  const order = []
  for (const id of [...(Array.isArray(raw?.order) ? raw.order : []), ...DEFAULT_WIDGET_ORDER]) {
    if (WIDGET_LABELS[id] && !seen.has(id)) {
      seen.add(id)
      order.push(id)
    }
  }
  return {
    hidden,
    order,
    favoriteProjectId: raw?.favoriteProjectId || '',
  }
}

function WidgetCard({ title, delay, onHide, onUp, onDown, children, action }) {
  return (
    <section
      className="rounded-2xl border border-sage-200 bg-white/70 p-5 animate-fade-up"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="min-w-0 flex-1 font-display text-lg text-sage-900">{title}</h2>
        {action}
        <div className="flex items-center gap-1">
          <button type="button" className={iconBtn} onClick={onUp} aria-label={`Monter ${title}`} title="Monter">
            <ChevronUp size={16} />
          </button>
          <button type="button" className={iconBtn} onClick={onDown} aria-label={`Descendre ${title}`} title="Descendre">
            <ChevronDown size={16} />
          </button>
          <button type="button" className={iconBtn} onClick={onHide} aria-label={`Masquer ${title}`} title="Masquer">
            <EyeOff size={16} />
          </button>
        </div>
      </div>
      {children}
    </section>
  )
}

const iconBtn =
  'inline-flex min-h-9 min-w-9 items-center justify-center rounded-lg text-sage-600 hover:bg-sage-100'

export default function DashboardView({
  user,
  notes = [],
  ideas = [],
  projects = [],
  files = [],
  events = [],
  budgets = [],
  budgetLines = [],
  risks = [],
  riskActions = [],
  chatMessages = [],
  groups = [],
  users = [],
  storedPrefs,
  onQuick,
  onImport,
  onDictate,
}) {
  const { t } = useI18n()
  const [prefs, setPrefs] = useState(() =>
    normalizePrefs(storedPrefs || (user ? readLocalPrefs(user.id) : null)),
  )

  useEffect(() => {
    setPrefs(normalizePrefs(storedPrefs || (user ? readLocalPrefs(user.id) : null)))
  }, [storedPrefs, user])

  const persist = async (next) => {
    const normalized = normalizePrefs(next)
    setPrefs(normalized)
    if (user) writeLocalPrefs(user.id, normalized)
    try {
      if (user) await saveDashboardPrefs(user, normalized)
    } catch (err) {
      console.warn('dashboard prefs:', err.message)
    }
  }

  const move = (id, dir) => {
    const order = [...prefs.order]
    const i = order.indexOf(id)
    const j = i + dir
    if (i < 0 || j < 0 || j >= order.length) return
    ;[order[i], order[j]] = [order[j], order[i]]
    persist({ ...prefs, order })
  }

  const hide = (id) => persist({ ...prefs, hidden: [...new Set([...prefs.hidden, id])] })
  const show = (id) => persist({ ...prefs, hidden: prefs.hidden.filter((x) => x !== id) })
  const restore = () => persist({ hidden: [], order: DEFAULT_WIDGET_ORDER, favoriteProjectId: '' })

  const nameOf = (id) => users.find((u) => u.id === id)?.fullName || '—'
  const groupName = (id) => groups.find((g) => g.id === id)?.name || 'Groupe'

  const recentProjects = useMemo(() => {
    const list = [...projects].sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))
    const fav = prefs.favoriteProjectId ? list.find((p) => p.id === prefs.favoriteProjectId) : null
    const rest = list.filter((p) => p.id !== fav?.id)
    return fav ? [fav, ...rest] : rest
  }, [projects, prefs.favoriteProjectId])

  const todoIdeas = useMemo(
    () =>
      [...ideas]
        .filter((i) => !IDEA_DONE.has(i.status))
        .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))
        .slice(0, 6),
    [ideas],
  )

  const upcoming = useMemo(
    () =>
      events
        .filter((e) => e.date && new Date(`${e.date}T${e.time || '00:00'}`) >= new Date(Date.now() - 86400000))
        .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))
        .slice(0, 5),
    [events],
  )

  const recentNotes = useMemo(
    () => [...notes].sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0)).slice(0, 5),
    [notes],
  )
  const recentFiles = useMemo(
    () =>
      [...files]
        .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0))
        .slice(0, 5),
    [files],
  )

  const budgetRows = useMemo(
    () =>
      budgets.slice(0, 4).map((b) => {
        const paid = budgetLines
          .filter((l) => l.budgetId === b.id && l.kind === 'actual' && l.status === 'paid')
          .reduce((s, l) => s + Number(l.amount || 0), 0)
        const planned = Number(b.plannedTotal || 0)
        return {
          id: b.id,
          name: b.name,
          currency: b.currency,
          remaining: planned - paid,
          pct: planned > 0 ? Math.round((paid / planned) * 100) : 0,
        }
      }),
    [budgets, budgetLines],
  )

  const highRisks = useMemo(
    () => risks.filter((r) => isOpenRisk(r) && r.priority === 'élevée').slice(0, 5),
    [risks],
  )
  const overdueActions = useMemo(
    () =>
      riskActions
        .filter((a) => a.status !== 'terminée' && isDateOverdue(a.dueDate))
        .slice(0, 5),
    [riskActions],
  )

  const recentChat = useMemo(() => [...chatMessages].slice(-4).reverse(), [chatMessages])

  const hidden = prefs.hidden
  const visible = prefs.order.filter((id) => !hidden.includes(id))
  const localMode = getBackendMode() === 'local'

  const widgets = {
    shortcuts: (
      <WidgetCard
        id="shortcuts"
        title="Créer"
        delay={40}
        onHide={() => hide('shortcuts')}
        onUp={() => move('shortcuts', -1)}
        onDown={() => move('shortcuts', 1)}
      >
        <div className="flex flex-wrap gap-2">
          {[
            ['notes', 'Note', StickyNote],
            ['projects', 'Projet', FolderKanban],
            ['ideas', 'Idée', Lightbulb],
            ['calendar', 'Événement', CalendarDays],
            ['risks', 'Risque', ShieldAlert],
            ['budget', 'Dépense', Wallet],
          ].map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              onClick={() => onQuick(id)}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-sage-100 px-3 py-2 text-sm font-semibold text-sage-900 hover:bg-sage-200"
            >
              <Icon size={16} /> {label}
            </button>
          ))}
          <button
            type="button"
            onClick={onImport}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-sage-100 px-3 py-2 text-sm font-semibold text-sage-900 hover:bg-sage-200"
          >
            <Upload size={16} /> {t('common.import')}
          </button>
          {onDictate && (
            <button
              type="button"
              onClick={onDictate}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-sage-100 px-3 py-2 text-sm font-semibold text-sage-900 hover:bg-sage-200"
            >
              <Mic size={16} /> {t('dash.dictate')}
            </button>
          )}
        </div>
      </WidgetCard>
    ),
    projects: (
      <WidgetCard
        id="projects"
        title="Projets récents"
        delay={80}
        onHide={() => hide('projects')}
        onUp={() => move('projects', -1)}
        onDown={() => move('projects', 1)}
        action={
          <button type="button" className={btnGhost + ' !min-h-9 !py-1 text-xs'} onClick={() => onQuick('projects')}>
            Voir
          </button>
        }
      >
        {projects.length > 0 && (
          <label className="mb-3 block text-xs text-sage-600">
            Projet favori
            <select
              className="mt-1 w-full rounded-lg border border-sage-300 bg-white px-2 py-1.5 text-sm text-sage-900"
              value={prefs.favoriteProjectId}
              onChange={(e) => persist({ ...prefs, favoriteProjectId: e.target.value })}
            >
              <option value="">Aucun</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </label>
        )}
        {recentProjects.length === 0 ? (
          <p className="text-sm text-sage-500">Pas encore de projet visible de votre côté.</p>
        ) : (
          <ul className="space-y-3">
            {recentProjects.slice(0, 5).map((p) => (
              <li key={p.id}>
                <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                  <span className="min-w-0 truncate font-medium text-sage-900">
                    {p.title}
                    {p.id === prefs.favoriteProjectId ? ' · favori' : ''}
                  </span>
                  <span className="flex shrink-0 items-center gap-1">
                    <VisibilityBadge value={p.visibility || 'Partagée'} />
                    <StatusBadge value={p.status} />
                  </span>
                </div>
                <ProgressBar value={p.progress || 0} />
              </li>
            ))}
          </ul>
        )}
      </WidgetCard>
    ),
    tasks: (
      <WidgetCard
        id="tasks"
        title="Kanban à faire"
        delay={120}
        onHide={() => hide('tasks')}
        onUp={() => move('tasks', -1)}
        onDown={() => move('tasks', 1)}
        action={
          <button type="button" className={btnGhost + ' !min-h-9 !py-1 text-xs'} onClick={() => onQuick('ideas')}>
            Kanban
          </button>
        }
      >
        {todoIdeas.length === 0 ? (
          <p className="text-sm text-sage-500">Aucune idée ouverte.</p>
        ) : (
          <ul className="space-y-2">
            {todoIdeas.map((idea) => (
              <li key={idea.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="min-w-0 truncate font-medium text-sage-900">{idea.title}</span>
                <StatusBadge value={idea.status} />
              </li>
            ))}
          </ul>
        )}
      </WidgetCard>
    ),
    events: (
      <WidgetCard
        id="events"
        title="Événements à venir"
        delay={160}
        onHide={() => hide('events')}
        onUp={() => move('events', -1)}
        onDown={() => move('events', 1)}
        action={
          <button type="button" className={btnGhost + ' !min-h-9 !py-1 text-xs'} onClick={() => onQuick('calendar')}>
            Voir
          </button>
        }
      >
        {upcoming.length === 0 ? (
          <p className="text-sm text-sage-500">Aucun événement planifié.</p>
        ) : (
          <ul className="space-y-3">
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
      </WidgetCard>
    ),
    notes: (
      <WidgetCard
        id="notes"
        title="Notes récentes"
        delay={200}
        onHide={() => hide('notes')}
        onUp={() => move('notes', -1)}
        onDown={() => move('notes', 1)}
        action={
          <button type="button" className={btnGhost + ' !min-h-9 !py-1 text-xs'} onClick={() => onQuick('notes')}>
            Voir
          </button>
        }
      >
        {recentNotes.length === 0 ? (
          <p className="text-sm text-sage-500">Pas encore de note de votre côté.</p>
        ) : (
          <ul className="space-y-2">
            {recentNotes.map((n) => (
              <li key={n.id} className="text-sm">
                <p className="flex items-center gap-1.5 truncate font-medium text-sage-900">
                  <span className="min-w-0 truncate">{n.title || 'Sans titre'}</span>
                  <VisibilityBadge value={n.visibility || 'Privée'} />
                </p>
                <p className="text-xs text-sage-500">{clipText(n.body || n.content || '', 90)}</p>
              </li>
            ))}
          </ul>
        )}
      </WidgetCard>
    ),
    files: (
      <WidgetCard
        id="files"
        title="Fichiers récents"
        delay={240}
        onHide={() => hide('files')}
        onUp={() => move('files', -1)}
        onDown={() => move('files', 1)}
        action={
          <button type="button" className={btnGhost + ' !min-h-9 !py-1 text-xs'} onClick={() => onQuick('files')}>
            Voir
          </button>
        }
      >
        {recentFiles.length === 0 ? (
          <p className="text-sm text-sage-500">Pas encore de fichier visible.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {recentFiles.map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate font-medium text-sage-900">{f.name}</span>
                <span className="flex shrink-0 items-center gap-1">
                  <VisibilityBadge value={f.visibility} />
                  <StatusBadge value={(f.ext || '').toUpperCase() || 'FICHIER'} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </WidgetCard>
    ),
    budget: (
      <WidgetCard
        id="budget"
        title="Reste budgétaire"
        delay={280}
        onHide={() => hide('budget')}
        onUp={() => move('budget', -1)}
        onDown={() => move('budget', 1)}
        action={
          <button type="button" className={btnGhost + ' !min-h-9 !py-1 text-xs'} onClick={() => onQuick('budget')}>
            Voir
          </button>
        }
      >
        {budgetRows.length === 0 ? (
          <p className="text-sm text-sage-500">Aucun budget lisible.</p>
        ) : (
          <ul className="space-y-3">
            {budgetRows.map((b) => (
              <li key={b.id}>
                <p className="text-sm font-medium text-sage-900">{b.name}</p>
                <p className="font-display text-xl text-sage-900">{formatMoney(b.remaining, b.currency)}</p>
                <ProgressBar value={b.pct} label="Consommé (payé)" />
              </li>
            ))}
          </ul>
        )}
      </WidgetCard>
    ),
    risks: (
      <WidgetCard
        id="risks"
        title="Risques élevés et actions en retard"
        delay={320}
        onHide={() => hide('risks')}
        onUp={() => move('risks', -1)}
        onDown={() => move('risks', 1)}
        action={
          <button type="button" className={btnGhost + ' !min-h-9 !py-1 text-xs'} onClick={() => onQuick('risks')}>
            Voir
          </button>
        }
      >
        {highRisks.length === 0 && overdueActions.length === 0 ? (
          <p className="text-sm text-sage-500">Aucun risque élevé ni action en retard.</p>
        ) : (
          <div className="space-y-3">
            {highRisks.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="min-w-0 truncate font-medium text-sage-900">{r.title}</span>
                <PriorityBadge value={r.priority} />
              </div>
            ))}
            {overdueActions.map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="min-w-0 truncate text-sage-800">{a.title}</span>
                <span className="shrink-0 text-xs font-semibold text-danger">{a.dueDate}</span>
              </div>
            ))}
          </div>
        )}
      </WidgetCard>
    ),
    chat: (
      <WidgetCard
        id="chat"
        title="Chat récent"
        delay={360}
        onHide={() => hide('chat')}
        onUp={() => move('chat', -1)}
        onDown={() => move('chat', 1)}
        action={
          <button type="button" className={btnGhost + ' !min-h-9 !py-1 text-xs'} onClick={() => onQuick('chat')}>
            Ouvrir
          </button>
        }
      >
        {recentChat.length === 0 ? (
          <p className="text-sm text-sage-500">Aucun message récent.</p>
        ) : (
          <ul className="space-y-3">
            {recentChat.map((m) => (
              <li key={m.id} className="flex gap-2 text-sm">
                <MemberAvatar name={m.authorName || nameOf(m.authorId)} size={28} />
                <div className="min-w-0">
                  <p className="text-xs text-sage-500">
                    {m.authorName || nameOf(m.authorId)} · {groupName(m.groupId)}
                  </p>
                  <p className="text-sage-800">{clipText(m.body, 100)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </WidgetCard>
    ),
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-sage-200 bg-gradient-to-br from-sage-700 to-sage-900 p-5 text-sage-50 animate-fade-up md:p-8">
        <p className="font-display text-3xl md:text-4xl">Vue d’ensemble</p>
        <p className="mt-2 max-w-2xl text-sage-200">
          Widgets alimentés uniquement par des données lisibles ({localMode ? 'mode local' : 'Firebase'}). Masquez,
          réordonnez, ou restaurez la disposition.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onQuick('notes')}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-cream-green px-3 py-2 text-sm font-semibold text-sage-900 hover:bg-white"
          >
            <Plus size={16} /> Nouvelle note
          </button>
          <button type="button" className={btnGhost + ' !border-sage-500 !bg-sage-800 !text-sage-50'} onClick={restore}>
            <RotateCcw size={16} /> Disposition par défaut
          </button>
        </div>
      </section>

      {visible.length === 0 && (
        <EmptyState
          title="Tous les widgets sont masqués"
          hint="Restaurez la disposition ou réaffichez un bloc ci-dessous."
          action={
            <button type="button" className={`${btnPrimary} mt-4`} onClick={restore}>
              Restaurer
            </button>
          }
        />
      )}

      <div className="grid gap-4 lg:grid-cols-2">{visible.map((id) => <div key={id}>{widgets[id]}</div>)}</div>

      {hidden.length > 0 && (
        <section className="rounded-2xl border border-dashed border-sage-300 bg-white/40 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-sage-500">Widgets masqués</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {hidden.map((id) => (
              <button
                key={id}
                type="button"
                className={btnGhost + ' !min-h-9 !py-1 text-xs'}
                onClick={() => show(id)}
                aria-label={`Afficher ${WIDGET_LABELS[id]}`}
              >
                <Eye size={14} /> {WIDGET_LABELS[id]}
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
