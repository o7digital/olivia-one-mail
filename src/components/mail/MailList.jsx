import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, RefreshCw, SlidersHorizontal, Star, X } from 'lucide-react'
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
  onCheckMail, onLoadMore, onSortChange, pagination, query, refreshing = false, selectedId, sortBy, status,
  starredOnly, onStarredOnlyChange, loadingMore, loadMoreError,
}) {
  const [filterMenuOpen, setFilterMenuOpen] = useState(false)
  const rowsRef = useRef(null)
  const sentinelRef = useRef(null)
  const hasMore = pagination?.page < pagination?.totalPages

  useEffect(() => {
    if (status !== 'ready' || !hasMore || loadingMore || loadMoreError) return
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) onLoadMore()
    }, { root: rowsRef.current, rootMargin: '0px 0px 160px 0px' })
    if (sentinelRef.current) observer.observe(sentinelRef.current)
    return () => observer.disconnect()
  }, [status, hasMore, loadingMore, loadMoreError, onLoadMore, messages.length])

  useEffect(() => {
    rowsRef.current?.scrollTo({ top: 0 })
  }, [activeFolder, starredOnly])

  const [sortMenuOpen, setSortMenuOpen] = useState(false)
  const activeSortLabel = SORT_OPTIONS.find(({ value }) => value === sortBy)?.label ?? 'Sort messages'

  return (
    <section className="list card" aria-label={`${activeFolder} messages`}>
      <div className="listhead">
        <div><h2>{activeFolder}</h2><small>{messages.filter(({ unread }) => unread).length} unread</small></div>
        <div>
          <div className="sortMenu">
            <IconButton label="Filter messages" aria-expanded={filterMenuOpen} aria-haspopup="menu" onClick={() => setFilterMenuOpen((current) => !current)}><SlidersHorizontal size={16} /></IconButton>
            {filterMenuOpen ? (
              <div className="sortMenuPanel" role="menu">
                {[{ value: false, label: 'All messages' }, { value: true, label: 'Favorites' }].map((option) => (
                  <button key={option.label} type="button" role="menuitemradio" aria-checked={starredOnly === option.value} onClick={() => { onStarredOnlyChange(option.value); setFilterMenuOpen(false) }}>
                    {starredOnly === option.value ? <Check size={13} /> : <span className="sortSpacer" />}{option.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
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
      <button className="checkMail" type="button" onClick={onCheckMail} disabled={status === 'loading' || refreshing} aria-busy={status === 'loading' || refreshing}>
        <RefreshCw size={14} className={status === 'loading' || refreshing ? 'checkMailSpinner' : ''} />
        <span>{status === 'loading' || refreshing ? 'Checking…' : 'Check Mail'}</span>
      </button>
      {activeFolder === 'Inbox' && !starredOnly ? (
        <div className="tabs" role="tablist" aria-label="Inbox category">
          <button className={category === 'focused' ? 'active' : ''} type="button" role="tab" aria-selected={category === 'focused'} onClick={() => onCategoryChange('focused')}>Focused</button>
          <button className={category === 'other' ? 'active' : ''} type="button" role="tab" aria-selected={category === 'other'} onClick={() => onCategoryChange('other')}>Other</button>
        </div>
      ) : null}
      {starredOnly ? (
        <div className="labelFilterBar"><Star size={12} /><b>Favorites</b><button type="button" onClick={() => onStarredOnlyChange(false)}><X size={12} />Clear favorites filter</button></div>
      ) : null}
      {labelFilter ? (
        <div className="labelFilterBar">
          Filtered by <b>{labelFilter}</b>
          <button type="button" onClick={onClearLabelFilter}><X size={12} />Clear</button>
        </div>
      ) : null}
      <div className="day">Today</div>
      <div className="rows" ref={rowsRef} aria-label="Message list" aria-busy={loadingMore}>
        {status === 'loading' ? <MailListSkeleton /> : null}
        {status === 'error' ? <ErrorState error={error} onRetry={onRetry} /> : null}
        {status === 'ready' && !messages.length ? <EmptyState query={query} starredOnly={starredOnly} /> : null}
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
              <div className="rowtop"><b>{message.sender}</b><span>{message.starred ? <Star size={11} className="rowStar" aria-label="Favorite" /> : null}{message.time}</span></div>
              <strong>{message.subject}</strong>
              <small>{message.preview}</small>
              {message.labels?.length ? (
                <div className="rowlabels">{message.labels.map((label) => <em key={label}>{label}</em>)}</div>
              ) : null}
            </div>
            {message.unread ? <i aria-label="Unread" /> : null}
          </button>
        ))}
        {status === 'ready' ? (
          <div className="loadMore" ref={sentinelRef}>
            {loadingMore ? <span role="status">Loading more messages…</span> : loadMoreError ? (
              <><span role="alert">{loadMoreError.message}</span><button type="button" onClick={onLoadMore}>Retry loading more messages</button></>
            ) : hasMore ? <button type="button" onClick={onLoadMore}>Load more messages</button> : messages.length ? <span>All messages loaded</span> : null}
          </div>
        ) : null}
      </div>
      <div className="listfoot">
        <span>{pagination?.total ?? messages.length} {starredOnly ? 'favorites' : 'messages'}</span>
        <span>{messages.length} shown</span>
      </div>
    </section>
  )
}
