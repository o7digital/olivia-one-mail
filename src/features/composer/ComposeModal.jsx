import { Paperclip, Send, Sparkles, X } from 'lucide-react'
import { useState } from 'react'
import { IconButton } from '../../components/common/IconButton'
import { aiService } from '../../services/aiService'
import { mailService } from '../../services/mailService'

const modeConfig = {
  new: { title: 'New Message', sentMessage: 'Message sent', toDisabled: false, subjectDisabled: false },
  reply: { title: 'Reply', sentMessage: 'Reply sent', toDisabled: true, subjectDisabled: true },
  'reply-all': { title: 'Reply All', sentMessage: 'Reply sent to all recipients', toDisabled: true, subjectDisabled: true },
  forward: { title: 'Forward', sentMessage: 'Message forwarded', toDisabled: false, subjectDisabled: true },
}

export function ComposeModal({ mode = 'new', messageId, initialTo = '', initialSubject = '', onClose, onSent }) {
  const [draft, setDraft] = useState({ to: initialTo, subject: initialSubject, body: '' })
  const [sending, setSending] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const config = modeConfig[mode] ?? modeConfig.new

  function updateField(event) {
    setDraft((current) => ({ ...current, [event.target.name]: event.target.value }))
    setError('')
  }

  async function submit(event) {
    event.preventDefault()
    if (mode === 'new' && (!draft.to.trim() || !draft.subject.trim())) {
      setError('Add a recipient and subject before sending.')
      return
    }
    if (mode === 'forward' && !draft.to.trim()) {
      setError('Add a recipient before sending.')
      return
    }
    setSending(true)
    try {
      if (mode === 'reply') await mailService.replyToMessage(messageId, draft.body)
      else if (mode === 'reply-all') await mailService.replyAllMessage(messageId, draft.body)
      else if (mode === 'forward') await mailService.forwardMessage(messageId, { to: draft.to, body: draft.body })
      else await mailService.sendMessage(draft)
    } catch (sendError) {
      setError(sendError.message)
      setSending(false)
      return
    }
    onSent(config.sentMessage)
    onClose()
  }

  async function writeWithOlivia() {
    setGenerating(true)
    setError('')
    try {
      const response = await aiService.composeDraft({
        prompt: draft.body || `Write an email to ${draft.to || 'the recipient'} about ${draft.subject || 'this topic'}.`,
        recipient: draft.to,
        subject: draft.subject,
        currentDraft: draft.body,
      })
      setDraft((current) => ({ ...current, body: response.draft }))
    } catch (composeError) {
      setError(composeError.message)
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="overlay" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <form className="modal" onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="compose-title">
        <div><b id="compose-title">{config.title}</b><IconButton label="Close composer" onClick={onClose}><X size={17} /></IconButton></div>
        <input autoFocus name="to" value={draft.to} onChange={updateField} placeholder="To" aria-label="Recipient" disabled={config.toDisabled} />
        <input name="subject" value={draft.subject} onChange={updateField} placeholder="Subject" aria-label="Subject" disabled={config.subjectDisabled} />
        <textarea name="body" value={draft.body} onChange={updateField} placeholder={mode === 'forward' ? 'Add a note (the original message is attached automatically)…' : 'Write something brilliant…'} aria-label="Message body" />
        {error ? <p className="formError" role="alert">{error}</p> : null}
        <div className="composeActions">
          <button className="sendAi" type="submit" disabled={sending}><Send size={15} />{sending ? 'Sending…' : 'Send'}</button>
          <button className="icon" type="button" aria-label="Attach file"><Paperclip size={16} /></button>
          <button className="aiCompose" type="button" onClick={writeWithOlivia} disabled={generating}><Sparkles size={14} />{generating ? 'Writing…' : 'Write with Olivia'}</button>
        </div>
      </form>
    </div>
  )
}
