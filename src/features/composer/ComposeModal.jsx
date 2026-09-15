import { Maximize2, Minus, Paperclip, Send, Sparkles, X } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { aiService } from '../../services/aiService'
import { mailService } from '../../services/mailService'
import { clearComposeDraft, hasDraftContent, loadComposeDraft, saveComposeDraft } from './draftStorage'
import { RichTextToolbar } from './RichTextToolbar'
import { plainTextToHtml, sanitizeComposerHtml } from './richText'

const modeConfig = {
  new: { title: 'New Message', sentMessage: 'Message sent', toDisabled: false, subjectDisabled: false },
  reply: { title: 'Reply', sentMessage: 'Reply sent', toDisabled: true, subjectDisabled: true },
  'reply-all': { title: 'Reply All', sentMessage: 'Reply sent to all recipients', toDisabled: true, subjectDisabled: true },
  forward: { title: 'Forward', sentMessage: 'Message forwarded', toDisabled: false, subjectDisabled: true },
}

export function ComposeModal({ mailboxEmail = '', mode = 'new', messageId, initialTo = '', initialSubject = '', initialBody = '', onClose, onSent }) {
  const initialDraft = { to: initialTo, cc: '', bcc: '', subject: initialSubject, body: initialBody, html: plainTextToHtml(initialBody) }
  const restoredDraft = initialBody ? null : loadComposeDraft(mailboxEmail, mode, messageId)
  const [draft, setDraft] = useState(restoredDraft || initialDraft)
  const [showCc, setShowCc] = useState(Boolean(restoredDraft?.cc))
  const [showBcc, setShowBcc] = useState(Boolean(restoredDraft?.bcc))
  const [sending, setSending] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [saveStatus, setSaveStatus] = useState(restoredDraft ? 'Draft restored' : '')
  const [windowState, setWindowState] = useState('normal')
  const draftRef = useRef(draft)
  const saveTimerRef = useRef(null)
  const sentRef = useRef(false)
  const editorRef = useRef(null)
  const config = modeConfig[mode] ?? modeConfig.new

  draftRef.current = draft

  useLayoutEffect(() => {
    if (editorRef.current) editorRef.current.innerHTML = sanitizeComposerHtml(draftRef.current.html || plainTextToHtml(draftRef.current.body))
  }, [])

  useEffect(() => () => {
    window.clearTimeout(saveTimerRef.current)
    if (!sentRef.current) saveComposeDraft(mailboxEmail, mode, messageId, draftRef.current)
  }, [mailboxEmail, messageId, mode])

  function queueDraftSave(nextDraft) {
    window.clearTimeout(saveTimerRef.current)
    if (!hasDraftContent(nextDraft)) {
      clearComposeDraft(mailboxEmail, mode, messageId)
      setSaveStatus('')
      return
    }
    setSaveStatus('Saving draft...')
    saveTimerRef.current = window.setTimeout(() => {
      setSaveStatus(saveComposeDraft(mailboxEmail, mode, messageId, nextDraft) ? 'Draft saved' : 'Draft not saved')
    }, 350)
  }

  function updateField(event) {
    const nextDraft = { ...draftRef.current, [event.target.name]: event.target.value }
    draftRef.current = nextDraft
    setDraft(nextDraft)
    queueDraftSave(nextDraft)
    setError('')
  }

  function updateBodyFromEditor() {
    if (!editorRef.current) return
    const body = editorRef.current.innerText.replace(/\u00a0/g, ' ')
    if (!body.trim()) editorRef.current.innerHTML = ''
    const nextDraft = { ...draftRef.current, body, html: body.trim() ? sanitizeComposerHtml(editorRef.current.innerHTML) : '' }
    draftRef.current = nextDraft
    setDraft(nextDraft)
    queueDraftSave(nextDraft)
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
      if (mode === 'reply') await mailService.replyToMessage(messageId, draft.body, draft.html)
      else if (mode === 'reply-all') await mailService.replyAllMessage(messageId, draft.body, draft.html)
      else if (mode === 'forward') await mailService.forwardMessage(messageId, { to: draft.to, cc: draft.cc, bcc: draft.bcc, body: draft.body, html: draft.html })
      else await mailService.sendMessage(draft)
    } catch (sendError) {
      setError(sendError.message)
      setSending(false)
      return
    }
    sentRef.current = true
    window.clearTimeout(saveTimerRef.current)
    clearComposeDraft(mailboxEmail, mode, messageId)
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
      const nextDraft = { ...draftRef.current, body: response.draft, html: plainTextToHtml(response.draft), subject: response.subject || draftRef.current.subject }
      draftRef.current = nextDraft
      setDraft(nextDraft)
      if (editorRef.current) editorRef.current.innerHTML = nextDraft.html
      queueDraftSave(nextDraft)
    } catch (composeError) {
      setError(composeError.message)
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className={`overlay composeOverlay is-${windowState}`}>
      <form className={`modal composeModal is-${windowState}`} onSubmit={submit} role="dialog" aria-modal={windowState !== 'minimized'} aria-labelledby="compose-title">
        <div className="composeTitlebar">
          <div className="composeWindowControls">
            <button className="windowControl close" type="button" aria-label="Close composer" onClick={onClose}><X size={9} /></button>
            <button className="windowControl minimize" type="button" aria-label={windowState === 'minimized' ? 'Restore composer' : 'Minimize composer'} onClick={() => setWindowState((current) => current === 'minimized' ? 'normal' : 'minimized')}><Minus size={9} /></button>
            <button className="windowControl maximize" type="button" aria-label={windowState === 'maximized' ? 'Reduce composer' : 'Maximize composer'} onClick={() => setWindowState((current) => current === 'maximized' ? 'normal' : 'maximized')}><Maximize2 size={8} /></button>
          </div>
          <b id="compose-title">{config.title}</b>
        </div>
        <div className="composeRecipients">
          <input autoFocus name="to" value={draft.to} onChange={updateField} placeholder="To" aria-label="Recipient" disabled={config.toDisabled} />
          {!config.toDisabled ? <div className="composeRecipientToggles">
            <button type="button" onClick={() => setShowCc(true)} aria-expanded={showCc}>CC</button>
            <button type="button" onClick={() => setShowBcc(true)} aria-expanded={showBcc}>CCI</button>
          </div> : null}
        </div>
        {showCc ? <input name="cc" value={draft.cc} onChange={updateField} placeholder="CC" aria-label="Carbon copy recipients" /> : null}
        {showBcc ? <input name="bcc" value={draft.bcc} onChange={updateField} placeholder="CCI" aria-label="Blind carbon copy recipients" /> : null}
        <input name="subject" value={draft.subject} onChange={updateField} placeholder="Subject" aria-label="Subject" disabled={config.subjectDisabled} />
        <div ref={editorRef} className="composeEditor" contentEditable role="textbox" aria-label="Message body" aria-multiline="true" data-placeholder={mode === 'forward' ? 'Add a note (the original message is attached automatically)…' : 'Write something brilliant…'} onInput={updateBodyFromEditor} />
        <RichTextToolbar editorRef={editorRef} onChange={updateBodyFromEditor} />
        {error ? <p className="formError" role="alert">{error}</p> : null}
        <div className="composeActions">
          <button className="sendAi" type="submit" disabled={sending}><Send size={15} />{sending ? 'Sending…' : 'Send'}</button>
          <button className="icon" type="button" aria-label="Attach file"><Paperclip size={16} /></button>
          {saveStatus ? <span className={`composeSaveStatus ${saveStatus === 'Draft not saved' ? 'error' : ''}`} role="status">{saveStatus}</span> : null}
          <button className="aiCompose" type="button" onClick={writeWithOlivia} disabled={generating}><Sparkles size={14} />{generating ? 'Writing…' : 'Write with Olivia'}</button>
        </div>
      </form>
    </div>
  )
}
