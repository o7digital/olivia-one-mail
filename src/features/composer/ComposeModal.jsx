import { FileText, Maximize2, Minus, Paperclip, Send, Sparkles, X } from 'lucide-react'
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

const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024
const MAX_ATTACHMENT_COUNT = 10

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10240 ? 1 : 0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

async function serializeAttachment(file) {
  const bytes = new Uint8Array(await file.arrayBuffer())
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000))
  }
  return {
    filename: file.name,
    contentType: file.type || 'application/octet-stream',
    size: file.size,
    contentBase64: window.btoa(binary),
  }
}

function formatForwardDate(message) {
  if (!message?.receivedAt) return message?.time || ''
  const receivedAt = new Date(message.receivedAt)
  if (Number.isNaN(receivedAt.getTime())) return message.time || ''
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(receivedAt)
}

function forwardedBodyText(message) {
  return message?.bodyText || message?.body?.join('\n') || ''
}

function forwardedBodyHtml(message) {
  const bodyText = forwardedBodyText(message)
  if (!message?.bodyHtml) return plainTextToHtml(bodyText)

  const sanitizedHtml = sanitizeComposerHtml(message.bodyHtml)
  const preview = document.createElement('div')
  preview.innerHTML = sanitizedHtml
  const visibleText = (preview.textContent || '').replace(/\u00a0/g, ' ').trim()
  if (visibleText || preview.querySelector('img')) return sanitizedHtml

  return plainTextToHtml(bodyText)
}

function buildForwardDraft(message) {
  if (!message) return { body: '', html: '' }
  const date = formatForwardDate(message)
  const headers = [
    `From: ${message.sender} <${message.email}>`,
    `Date: ${date}`,
    `Subject: ${message.subject}`,
    ...(message.to?.length ? [`To: ${message.to.join(', ')}`] : []),
    ...(message.cc?.length ? [`Cc: ${message.cc.join(', ')}`] : []),
  ]
  const historyText = `\n\n---------- Forwarded message ---------\n${headers.join('\n')}\n\n${forwardedBodyText(message)}`
  const headerHtml = headers.map((header) => `<div>${plainTextToHtml(header)}</div>`).join('')
  const historyHtml = `<div class="forwardNote"><br></div><section class="forwardedMessagePreview" data-forwarded-content="true" contenteditable="false" aria-label="Original message included"><strong>Forwarded message</strong><div class="forwardedMessageHeaders">${headerHtml}</div><div class="forwardedMessageBody">${forwardedBodyHtml(message)}</div></section>`
  return { body: historyText, html: sanitizeComposerHtml(historyHtml) }
}

function prependForwardNote(noteDraft, forwardDraft) {
  if (!noteDraft?.body?.trim()) return forwardDraft
  return {
    body: `${noteDraft.body.trimEnd()}\n\n${forwardDraft.body.trimStart()}`,
    html: `${sanitizeComposerHtml(noteDraft.html || plainTextToHtml(noteDraft.body))}${forwardDraft.html}`,
  }
}

function quotedReplyText(message) {
  return forwardedBodyText(message).split('\n').map((line) => `> ${line}`).join('\n')
}

function quotedReplyHtml(message) {
  const bodyText = forwardedBodyText(message)
  if (bodyText.trim()) return plainTextToHtml(bodyText)
  return forwardedBodyHtml(message)
}

function replyQuoteHeaderText(message) {
  return `On ${formatForwardDate(message)}, ${message?.sender || message?.email} <${message?.email || ''}> wrote:`
}

function buildReplyDraft(message) {
  if (!message) return { body: '', html: '' }
  const headerText = replyQuoteHeaderText(message)
  const historyText = `\n\n${headerText}\n${quotedReplyText(message)}`
  const historyHtml = `<div class="replyNote"><br></div><blockquote class="quotedMessagePreview" data-quoted-content="true" contenteditable="false" aria-label="Original message included"><div class="quotedMessageHeader">${plainTextToHtml(headerText)}</div><div class="quotedMessageBody">${quotedReplyHtml(message)}</div></blockquote>`
  return { body: historyText, html: sanitizeComposerHtml(historyHtml) }
}

function prependReplyNote(noteBody, replyDraft) {
  const noteText = typeof noteBody === 'string' ? noteBody : noteBody?.body || ''
  const noteHtml = typeof noteBody === 'string'
    ? plainTextToHtml(noteBody)
    : sanitizeComposerHtml(noteBody?.html || plainTextToHtml(noteText))
  if (!replyDraft.body) return { body: noteText, html: noteHtml }
  if (!noteText.trim()) return replyDraft
  return {
    body: `${noteText.trimEnd()}\n\n${replyDraft.body.trimStart()}`,
    html: `${noteHtml}${replyDraft.html}`,
  }
}

function extractSavedReplyNote(draft) {
  if (!draft) return null
  const historyStart = draft.body.search(/(?:^|\n)On .+ wrote:\s*(?:\n|$)/)
  const body = historyStart >= 0 ? draft.body.slice(0, historyStart).trimEnd() : draft.body
  const parsedDocument = new DOMParser().parseFromString(draft.html || '', 'text/html')
  const root = parsedDocument.createElement('div')
  root.innerHTML = parsedDocument.body.innerHTML
  root.querySelectorAll('[data-quoted-content="true"], .replyNote').forEach((element) => element.remove())
  return { ...draft, body, html: sanitizeComposerHtml(root.innerHTML) }
}

export function ComposeModal({ colorTheme = 'default', mailboxEmail = '', mode = 'new', messageId, initialTo = '', initialSubject = '', initialBody = '', forwardedMessage = null, repliedMessage = null, onClose, onSent }) {
  const isReplyMode = mode === 'reply' || mode === 'reply-all'
  const forwardDraft = mode === 'forward' ? buildForwardDraft(forwardedMessage) : { body: '', html: '' }
  const replyDraft = isReplyMode ? prependReplyNote(initialBody, buildReplyDraft(repliedMessage)) : { body: '', html: '' }
  const initialDraft = { to: initialTo, cc: '', bcc: '', subject: initialSubject, body: forwardDraft.body || replyDraft.body || initialBody, html: forwardDraft.html || replyDraft.html || plainTextToHtml(initialBody) }
  const savedDraft = initialBody ? null : loadComposeDraft(mailboxEmail, mode, messageId)
  const legacyForwardDraft = savedDraft && mode === 'forward' && forwardedMessage && !savedDraft.body.includes('---------- Forwarded message ---------')
  const savedReplyNote = savedDraft && isReplyMode ? extractSavedReplyNote(savedDraft) : null
  const refreshedSavedReply = savedReplyNote && repliedMessage
    ? { ...savedDraft, ...prependReplyNote(savedReplyNote, buildReplyDraft(repliedMessage)) }
    : null
  const restoredDraft = legacyForwardDraft
    ? {
        ...savedDraft,
        ...prependForwardNote(savedDraft, forwardDraft),
      }
    : (refreshedSavedReply || savedDraft)
  const [draft, setDraft] = useState(restoredDraft || initialDraft)
  const [showCc, setShowCc] = useState(Boolean(restoredDraft?.cc))
  const [showBcc, setShowBcc] = useState(Boolean(restoredDraft?.bcc))
  const [sending, setSending] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [saveStatus, setSaveStatus] = useState(restoredDraft ? 'Draft restored' : '')
  const [windowState, setWindowState] = useState('normal')
  const [attachments, setAttachments] = useState([])
  const draftRef = useRef(draft)
  const editorDirtyRef = useRef(false)
  const saveTimerRef = useRef(null)
  const sentRef = useRef(false)
  const editorRef = useRef(null)
  const attachmentInputRef = useRef(null)
  const config = modeConfig[mode] ?? modeConfig.new

  draftRef.current = draft

  useLayoutEffect(() => {
    if (editorRef.current) editorRef.current.innerHTML = sanitizeComposerHtml(draftRef.current.html || plainTextToHtml(draftRef.current.body))
  }, [])

  useEffect(() => () => {
    window.clearTimeout(saveTimerRef.current)
    if (!sentRef.current) saveComposeDraft(mailboxEmail, mode, messageId, draftRef.current)
  }, [mailboxEmail, messageId, mode])

  useEffect(() => {
    if ((mode !== 'forward' && !isReplyMode) || !messageId) return undefined
    let active = true
    mailService.getMessage(messageId)
      .then((message) => {
        if (!active || editorDirtyRef.current || (restoredDraft && !legacyForwardDraft && !savedReplyNote) || !message) return
        if (isReplyMode) {
          const replyNote = savedReplyNote || initialBody
          const nextReplyDraft = prependReplyNote(replyNote, buildReplyDraft(message))
          if (!nextReplyDraft.body) return
          const nextDraft = { ...draftRef.current, body: nextReplyDraft.body, html: nextReplyDraft.html }
          draftRef.current = nextDraft
          setDraft(nextDraft)
          if (editorRef.current) editorRef.current.innerHTML = nextReplyDraft.html
          return
        }
        const nextForwardDraft = legacyForwardDraft ? prependForwardNote(savedDraft, buildForwardDraft(message)) : buildForwardDraft(message)
        const nextDraft = { ...draftRef.current, body: nextForwardDraft.body, html: nextForwardDraft.html }
        draftRef.current = nextDraft
        setDraft(nextDraft)
        if (editorRef.current) editorRef.current.innerHTML = nextForwardDraft.html
      })
      .catch(() => {
        // Keep the message data already loaded in the inbox when detail loading fails.
      })
    return () => {
      active = false
    }
  }, [messageId, mode])

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

  function closeAsDraft() {
    window.clearTimeout(saveTimerRef.current)
    if (!sentRef.current) saveComposeDraft(mailboxEmail, mode, messageId, draftRef.current)
    onClose()
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
    editorDirtyRef.current = true
    const body = editorRef.current.innerText.replace(/\u00a0/g, ' ')
    if (!body.trim()) editorRef.current.innerHTML = ''
    const nextDraft = { ...draftRef.current, body, html: body.trim() ? sanitizeComposerHtml(editorRef.current.innerHTML) : '' }
    draftRef.current = nextDraft
    setDraft(nextDraft)
    queueDraftSave(nextDraft)
    setError('')
  }

  function pastePlainText(event) {
    const text = event.clipboardData?.getData('text/plain')
    if (!text) return
    event.preventDefault()
    document.execCommand('insertText', false, text)
    updateBodyFromEditor()
  }

  function addAttachments(event) {
    const selected = Array.from(event.target.files || [])
    event.target.value = ''
    if (!selected.length) return

    const availableSlots = Math.max(MAX_ATTACHMENT_COUNT - attachments.length, 0)
    const candidates = selected.slice(0, availableSlots)
    let totalSize = attachments.reduce((sum, item) => sum + item.file.size, 0)
    const accepted = []
    for (const file of candidates) {
      if (totalSize + file.size > MAX_ATTACHMENT_BYTES) continue
      totalSize += file.size
      accepted.push({ id: `${file.name}:${file.size}:${file.lastModified}:${crypto.randomUUID()}`, file })
    }
    setError(accepted.length === selected.length ? '' : 'You can attach up to 10 files with a combined size of 15 MB.')
    setAttachments([...attachments, ...accepted])
  }

  function removeAttachment(id) {
    setAttachments((current) => current.filter((attachment) => attachment.id !== id))
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
      const serializedAttachments = await Promise.all(attachments.map(({ file }) => serializeAttachment(file)))
      if (mode === 'reply') await mailService.replyToMessage(messageId, draft.body, draft.html, serializedAttachments)
      else if (mode === 'reply-all') await mailService.replyAllMessage(messageId, draft.body, draft.html, serializedAttachments)
      else if (mode === 'forward') await mailService.forwardMessage(messageId, { to: draft.to, cc: draft.cc, bcc: draft.bcc, body: draft.body, html: draft.html, forwardedContentIncluded: draft.body.includes('---------- Forwarded message ---------'), attachments: serializedAttachments })
      else await mailService.sendMessage({ ...draft, attachments: serializedAttachments })
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
    <div
      className={`overlay composeOverlay is-${windowState}`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && windowState !== 'minimized') closeAsDraft()
      }}
    >
      <form className={`modal composeModal compose-${colorTheme === 'light' ? 'light' : 'dark'} is-${windowState}`} onSubmit={submit} role="dialog" aria-modal={windowState !== 'minimized'} aria-labelledby="compose-title">
        <div className="composeTitlebar">
          <div className="composeWindowControls">
            {windowState === 'minimized' ? (
              <button className="windowControl close" type="button" aria-label="Close composer" onClick={closeAsDraft}><X size={9} /></button>
            ) : (
              <>
                <button className="windowControl close" type="button" aria-label="Close composer" onClick={closeAsDraft}><X size={9} /></button>
                <button className="windowControl minimize" type="button" aria-label="Minimize composer" onClick={() => setWindowState('minimized')}><Minus size={9} /></button>
                <button className="windowControl maximize" type="button" aria-label={windowState === 'maximized' ? 'Reduce composer' : 'Maximize composer'} onClick={() => setWindowState((current) => current === 'maximized' ? 'normal' : 'maximized')}><Maximize2 size={8} /></button>
              </>
            )}
          </div>
          {windowState === 'minimized' ? (
            <>
            <button className="composeRestore" type="button" aria-label="Restore composer" onClick={() => setWindowState('normal')}>
              <Maximize2 size={14} />
              <span><b>{config.title}</b><small>{saveStatus || 'Draft saved'} · Click to reopen</small></span>
            </button>
            <span id="compose-title" className="composeAccessibleTitle">{config.title}</span>
            </>
          ) : <b id="compose-title">{config.title}</b>}
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
        <div ref={editorRef} className="composeEditor" contentEditable role="textbox" aria-label="Message body" aria-multiline="true" data-placeholder={mode === 'forward' ? 'Add a note…' : 'Write something brilliant…'} onInput={updateBodyFromEditor} onPaste={pastePlainText} />
        {attachments.length ? <div className="composeAttachments" aria-label="Selected attachments">
          {attachments.map(({ id, file }) => <div className="composeAttachment" key={id}>
            <FileText size={15} />
            <span><b>{file.name}</b><small>{formatFileSize(file.size)}</small></span>
            <button type="button" aria-label={`Remove ${file.name}`} title={`Remove ${file.name}`} onClick={() => removeAttachment(id)}><X size={13} /></button>
          </div>)}
        </div> : null}
        <RichTextToolbar editorRef={editorRef} onChange={updateBodyFromEditor} defaultTextColor={colorTheme === 'light' ? '#1f2937' : '#edf5ff'} />
        {error ? <p className="formError" role="alert">{error}</p> : null}
        <div className="composeActions">
          <button className="sendAi" type="submit" disabled={sending}><Send size={15} />{sending ? 'Sending…' : 'Send'}</button>
          <input ref={attachmentInputRef} className="attachmentInput" type="file" multiple aria-label="File attachments" onChange={addAttachments} />
          <button className="icon" type="button" aria-label="Attach files" title="Attach files" onClick={() => attachmentInputRef.current?.click()}><Paperclip size={16} /></button>
          {saveStatus ? <span className={`composeSaveStatus ${saveStatus === 'Draft not saved' ? 'error' : ''}`} role="status">{saveStatus}</span> : null}
          <button className="aiCompose" type="button" onClick={writeWithOlivia} disabled={generating}><Sparkles size={14} />{generating ? 'Writing…' : 'Write with Olivia'}</button>
        </div>
      </form>
    </div>
  )
}
