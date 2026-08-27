import { useState } from 'react'
import { Check, ChevronDown, SlidersHorizontal, X } from 'lucide-react'
import { Avatar } from '../common/Avatar'
import { IconButton } from '../common/IconButton'
import { EmptyState, ErrorState, MailListSkeleton } from '../common/ViewState'

const SORT_OPTIONS = [
  { value: 'date-desc', label: 'Newest first' },
  { value: 'date-asc', label: 'Oldest first' },
  { value: 'label', label: 'By label' },
]

export function MailList({
  activeFolder, category, error, labelFilter, messages, onCategoryChange, onClearLabelFilter, onRetry, onSelect,
  onSortChange, query, selectedId, sortBy, status,
}) {
  const [sortMenuOpen, setSortMenuOpen] = useState(false)
  const activeSortLabel = SORT_OPTIONS.find(({ value }) => value === sortBy)?.label ?? 'Sort messages'

  return (
    <section className="list card" aria-label={`${activeFolder} messages`}>
      <div className="listhead">
        <div><h2>{activeFolder}</h2><small>{messages.filter(({ unread }) => unread).length} unread</small></div>
        <div>
          <IconButton label="Filter messages"><SlidersHorizontal size={16} /></IconButton>
          <div className="sortMenu">
            <IconButton label={`Sort messages (${activeSortLabel})`} onClick={() => setSortMenuOpen((current) => !current)}>
              <ChevronDown size={16} />
            </IconButton>
            {sortMenuOpen ? (
              <div className="sortMenuPanel" role="menu">
                {SORT_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    role="menuitemradio"
                    aria-checked={option.value === sortBy}
                    onClick={() => {
                      onSortChange(option.value)
                      setSortMenuOpen(false)
                    }}
                  >
                    {option.value === sortBy ? <Check size={13} /> : <span className="sortSpacer" />}
                    {option.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>
      {activeFolder === 'Inbox' ? (
        <div className="tabs" role="tablist" aria-label="Inbox category">
          <button className={category === 'focused' ? 'active' : ''} type="button" role="tab" aria-selected={category === 'focused'} onClick={() => onCategoryChange('focused')}>Focused</button>
          <button className={category === 'other' ? 'active' : ''} type="button" role="tab" aria-selected={category === 'other'} onClick={() => onCategoryChange('other')}>Other</button>
        </div>
      ) : null}
      {labelFilter ? (
        <div className="labelFilterBar">
          Filtered by <b>{labelFilter}</b>
          <button type="button" onClick={onClearLabelFilter}><X size={12} />Clear</button>
        </div>
      ) : null}
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
            <div>
              <div className="rowtop"><b>{message.sender}</b><span>{message.time}</span></div>
              <strong>{message.subject}</strong>
              <small>{message.preview}</small>
              {message.labels?.length ? (
                <div className="rowlabels">{message.labels.map((label) => <em key={label}>{label}</em>)}</div>
              ) : null}
            </div>
            {message.unread ? <i aria-label="Unread" /> : null}
          </button>
        ))}
      </div>
      <div className="listfoot">Updated just now</div>
    </section>
  )
}
