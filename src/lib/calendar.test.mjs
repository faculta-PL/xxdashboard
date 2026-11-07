import {
  monthCells,
  weekDates,
  formatMonthTitle,
  eventsOnDate,
  groupEventsByDate,
  toIsoDate,
  WEEKDAYS_FR,
} from './calendar.js'

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

assert(WEEKDAYS_FR[0] === 'Lun' && WEEKDAYS_FR[6] === 'Dim', 'week starts Monday FR')
assert(formatMonthTitle(2026, 10) === 'novembre 2026', formatMonthTitle(2026, 10))

const nov = monthCells(2026, 10)
assert(nov.length % 7 === 0, 'full weeks')
const firstIn = nov.find((c) => c.inMonth)
assert(firstIn.iso === '2026-11-01', firstIn.iso)
assert(nov.filter((c) => c.inMonth).length === 30, '30 days in nov 2026')

const week = weekDates(new Date(2026, 10, 4))
assert(week[0] === '2026-11-02', week[0])
assert(week[6] === '2026-11-08', week[6])

const events = [
  { id: 'a', date: '2026-11-04', time: '14:00', title: 'Point' },
  { id: 'b', date: '2026-11-04', time: '09:00', title: 'Café' },
  { id: 'c', date: '2026-11-05', time: '10:00', title: 'Revue' },
]
const day = eventsOnDate(events, '2026-11-04')
assert(day.length === 2 && day[0].title === 'Café', 'sorted by time')
const grouped = groupEventsByDate(events)
assert(grouped['2026-11-04'].length === 2, 'group')
assert(toIsoDate('2026-11-04T09:00') === '2026-11-04', 'iso slice')

console.log('calendar tests ok')
