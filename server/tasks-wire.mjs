/**
 * Build-time wiring for the Tasks module.
 * Idempotent: source that already contains the module is left unchanged.
 * Used so a GitHub tree that has the view but not yet the large App/store
 * files still produces a working Tâches tab.
 */

const STORE_BLOCK = `const TODO_PRIORITIES = new Set(['low', 'medium', 'high', 'urgent'])
const TODO_STATUSES = new Set(['todo', 'doing', 'done'])

function normalizeTodoTags(value) {
  const list = Array.isArray(value) ? value : String(value || '').split(/[\\s,]+/)
  return [...new Set(list.map((tag) => String(tag || '').replace(/^#/, '').trim().toLowerCase()).filter(Boolean))].slice(0, 12)
}

function normalizeTodoSubtasks(value) {
  if (!Array.isArray(value)) return []
  return value
    .map((sub) => ({
      id: String(sub?.id || uid('sub')).slice(0, 48),
      title: String(sub?.title || '').trim().slice(0, 240),
      done: Boolean(sub?.done),
    }))
    .filter((sub) => sub.title)
    .slice(0, 50)
}

export async function saveTodoList(data, user) {
  const name = String(data?.name || '').trim()
  if (!name) throw new Error('Nom de liste requis.')
  if (!memory.xx_todo_lists) memory.xx_todo_lists = {}
  return upsert('xx_todo_lists', {
    ...data,
    name: name.slice(0, 80),
    color: String(data.color || '#3f6b54'),
    archived: Boolean(data.archived),
    visibility: data.visibility || 'Privée',
  }, user)
}

export async function deleteTodoList(id, user) {
  const existing = memory.xx_todo_lists?.[id]
  if (!existing) return
  await destroy('xx_todo_lists', id, user)
  const children = Object.values(memory.xx_todos || {}).filter((task) => task.listId === id)
  for (const task of children) {
    if (!user || canDeleteEntity(user, task)) await removeDoc('xx_todos', task.id)
  }
}

export async function saveTodo(data, user) {
  const title = String(data?.title || '').trim()
  if (!title) throw new Error('Titre requis.')
  if (!memory.xx_todos) memory.xx_todos = {}
  if (!memory.xx_todo_lists) memory.xx_todo_lists = {}
  const existing = data.id ? memory.xx_todos[data.id] : null
  const listId = String(data.listId || existing?.listId || '')
  if (!listId || !memory.xx_todo_lists[listId]) throw new Error('Liste introuvable.')
  const ownerId = existing?.ownerId || user?.id
  const assigneeId = String(data.assigneeId ?? existing?.assigneeId ?? '').trim()
  const prevAssignee = String(existing?.assigneeId || '')
  let shares = Array.isArray(data.shares)
    ? data.shares.map((share) => ({ ...share }))
    : Array.isArray(existing?.shares)
      ? existing.shares.map((share) => ({ ...share }))
      : []
  if (prevAssignee && prevAssignee !== assigneeId) {
    shares = shares.filter((share) => share.userId !== prevAssignee)
  }
  if (assigneeId && assigneeId !== ownerId && !shares.some((share) => share.userId === assigneeId)) {
    const assignee = memory.xx_users?.[assigneeId]
    shares.push({
      userId: assigneeId,
      email: assignee?.email || '',
      permission: 'Édition',
    })
  }
  const status = TODO_STATUSES.has(data.status) ? data.status : existing?.status || 'todo'
  const priority = TODO_PRIORITIES.has(data.priority) ? data.priority : existing?.priority || 'medium'
  const dueRaw = data.dueDate !== undefined ? data.dueDate : existing?.dueDate
  const dueDate = toIsoDate(dueRaw || '')
  let completedAt = null
  if (status === 'done') {
    completedAt = existing?.status === 'done' && existing.completedAt ? existing.completedAt : new Date().toISOString()
  }
  return upsert('xx_todos', {
    id: data.id,
    title: title.slice(0, 200),
    description: String(data.description ?? existing?.description ?? '').slice(0, 8000),
    listId,
    priority,
    status,
    dueDate,
    tags: normalizeTodoTags(data.tags !== undefined ? data.tags : existing?.tags),
    subtasks: normalizeTodoSubtasks(data.subtasks !== undefined ? data.subtasks : existing?.subtasks),
    assigneeId,
    completedAt,
    visibility: 'Privée',
    shares,
  }, user)
}

export async function deleteTodo(id, user) {
  await destroy('xx_todos', id, user)
}

`

function mustReplace(code, from, to, label) {
  if (!code.includes(from)) throw new Error(`tasks-wire: missing anchor ${label}`)
  return code.replace(from, to)
}

export function wireApp(code) {
  if (code.includes("from './views/Todos'")) return code
  let next = mustReplace(
    code,
    "import DashboardView from './components/DashboardView'\n",
    "import DashboardView from './components/DashboardView'\nimport TodosView from './views/Todos'\n",
    'app import',
  )
  next = mustReplace(
    next,
    '  deleteEvent,\n  appendIdeaHistory,\n',
    '  deleteEvent,\n  saveTodoList,\n  deleteTodoList,\n  saveTodo,\n  deleteTodo,\n  appendIdeaHistory,\n',
    'app store import',
  )
  next = mustReplace(
    next,
    '  const fileCtx = useMemo(',
    `  const todoLists = useMemo(
    () =>
      db && user
        ? Object.values(db.xx_todo_lists || {})
            .filter((list) => canReadEntity(user, list))
            .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'fr'))
        : [],
    [db, user],
  )
  const todos = useMemo(
    () =>
      db && user
        ? Object.values(db.xx_todos || {}).filter((task) => canReadEntity(user, task))
        : [],
    [db, user],
  )
  const fileCtx = useMemo(`,
    'app memos',
  )
  next = mustReplace(
    next,
    '              users={users}\n              storedPrefs={dashboardPrefs}',
    '              users={users}\n              todos={todos}\n              storedPrefs={dashboardPrefs}',
    'app dashboard prop',
  )
  next = mustReplace(
    next,
    `          {view === 'calendar' && (
            <CalendarView user={user} events={events} users={users} flash={flash} />
          )}
`,
    `          {view === 'calendar' && (
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
`,
    'app view',
  )
  return next
}

export function wireStore(code) {
  if (code.includes('export async function saveTodoList')) return code
  let next = mustReplace(
    code,
    "import { sha256, randomToken, randomCode6, uid } from './crypto'\n",
    "import { sha256, randomToken, randomCode6, uid } from './crypto'\nimport { toIsoDate } from './calendar'\n",
    'store import',
  )
  next = mustReplace(
    next,
    "  'xx_events',\n  'xx_notifications',",
    "  'xx_events',\n  'xx_todo_lists',\n  'xx_todos',\n  'xx_notifications',",
    'store collections',
  )
  next = mustReplace(
    next,
    "    'xx_events',\n    'xx_groups',",
    "    'xx_events',\n    'xx_todo_lists',\n    'xx_todos',\n    'xx_groups',",
    'store remap',
  )
  next = mustReplace(
    next,
    "export async function deleteEvent(id, user) {\n  await destroy('xx_events', id, user)\n  await removeLinksFor('event', id)\n}\n\n",
    "export async function deleteEvent(id, user) {\n  await destroy('xx_events', id, user)\n  await removeLinksFor('event', id)\n}\n\n" + STORE_BLOCK,
    'store functions',
  )
  return next
}

const FR_TODOS = `todos: {
      lists: 'Listes',
      newList: 'Nouvelle liste',
      listName: 'Nom de la liste',
      rename: 'Renommer',
      archive: 'Archiver',
      unarchive: 'Désarchiver',
      deleteList: 'Supprimer la liste',
      deleteListBody: 'La liste « {name} » et ses tâches seront supprimées.',
      deleteTask: 'Supprimer la tâche',
      deleteTaskBody: 'Supprimer « {name} » ?',
      color: 'Couleur',
      showArchived: 'Afficher les archivées',
      hideArchived: 'Masquer les archivées',
      allLists: 'Toutes les listes',
      quickAdd: 'Ajout rapide',
      quickPlaceholder: 'Appeler Marie !haute #client demain',
      quickHint: 'Astuce : !haute !urgente, #étiquette, demain.',
      search: 'Rechercher une tâche',
      filters: 'Filtres',
      filterAll: 'Tout',
      filterMine: 'Mes tâches',
      filterToday: "Aujourd'hui",
      filterOverdue: 'En retard',
      filterHigh: 'Priorité haute',
      groupToday: "Aujourd'hui",
      groupUpcoming: 'À venir',
      groupOverdue: 'En retard',
      groupNoDate: 'Sans date',
      groupDone: 'Terminées',
      empty: 'Aucune tâche dans cette vue.',
      emptyHint: 'Ajoutez-en une avec le champ rapide, ou changez de filtre.',
      priority: 'Priorité',
      priorityLow: 'Faible',
      priorityMedium: 'Moyenne',
      priorityHigh: 'Haute',
      priorityUrgent: 'Urgente',
      statusTodo: 'À faire',
      statusDoing: 'En cours',
      statusDone: 'Terminée',
      due: 'Échéance',
      tags: 'Étiquettes',
      tagsHint: 'Séparées par des espaces',
      assignee: 'Assignée à',
      unassigned: 'Non assignée',
      subtasks: 'Sous-tâches',
      addSubtask: 'Ajouter',
      subtaskPlaceholder: 'Nouvelle sous-tâche',
      subtaskCount: '{done}/{total}',
      description: 'Description',
      titleField: 'Titre',
      saved: 'Tâche enregistrée.',
      completed: 'Tâche terminée.',
      undo: 'Annuler',
      restored: 'Tâche rouverte.',
      listCreated: 'Liste créée.',
      listRenamed: 'Liste renommée.',
      listArchived: 'Liste archivée.',
      listUnarchived: 'Liste réactivée.',
      listDeleted: 'Liste supprimée.',
      taskDeleted: 'Tâche supprimée.',
      needTitle: 'Indiquez un titre.',
      needListName: 'Indiquez un nom de liste.',
      defaultList: 'Personnel',
      progress: 'Avancement',
      noDate: 'Sans date',
      sharedList: 'Liste partagée',
      archivedBadge: 'Archivée',
      markDone: 'Marquer terminée',
      markOpen: 'Rouvrir',
      editTask: 'Détail de la tâche',
      newTask: 'Nouvelle tâche',
      add: 'Ajouter',
      createFirst: 'Créez une liste pour commencer.',
      saveFailed: 'Enregistrement impossible.',
      readerBlocked: 'Le rôle Lecteur ne peut pas créer de tâche.',
    },
    `

const EN_TODOS = `todos: {
      lists: 'Lists',
      newList: 'New list',
      listName: 'List name',
      rename: 'Rename',
      archive: 'Archive',
      unarchive: 'Unarchive',
      deleteList: 'Delete list',
      deleteListBody: 'The list “{name}” and its tasks will be deleted.',
      deleteTask: 'Delete task',
      deleteTaskBody: 'Delete “{name}”?',
      color: 'Colour',
      showArchived: 'Show archived',
      hideArchived: 'Hide archived',
      allLists: 'All lists',
      quickAdd: 'Quick add',
      quickPlaceholder: 'Call Marie !high #client tomorrow',
      quickHint: 'Tip: !high !urgent, #tag, tomorrow.',
      search: 'Search tasks',
      filters: 'Filters',
      filterAll: 'All',
      filterMine: 'My tasks',
      filterToday: 'Today',
      filterOverdue: 'Overdue',
      filterHigh: 'High priority',
      groupToday: 'Today',
      groupUpcoming: 'Upcoming',
      groupOverdue: 'Overdue',
      groupNoDate: 'No date',
      groupDone: 'Done',
      empty: 'No tasks in this view.',
      emptyHint: 'Add one with the quick field, or change the filter.',
      priority: 'Priority',
      priorityLow: 'Low',
      priorityMedium: 'Medium',
      priorityHigh: 'High',
      priorityUrgent: 'Urgent',
      statusTodo: 'To do',
      statusDoing: 'In progress',
      statusDone: 'Done',
      due: 'Due date',
      tags: 'Tags',
      tagsHint: 'Separated by spaces',
      assignee: 'Assignee',
      unassigned: 'Unassigned',
      subtasks: 'Subtasks',
      addSubtask: 'Add',
      subtaskPlaceholder: 'New subtask',
      subtaskCount: '{done}/{total}',
      description: 'Description',
      titleField: 'Title',
      saved: 'Task saved.',
      completed: 'Task completed.',
      undo: 'Undo',
      restored: 'Task reopened.',
      listCreated: 'List created.',
      listRenamed: 'List renamed.',
      listArchived: 'List archived.',
      listUnarchived: 'List restored.',
      listDeleted: 'List deleted.',
      taskDeleted: 'Task deleted.',
      needTitle: 'Enter a title.',
      needListName: 'Enter a list name.',
      defaultList: 'Personal',
      progress: 'Progress',
      noDate: 'No date',
      sharedList: 'Shared list',
      archivedBadge: 'Archived',
      markDone: 'Mark done',
      markOpen: 'Reopen',
      editTask: 'Task detail',
      newTask: 'New task',
      add: 'Add',
      createFirst: 'Create a list to get started.',
      saveFailed: 'Could not save.',
      readerBlocked: 'The Reader role cannot create tasks.',
    },
    `

export function wireI18n(code) {
  if (code.includes("wTodayTasks:")) return code
  let next = mustReplace(code, "calendar: 'Calendrier',\n", "calendar: 'Calendrier',\n      todos: 'Tâches',\n", 'i18n nav fr')
  next = mustReplace(next, "calendar: 'Calendar',\n", "calendar: 'Calendar',\n      todos: 'Tasks',\n", 'i18n nav en')
  next = mustReplace(next, "wTasks: 'Kanban à faire',\n", "wTasks: 'Kanban à faire',\n      wTodayTasks: 'Tâches du jour',\n", 'i18n dash fr')
  next = mustReplace(next, "wTasks: 'Kanban to do',\n", "wTasks: 'Kanban to do',\n      wTodayTasks: 'Today’s tasks',\n", 'i18n dash en')
  next = mustReplace(next, "shortcutIdea: 'Idée',\n", "shortcutIdea: 'Idée',\n      shortcutTask: 'Tâche',\n", 'i18n shortcut fr')
  next = mustReplace(next, "shortcutIdea: 'Idea',\n", "shortcutIdea: 'Idea',\n      shortcutTask: 'Task',\n", 'i18n shortcut en')
  next = mustReplace(next, "noIdea: 'Aucune idée ouverte.',\n", "noIdea: 'Aucune idée ouverte.',\n      noTodayTask: 'Rien n’est dû aujourd’hui.',\n", 'i18n empty fr')
  next = mustReplace(next, "noIdea: 'No open ideas.',\n", "noIdea: 'No open ideas.',\n      noTodayTask: 'Nothing is due today.',\n", 'i18n empty en')
  next = mustReplace(
    next,
    "calendar: 'Les rendez-vous sur leur jour.',\n",
    "calendar: 'Les rendez-vous sur leur jour.',\n      todos: 'Listes, priorités et échéances.',\n",
    'i18n chrome fr',
  )
  next = mustReplace(
    next,
    "calendar: 'Appointments on their day.',\n",
    "calendar: 'Appointments on their day.',\n      todos: 'Lists, priorities and due dates.',\n",
    'i18n chrome en',
  )
  next = mustReplace(
    next,
    "    chrome: {\n      dashboard: 'Ce que vous pouvez déjà lire, en un coup d’œil.',\n",
    '    ' + FR_TODOS + "chrome: {\n      dashboard: 'Ce que vous pouvez déjà lire, en un coup d’œil.',\n",
    'i18n todos fr',
  )
  next = mustReplace(
    next,
    "    chrome: {\n      dashboard: 'What you can already read, at a glance.',\n",
    '    ' + EN_TODOS + "chrome: {\n      dashboard: 'What you can already read, at a glance.',\n",
    'i18n todos en',
  )
  return next
}

const TODAY_WIDGET = `    todayTasks: (
      <WidgetCard
        id="todayTasks"
        title={t('dash.wTodayTasks')}
        delay={100}
        onHide={() => hide('todayTasks')}
        onUp={() => move('todayTasks', -1)}
        onDown={() => move('todayTasks', 1)}
        action={
          <button type="button" className={btnGhost + ' !min-h-9 !py-1 text-xs'} onClick={() => onQuick('todos')}>
            {t('common.view')}
          </button>
        }
      >
        {todayTasks.length === 0 ? (
          <p className="text-sm text-sage-500">{t('dash.noTodayTask')}</p>
        ) : (
          <ul className="space-y-2">
            {todayTasks.map((task) => (
              <li key={task.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="min-w-0 truncate font-medium text-sage-900">{task.title}</span>
                <span className="shrink-0 text-xs font-semibold text-sage-600">{t(priorityLabelKey(task.priority))}</span>
              </li>
            ))}
          </ul>
        )}
      </WidgetCard>
    ),
    tasks: (`

export function wireDashboard(code) {
  if (code.includes("id=\"todayTasks\"") || code.includes("id='todayTasks'")) return code
  let next = mustReplace(code, '  CalendarDays,\n', '  CalendarDays,\n  ListTodo,\n', 'dash icon')
  next = mustReplace(
    next,
    "import { isDateOverdue, isOpenRisk } from '../lib/rbac'\n",
    "import { isDateOverdue, isOpenRisk } from '../lib/rbac'\nimport { priorityLabelKey, todayIso } from '../lib/todos'\n",
    'dash import',
  )
  next = mustReplace(next, "  'shortcuts',\n  'projects',\n", "  'shortcuts',\n  'todayTasks',\n  'projects',\n", 'dash order')
  next = mustReplace(
    next,
    "  shortcuts: 'dash.wShortcuts',\n",
    "  shortcuts: 'dash.wShortcuts',\n  todayTasks: 'dash.wTodayTasks',\n",
    'dash keys',
  )
  next = mustReplace(next, '  users = [],\n  storedPrefs,', '  users = [],\n  todos = [],\n  storedPrefs,', 'dash prop')
  next = mustReplace(
    next,
    '  const recentChat = useMemo(() => [...chatMessages].slice(-4).reverse(), [chatMessages])\n',
    `  const recentChat = useMemo(() => [...chatMessages].slice(-4).reverse(), [chatMessages])
  const todayTasks = useMemo(() => {
    const today = todayIso()
    return todos
      .filter((task) => task.status !== 'done' && task.dueDate === today)
      .slice(0, 6)
  }, [todos])
`,
    'dash memo',
  )
  next = mustReplace(
    next,
    "['ideas', t('dash.shortcutIdea'), Lightbulb],\n",
    "['ideas', t('dash.shortcutIdea'), Lightbulb],\n            ['todos', t('dash.shortcutTask'), ListTodo],\n",
    'dash shortcut',
  )
  next = mustReplace(next, '    tasks: (', TODAY_WIDGET, 'dash widget')
  return next
}

function fileKind(id) {
  const path = String(id || '').replace(/\\/g, '/')
  if (path.endsWith('/src/App.jsx')) return 'app'
  if (path.endsWith('/src/lib/store.js')) return 'store'
  if (path.endsWith('/src/lib/i18nCore.js')) return 'i18n'
  if (path.endsWith('/src/components/DashboardView.jsx')) return 'dash'
  return ''
}

export function tasksWirePlugin() {
  return {
    name: 'nazix-tasks-wire',
    enforce: 'pre',
    transform(code, id) {
      const kind = fileKind(id)
      if (!kind) return null
      if (kind === 'app') return { code: wireApp(code), map: null }
      if (kind === 'store') return { code: wireStore(code), map: null }
      if (kind === 'i18n') return { code: wireI18n(code), map: null }
      if (kind === 'dash') return { code: wireDashboard(code), map: null }
      return null
    },
  }
}
