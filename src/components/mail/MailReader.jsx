import { useState } from 'react'
import {
  Archive, Forward, MoreHorizontal, Paperclip, PanelRightClose, PanelRightOpen,
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
  onNotify, onReply, onReplyAll, aiStatus,
}) {
  if (!message) {
    return <section className="reader card readerEmpty"><MailReaderPlaceholder /></section>
  }

  async function handleArchive() {
    try {
      await onArchive()
      onNotify('Message archived')
    } catch (error) {
      onNotify(error.message || 'Unable to archive message')
    }
  }

  async function handleDelete() {
    try {
      await onDelete()
      onNotify('Message moved to Trash')
    } catch (error) {
      onNotify(error.message || 'Unable to delete message')
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
        <button type="button" onClick={handleArchive}><Archive size={15} />Archive</button>
        <button type="button" onClick={handleDelete}><Trash2 size={15} />Delete</button>
        <button type="button"><MoreHorizontal size={16} />More</button>
        <span />
        <IconButton label={aiOpen ? 'Collapse AI Workspace' : 'Expand AI Workspace'} onClick={onAiToggle}>{aiOpen ? <PanelRightClose size={17} /> : <PanelRightOpen size={17} />}</IconButton>
      </div>
      <article>
        <div className="messageCanvas">
        <div className="titleline">
          <div><h1>{message.subject}</h1><span className="important">Important</span><Star size={16} className={message.starred ? 'starred' : ''} /></div>
        </div>
        <div className="sender"><Avatar initials={message.initials} tone={message.tone} /><div><b>{message.sender}</b><small>{message.email}</small><small>To: Olivier Steineur</small></div><time>Today, {message.time}</time></div>
        <LabelsEditor knownLabels={knownLabels ?? []} labels={message.labels} onChange={handleLabelsChange} />
        <div className="body">{message.body.map((paragraph, index) => <p key={`${message.id}-${index}`}>{paragraph}</p>)}</div>

        {message.attachments.length ? (
          <><div className="attachTitle"><Paperclip size={15} />{message.attachments.length} Attachments</div><div className="attachments">{message.attachments.map((attachment) => <AttachmentCard key={attachment.title} attachment={attachment} />)}</div></>
        ) : null}

        <div className="messageReplyActions"><button type="button" onClick={onReply}><Reply size={15} />Reply</button><button type="button" onClick={onReplyAll}><ReplyAll size={15} />Reply all</button><button type="button" onClick={onForward}><Forward size={15} />Forward</button></div>
        <SuggestedReply key={message.id} aiStatus={aiStatus} message={message} onSent={onNotify} suggestedReply={analysis?.suggestedReply ?? ''} />
        </div>
      </article>
    </section>
  )
}

function MailReaderPlaceholder() {
  return <div className="viewState"><Sparkles size={24} /><b>Select a conversation</b><small>Message details and Olivia insights will appear here.</small></div>
}
