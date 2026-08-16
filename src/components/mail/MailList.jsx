import { ChevronDown, SlidersHorizontal } from 'lucide-react'
import { Avatar } from '../common/Avatar'
import { IconButton } from '../common/IconButton'
import { EmptyState, ErrorState, MailListSkeleton } from '../common/ViewState'

export function MailList({ activeFolder, error, messages, onRetry, onSelect, query, selectedId, status }) {
  return (
    <section className="list card" aria-label={`${activeFolder} messages`}>
      <div className="listhead">
        <div><h2>{activeFolder}</h2><small>{messages.filter(({ unread }) => unread).length} unread</small></div>
        <div><IconButton label="Filter messages"><SlidersHorizontal size={16} /></IconButton><IconButton label="Sort messages"><ChevronDown size={16} /></IconButton></div>
      </div>
      <div className="tabs" role="tablist" aria-label="Inbox category"><button className="active" type="button" role="tab" aria-selected="true">Focused</button><button type="button" role="tab">Other</button></div>
      <div className="day">Today</div>
      <div className="rows">
        {status === 'loading' ? <MailListSkeleton /> : null}
        {status === 'error' ? <ErrorState onRetry={onRetry} /> : null}
        {status === 'ready' && !messages.length ? <EmptyState query={query} /> : null}
        {status === 'ready' && messages.map((message) => (
          <button
            key={message.id}
            type="button"
            className={`mailrow ${message.id === selectedId ? 'selected' : ''}`}
            onClick={() => onSelect(message.id)}
            aria-current={message.id === selectedId}
          >
            <Avatar initials={message.initials} tone={message.tone} small />
            <div><div className="rowtop"><b>{message.sender}</b><span>{message.time}</span></div><strong>{message.subject}</strong><small>{message.preview}</small></div>
            {message.unread ? <i aria-label="Unread" /> : null}
          </button>
        ))}
      </div>
      <div className="listfoot">Updated just now</div>
    </section>
  )
}
