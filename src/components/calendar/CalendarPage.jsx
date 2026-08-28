import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, Sparkles, Users } from 'lucide-react'
import { peopleService } from '../../services/peopleService'

const monthFormatter = new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' })
const timeFormatter = new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit' })
const dayFormatter = new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric' })
const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function buildMonthDays(month) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1)
  const start = new Date(first)
  start.setDate(first.getDate() - ((first.getDay() + 6) % 7))
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start)
    date.setDate(start.getDate() + index)
    return date
  })
}

export function CalendarPage() {
  const today = useMemo(() => new Date(), [])
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1))
  const [selectedDate, setSelectedDate] = useState(today)
  const [events, setEvents] = useState([])
  const [status, setStatus] = useState('loading')

  useEffect(() => {
    let active = true
    peopleService.listCalendarEvents()
      .then((items) => { if (active) { setEvents(items); setStatus('ready') } })
      .catch(() => { if (active) setStatus('error') })
    return () => { active = false }
  }, [])

  const days = useMemo(() => buildMonthDays(month), [month])
  const eventsByDay = useMemo(() => events.reduce((result, event) => {
    const key = dateKey(new Date(event.startAt))
    result[key] = [...(result[key] || []), event]
    return result
  }, {}), [events])
  const selectedEvents = eventsByDay[dateKey(selectedDate)] || []

  function changeMonth(offset) {
    const next = new Date(month.getFullYear(), month.getMonth() + offset, 1)
    setMonth(next)
    setSelectedDate(next)
  }

  function goToday() {
    setMonth(new Date(today.getFullYear(), today.getMonth(), 1))
    setSelectedDate(today)
  }

  return (
    <section className="featurePage card calendarPage">
      <header className="calendarHeader">
        <div className="featureHero"><span className="featureIcon"><CalendarDays size={24} /></span><small>Schedule</small><h1>Calendar</h1><p>Your time, conversations and priorities in one focused view.</p></div>
        <div className="calendarSignal"><Sparkles size={15} /><span><b>Olivia calendar</b>Schedule intelligence active</span></div>
      </header>
      <div className="calendarWorkspace">
        <div className="calendarMain">
          <div className="calendarToolbar"><div><h2>{monthFormatter.format(month)}</h2><span>{events.length} connected {events.length === 1 ? 'event' : 'events'}</span></div><nav aria-label="Calendar navigation"><button type="button" onClick={goToday}>Today</button><button type="button" aria-label="Previous month" onClick={() => changeMonth(-1)}><ChevronLeft size={17} /></button><button type="button" aria-label="Next month" onClick={() => changeMonth(1)}><ChevronRight size={17} /></button></nav></div>
          <div className="calendarWeekdays">{weekdays.map((day) => <span key={day}>{day}</span>)}</div>
          <div className="calendarGrid" role="grid" aria-label={monthFormatter.format(month)}>{days.map((date) => {
            const key = dateKey(date)
            const dayEvents = eventsByDay[key] || []
            const isToday = key === dateKey(today)
            const selected = key === dateKey(selectedDate)
            const outside = date.getMonth() !== month.getMonth()
            return <button className={`${outside ? 'outside' : ''} ${isToday ? 'today' : ''} ${selected ? 'selected' : ''}`} type="button" role="gridcell" aria-selected={selected} aria-label={`${dayFormatter.format(date)}, ${dayEvents.length} events`} key={key} onClick={() => setSelectedDate(date)}><time>{date.getDate()}</time><span className="calendarEvents">{dayEvents.slice(0, 2).map((event, index) => <i className={index % 2 ? 'violet' : 'cyan'} key={event.id}>{event.title}</i>)}{dayEvents.length > 2 ? <small>+{dayEvents.length - 2} more</small> : null}</span></button>
          })}</div>
        </div>
        <aside className="dayAgenda" aria-label="Selected day agenda">
          <small>AGENDA</small><h2>{dayFormatter.format(selectedDate)}</h2><p>{selectedEvents.length ? `${selectedEvents.length} scheduled ${selectedEvents.length === 1 ? 'event' : 'events'}` : 'Your day is clear'}</p>
          {status === 'loading' ? <div className="agendaEmpty"><Sparkles size={18} />Loading schedule…</div> : null}
          {status === 'error' ? <div className="agendaEmpty">Calendar unavailable</div> : null}
          {status === 'ready' && !selectedEvents.length ? <div className="agendaEmpty"><CalendarDays size={20} /><b>Focus time</b><span>No meetings scheduled for this day.</span></div> : null}
          <div className="agendaEvents">{selectedEvents.map((event, index) => <article className={index % 2 ? 'violet' : 'cyan'} key={event.id}><time><Clock3 size={13} />{timeFormatter.format(new Date(event.startAt))} – {timeFormatter.format(new Date(event.endAt))}</time><b>{event.title}</b><span><Users size={13} />{event.attendees.join(' · ')}</span></article>)}</div>
        </aside>
      </div>
    </section>
  )
}
