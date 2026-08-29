import { useEffect, useState } from 'react'
import { CalendarClock, Check, Clock3, Mail, X } from 'lucide-react'
import { intelligenceService } from '../../services/intelligenceService'

function formatDate(value) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

export function WaitingPage({ onNotify, onOpenMessage }) {
  const [items, setItems] = useState([])
  const [status, setStatus] = useState('loading')

  useEffect(() => { intelligenceService.listFollowUps().then((value) => { setItems(value); setStatus('ready') }).catch(() => setStatus('error')) }, [])

  async function update(item, input) {
    try {
      const updated = await intelligenceService.updateFollowUp(item.id, input)
      setItems((current) => current.map((candidate) => candidate.id === item.id ? updated : candidate))
    } catch (error) { onNotify(error.message || 'Unable to update follow-up') }
  }

  const visible = items.filter((item) => !['dismissed', 'done'].includes(item.status))
  return (
    <section className="featurePage card waitingPage">
      <header className="waitingHeader"><div className="featureHero"><span className="featureIcon"><CalendarClock size={24} /></span><small>Follow-through</small><h1>Waiting</h1><p>Conversations that need a reply or a future action.</p></div><div className="tasksSummary"><span><b>{visible.length}</b>Active</span><i><Clock3 size={14} />Server-synced</i></div></header>
      {status === 'loading' ? <div className="tasksEmpty"><b>Loading follow-ups…</b></div> : null}
      {status === 'error' ? <div className="tasksEmpty"><b>Follow-ups are unavailable.</b><small>Please refresh and try again.</small></div> : null}
      {status === 'ready' && !visible.length ? <div className="tasksEmpty"><Check size={22} /><b>Nothing is waiting</b><small>Mark a conversation as Waiting from its Olivia actions.</small></div> : null}
      <div className="taskRows">{visible.map((item) => <article className="taskRow waitingRow" key={item.id}>
        <span className="featureIcon"><Mail size={16} /></span><div><b>{item.subject || 'Conversation follow-up'}</b><span>{item.contactName || item.contactEmail || 'Contact'} · {formatDate(item.followUpAt)}</span>{item.note ? <small>{item.note}</small> : null}</div>
        <div className="waitingActions"><button type="button" onClick={() => onOpenMessage(item)}><Mail size={14} />Open</button><button type="button" onClick={() => update(item, { followUpAt: new Date(Date.now() + 86400000).toISOString(), status: 'snoozed' })}><Clock3 size={14} />Snooze</button><button type="button" aria-label={`Dismiss ${item.subject}`} onClick={() => update(item, { status: 'dismissed' })}><X size={14} /></button></div>
      </article>)}</div>
    </section>
  )
}
