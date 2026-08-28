import { useState } from 'react'
import {
  Archive, Clock3, Forward, MoreHorizontal, Paperclip, PanelRightClose, PanelRightOpen,
  Plus, Reply, ReplyAll, Sparkles, Star, Tag, Trash2, X,
} from 'lucide-react'
import { Avatar } from '../common/Avatar'
import { IconButton } from '../common/IconButton'
import { AttachmentCard } from './AttachmentCard'
import { SuggestedReply } from './SuggestedReply'

function LabelsEditor({ knownLabels, labels, onChange }) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')

  const currentLabels = labels ?? []

  function removeLabel(label) {
    onChange(currentLabels.filter((item) => item !== label))
  }

  function toggleLabel(label) {
    onChange(
      currentLabels.includes(label)
        ? currentLabels.filter((item) => item !== label)
        : [...currentLabels, label],
    )
  }

  function addNewLabel(event) {
    event.preventDefault()
    const value = draft.trim()
    if (!value || currentLabels.includes(value)) return
    onChange([...currentLabels, value])
    setDraft('')
  }

  const suggestions = knownLabels.filter((label) => !currentLabels.includes(label))

  return (
    <div className="labelsEditor">
      <span className="classifyLabel">Classify:</span>
      {currentLabels.map((label) => (
        <span className="labelChip" key={label}>
          {label}
          <button type="button" aria-label={`Remove label ${label}`} onClick={() => removeLabel(label)}><X size={11} /></button>
        </span>
      ))}
      <div className="labelAdd">
        <IconButton label="Add label" onClick={() => setOpen((current) => !current)}><Tag size={13} /><Plus size={10} /></IconButton>
        {open ? (
          <div className="labelAddPanel" role="menu">
            {suggestions.length ? suggestions.map((label) => (
              <button type="button" key={label} onClick={() => { toggleLabel(label); setOpen(false) }}><i className={`dot d${knownLabels.indexOf(label) % 4}`} />{label}</button>
            )) : null}
            <form onSubmit={addNewLabel}>
              <input
                autoFocus
                aria-label="New label name"
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Create label…"
                value={draft}
              />
              <button type="submit" disabled={!draft.trim()}>Add</button>
            </form>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export function MailReader({
  aiOpen, analysis, knownLabels, message, onAiToggle, onArchive, onDelete, onForward, onLabelsChange,
  onMoveToSpam, onNotify, onReply, onReplyAll, onSnooze, onToggleStar, aiStatus,
}) {
  const [moreOpen, setMoreOpen] = useState(false)
  const [pendingAction, setPendingAction] = useState('')

  if (!message) {
    return <section className="reader card readerEmpty"><MailReaderPlaceholder /></section>
  }

  async function handleArchive() {
    setPendingAction('archive')
    try {
      await onArchive()
      onNotify('Message archived')
    } catch (error) {
      onNotify(error.message || 'Unable to archive message')
    } finally {
      setPendingAction('')
    }
  }

  async function handleDelete() {
    setPendingAction('delete')
    try {
      await onDelete()
      onNotify('Message moved to Trash')
    } catch (error) {
      onNotify(error.message || 'Unable to delete message')
    } finally {
      setPendingAction('')
    }
  }

  async function handleSnooze() {
    setPendingAction('snooze')
    try {
      await onSnooze()
      onNotify('Message moved to Snoozed')
    } catch (error) {
      onNotify(error.message || 'Unable to snooze message')
    } finally {
      setPendingAction('')
    }
  }

  async function handleMoreAction(action) {
    setMoreOpen(false)
    setPendingAction(action)
    try {
      if (action === 'star') {
        const result = await onToggleStar()
        onNotify(result.starred ? 'Message starred' : 'Star removed')
      } else if (action === 'spam') {
        await onMoveToSpam()
        onNotify('Message moved to Spam')
      } else if (action === 'copy') {
        await navigator.clipboard.writeText(message.email)
        onNotify('Sender address copied')
      }
    } catch (error) {
      onNotify(error.message || 'Unable to update message')
    } finally {
      setPendingAction('')
    }
  }

  async function handleLabelsChange(nextLabels) {
    try {
      await onLabelsChange(message.id, nextLabels)
    } catch (error) {
      onNotify(error.message || 'Unable to update labels')
    }
  }

  return (
    <section className="reader card" aria-label={`Message from ${message.sender}`}>
      <div className="toolbar">
        <button type="button" onClick={handleArchive} disabled={Boolean(pendingAction)}><Archive size={15} />{pendingAction === 'archive' ? 'Archiving…' : 'Archive'}</button>
        <button type="button" onClick={handleSnooze} disabled={Boolean(pendingAction)}><Clock3 size={15} />{pendingAction === 'snooze' ? 'Snoozing…' : 'Snooze'}</button>
        <button type="button" onClick={handleDelete} disabled={Boolean(pendingAction)}><Trash2 size={15} />{pendingAction === 'delete' ? 'Deleting…' : 'Delete'}</button>
        <div className="toolbarMenu">
          <button type="button" className="toolbarMenuTrigger" aria-expanded={moreOpen} aria-haspopup="menu" onClick={() => setMoreOpen((current) => !current)} disabled={Boolean(pendingAction)}><MoreHorizontal size={16} />More</button>
          {moreOpen ? (
            <div className="toolbarMenuPanel" role="menu">
              <button type="button" role="menuitem" onClick={() => handleMoreAction('star')}><Star size={14} />{message.starred ? 'Remove star' : 'Add star'}</button>
              <button type="button" role="menuitem" onClick={() => handleMoreAction('copy')}>Copy sender address</button>
              <button type="button" role="menuitem" onClick={() => handleMoreAction('spam')}>Move to Spam</button>
            </div>
          ) : null}
        </div>
        <span />
        <IconButton label={aiOpen ? 'Collapse AI Workspace' : 'Expand AI Workspace'} onClick={onAiToggle}>{aiOpen ? <PanelRightClose size={17} /> : <PanelRightOpen size={17} />}</IconButton>
      </div>
      <article>
        <div className="titleline">
          <div><h1>{message.subject}</h1><span className="important">Important</span><Star size={16} className={message.starred ? 'starred' : ''} /></div>
          <div><IconButton label="Reply" onClick={onReply}><Reply size={16} /></IconButton><IconButton label="Reply all" onClick={onReplyAll}><ReplyAll size={16} /></IconButton><IconButton label="Forward" onClick={onForward}><Forward size={16} /></IconButton></div>
        </div>
        <div className="sender"><Avatar initials={message.initials} tone={message.tone} /><div><b>{message.sender}</b><small>{message.email}</small><small>To: Olivier Steineur</small></div><time>Today, {message.time}</time></div>
        <LabelsEditor knownLabels={knownLabels ?? []} labels={message.labels} onChange={handleLabelsChange} />
        <div className="summary"><label><Sparkles size={14} />AI Summary</label><p>{aiStatus === 'error' ? 'Olivia AI temporarily unavailable' : (analysis?.summary?.[0] ?? 'Olivia is analyzing this email.')}</p></div>
        <div className="body">{message.body.map((paragraph, index) => <p key={`${message.id}-${index}`}>{paragraph}</p>)}</div>

        {message.attachments.length ? (
          <><div className="attachTitle"><Paperclip size={15} />{message.attachments.length} Attachments</div><div className="attachments">{message.attachments.map((attachment) => <AttachmentCard key={attachment.title} attachment={attachment} />)}</div></>
        ) : null}

        <SuggestedReply key={message.id} aiStatus={aiStatus} message={message} onSent={onNotify} suggestedReply={analysis?.suggestedReply ?? ''} />
      </article>
    </section>
  )
}

function MailReaderPlaceholder() {
  return <div className="viewState"><Sparkles size={24} /><b>Select a conversation</b><small>Message details and Olivia insights will appear here.</small></div>
}
