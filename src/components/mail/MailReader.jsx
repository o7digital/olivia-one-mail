import {
  Archive, Clock3, Forward, MoreHorizontal, Paperclip, PanelRightClose, PanelRightOpen,
  Reply, ReplyAll, Sparkles, Star, Trash2,
} from 'lucide-react'
import { Avatar } from '../common/Avatar'
import { IconButton } from '../common/IconButton'
import { AttachmentCard } from './AttachmentCard'
import { SuggestedReply } from './SuggestedReply'

export function MailReader({ aiOpen, message, onAiToggle, onNotify }) {
  if (!message) {
    return <section className="reader card readerEmpty"><MailReaderPlaceholder /></section>
  }

  return (
    <section className="reader card" aria-label={`Message from ${message.sender}`}>
      <div className="toolbar">
        <button type="button" onClick={() => onNotify('Message archived')}><Archive size={15} />Archive</button>
        <button type="button" onClick={() => onNotify('Message snoozed until tomorrow')}><Clock3 size={15} />Snooze</button>
        <button type="button" onClick={() => onNotify('Message moved to Trash')}><Trash2 size={15} />Delete</button>
        <button type="button"><MoreHorizontal size={16} />More</button>
        <span />
        <IconButton label={aiOpen ? 'Collapse AI Workspace' : 'Expand AI Workspace'} onClick={onAiToggle}>{aiOpen ? <PanelRightClose size={17} /> : <PanelRightOpen size={17} />}</IconButton>
      </div>
      <article>
        <div className="titleline">
          <div><h1>{message.subject}</h1><span className="important">Important</span><Star size={16} className={message.starred ? 'starred' : ''} /></div>
          <div><IconButton label="Reply"><Reply size={16} /></IconButton><IconButton label="Reply all"><ReplyAll size={16} /></IconButton><IconButton label="Forward"><Forward size={16} /></IconButton></div>
        </div>
        <div className="sender"><Avatar initials={message.initials} tone={message.tone} /><div><b>{message.sender}</b><small>{message.email}</small><small>To: Olivier Steineur</small></div><time>Today, {message.time}</time></div>
        <div className="summary"><label><Sparkles size={14} />AI Summary</label><p>{message.sender} follows up on an important conversation. Olivia detected a strong commercial signal and recommends a focused response plus a follow-up action.</p></div>
        <div className="body">{message.body.map((paragraph, index) => <p key={`${message.id}-${index}`}>{paragraph}</p>)}</div>

        {message.attachments.length ? (
          <><div className="attachTitle"><Paperclip size={15} />{message.attachments.length} Attachments</div><div className="attachments">{message.attachments.map((attachment) => <AttachmentCard key={attachment.title} attachment={attachment} />)}</div></>
        ) : null}

        <SuggestedReply key={message.id} message={message} onSent={onNotify} />
      </article>
    </section>
  )
}

function MailReaderPlaceholder() {
  return <div className="viewState"><Sparkles size={24} /><b>Select a conversation</b><small>Message details and Olivia insights will appear here.</small></div>
}
