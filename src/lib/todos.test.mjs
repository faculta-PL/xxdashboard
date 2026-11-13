import assert from 'node:assert/strict'
import {
  addDaysIso,
  groupTasks,
  matchesTodoFilter,
  parseQuickAdd,
  subtaskProgress,
  taskBucket,
  todayIso,
} from './todos.js'

const today = '2026-11-13'
const parsed = parseQuickAdd('Appeler Marie !haute #Client demain.', { today })
assert.equal(parsed.title, 'Appeler Marie')
assert.equal(parsed.priority, 'high')
assert.deepEqual(parsed.tags, ['client'])
assert.equal(parsed.dueDate, '2026-11-14')

const en = parseQuickAdd('Buy milk !urgent #home tomorrow', { today })
assert.equal(en.title, 'Buy milk')
assert.equal(en.priority, 'urgent')
assert.equal(en.dueDate, addDaysIso(today, 1))
assert.deepEqual(en.tags, ['home'])

const todayTask = parseQuickAdd("Rapport aujourd'hui !low", { today })
assert.equal(todayTask.dueDate, today)
assert.equal(todayTask.priority, 'low')
assert.equal(todayTask.title, 'Rapport')

assert.equal(taskBucket({ status: 'done', dueDate: today }, today), 'done')
assert.equal(taskBucket({ status: 'todo', dueDate: '' }, today), 'none')
assert.equal(taskBucket({ status: 'todo', dueDate: '2026-11-12' }, today), 'overdue')
assert.equal(taskBucket({ status: 'todo', dueDate: today }, today), 'today')
assert.equal(taskBucket({ status: 'doing', dueDate: '2026-11-20' }, today), 'upcoming')

const user = { id: 'u1' }
assert.equal(matchesTodoFilter({ assigneeId: 'u1', status: 'todo', priority: 'low' }, 'mine', user, today), true)
assert.equal(matchesTodoFilter({ assigneeId: 'u2', ownerId: 'u1', status: 'todo' }, 'mine', user, today), false)
assert.equal(
  matchesTodoFilter({ status: 'todo', priority: 'urgent', dueDate: '2026-11-01' }, 'high', user, today),
  true,
)
assert.equal(matchesTodoFilter({ status: 'done', priority: 'urgent' }, 'high', user, today), false)

assert.equal(subtaskProgress({ status: 'todo', subtasks: [{ done: true }, { done: false }, { done: true }] }), 67)
assert.equal(subtaskProgress({ status: 'done', subtasks: [] }), 100)

const groups = groupTasks(
  [
    { title: 'b', status: 'todo', priority: 'low', dueDate: today },
    { title: 'a', status: 'todo', priority: 'urgent', dueDate: today },
  ],
  today,
)
assert.deepEqual(groups.today.map((t) => t.title), ['a', 'b'])
assert.equal(todayIso(new Date(2026, 10, 13)), '2026-11-13')

console.log('todos ok')
