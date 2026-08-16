import { Paperclip, Send, Sparkles, X } from 'lucide-react'
import { useState } from 'react'
import { IconButton } from '../../components/common/IconButton'
import { mailService } from '../../services/mailService'

const emptyDraft = { to: '', subject: '', body: '' }

export function ComposeModal({ onClose, onSent }) {
  const [draft, setDraft] = useState(emptyDraft)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  function updateField(event) {
    setDraft((current) => ({ ...current, [event.target.name]: event.target.value }))
    setError('')
  }

  async function submit(event) {
    event.preventDefault()
    if (!draft.to.trim() || !draft.subject.trim()) {
      setError('Add a recipient and subject before sending.')
      return
    }
    setSending(true)
    try {
      await mailService.sendMessage(draft)
    } catch (sendError) {
      setError(sendError.message)
      setSending(false)
      return
    }
    onSent('Message sent')
    onClose()
  }

  return (
    <div className="overlay" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <form className="modal" onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="compose-title">
        <div><b id="compose-title">New Message</b><IconButton label="Close composer" onClick={onClose}><X size={17} /></IconButton></div>
        <input autoFocus name="to" value={draft.to} onChange={updateField} placeholder="To" aria-label="Recipient" />
        <input name="subject" value={draft.subject} onChange={updateField} placeholder="Subject" aria-label="Subject" />
        <textarea name="body" value={draft.body} onChange={updateField} placeholder="Write something brilliant…" aria-label="Message body" />
        {error ? <p className="formError" role="alert">{error}</p> : null}
        <div className="composeActions">
          <button className="sendAi" type="submit" disabled={sending}><Send size={15} />{sending ? 'Sending…' : 'Send'}</button>
          <button className="icon" type="button" aria-label="Attach file"><Paperclip size={16} /></button>
          <button className="aiCompose" type="button"><Sparkles size={14} />Write with Olivia</button>
        </div>
      </form>
    </div>
  )
}
