import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, Check, CheckSquare2, Plus, Sparkles, Trash2 } from 'lucide-react'
import { taskService } from '../../services/taskService'

function formatDueDate(value) {
  if (!value) return 'No due date'
  const date = new Date(`${value}T12:00:00`)
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)
  if (date.toDateString() === today.toDateString()) return 'Due today'
  if (date.toDateString() === tomorrow.toDateString()) return 'Due tomorrow'
  return `Due ${new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(date)}`
}

export function TasksPage({ onNotify }) {
  const [tasks, setTasks] = useState([])
  const [status, setStatus] = useState('loading')
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState('open')

  useEffect(() => {
    let active = true
    taskService.list()
      .then((items) => { if (active) { setTasks(items); setStatus('ready') } })
      .catch(() => { if (active) setStatus('error') })
    return () => { active = false }
  }, [])

  const visibleTasks = useMemo(() => tasks.filter((task) => filter === 'all' || (filter === 'done' ? task.completed : !task.completed)), [filter, tasks])
  const openCount = tasks.filter((task) => !task.completed).length
  const today = new Date().toISOString().slice(0, 10)
  const dueToday = tasks.filter((task) => !task.completed && task.dueAt === today).length

  async function addTask(event) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const title = String(data.get('title') || '').trim()
    if (!title) return
    setSaving(true)
    try {
      const task = await taskService.create({ title, dueAt: data.get('dueAt') || null, priority: data.get('priority') })
      setTasks((current) => [task, ...current])
      form.reset()
      onNotify('Task created')
    } catch (error) {
      onNotify(error.message || 'Unable to create task')
    } finally {
      setSaving(false)
    }
  }

  async function toggleTask(task) {
    const completed = !task.completed
    setTasks((current) => current.map((item) => item.id === task.id ? { ...item, completed } : item))
    try {
      await taskService.update(task.id, { completed })
      onNotify(completed ? 'Task completed' : 'Task reopened')
    } catch (error) {
      setTasks((current) => current.map((item) => item.id === task.id ? task : item))
      onNotify(error.message || 'Unable to update task')
    }
  }

  async function removeTask(task) {
    setTasks((current) => current.filter((item) => item.id !== task.id))
    try {
      await taskService.delete(task.id)
      onNotify('Task deleted')
    } catch (error) {
      setTasks((current) => [...current, task])
      onNotify(error.message || 'Unable to delete task')
    }
  }

  return (
    <section className="featurePage card tasksPage">
      <div className="tasksHeader">
        <div className="featureHero"><span className="featureIcon"><CheckSquare2 size={24} /></span><small>Momentum</small><h1>Tasks</h1><p>Turn every follow-up into clear, focused action.</p></div>
        <div className="tasksSummary"><span><b>{openCount}</b>Open</span><span><b>{dueToday}</b>Due today</span><i><Sparkles size={14} />Olivia ready</i></div>
      </div>

      <form className="taskComposer" onSubmit={addTask}>
        <span className="taskComposerIcon"><Plus size={18} /></span>
        <label><span>New task</span><input name="title" aria-label="Task title" placeholder="What needs to be done?" maxLength="240" required /></label>
        <label><span>Due date</span><input name="dueAt" aria-label="Due date" type="date" /></label>
        <label><span>Priority</span><select name="priority" aria-label="Priority" defaultValue="normal"><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option></select></label>
        <button type="submit" disabled={saving}>{saving ? 'Adding…' : <><Plus size={15} />Add task</>}</button>
      </form>

      <div className="taskBoard">
        <div className="taskBoardHead"><div role="tablist" aria-label="Task filters">{[['open', 'Open'], ['done', 'Completed'], ['all', 'All']].map(([value, label]) => <button role="tab" aria-selected={filter === value} type="button" key={value} onClick={() => setFilter(value)}>{label}</button>)}</div><small>{visibleTasks.length} {visibleTasks.length === 1 ? 'task' : 'tasks'}</small></div>
        {status === 'loading' ? <div className="tasksEmpty"><Sparkles size={20} /><b>Loading your tasks…</b></div> : null}
        {status === 'error' ? <div className="tasksEmpty"><b>Tasks could not be loaded.</b><small>Please refresh and try again.</small></div> : null}
        {status === 'ready' && !visibleTasks.length ? <div className="tasksEmpty"><Check size={22} /><b>{filter === 'open' ? 'Everything is clear' : 'No tasks here yet'}</b><small>{filter === 'open' ? 'Add a task above when something needs your attention.' : 'Completed tasks will appear here.'}</small></div> : null}
        <div className="taskRows">{visibleTasks.map((task) => (
          <article className={`taskRow ${task.completed ? 'isDone' : ''}`} key={task.id}>
            <button className="taskCheck" type="button" aria-label={task.completed ? `Reopen ${task.title}` : `Complete ${task.title}`} onClick={() => toggleTask(task)}>{task.completed ? <Check size={14} /> : null}</button>
            <div><b>{task.title}</b><span><CalendarDays size={12} />{formatDueDate(task.dueAt)}<i className={`taskPriority ${task.priority}`}>{task.priority}</i></span></div>
            <button className="taskDelete" type="button" aria-label={`Delete ${task.title}`} onClick={() => removeTask(task)}><Trash2 size={15} /></button>
          </article>
        ))}</div>
      </div>
    </section>
  )
}
