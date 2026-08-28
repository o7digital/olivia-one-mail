import { Forward, Reply, ReplyAll, Send, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { aiService } from '../../services/aiService'
import { mailService } from '../../services/mailService'

export function SuggestedReply({ aiStatus, message, onSent, suggestedReply }) {
  const [activeMode, setActiveMode] = useState('AI Suggested Reply')
  const [sending, setSending] = useState(false)
  const [rewriting, setRewriting] = useState(false)
  const [draft, setDraft] = useState(suggestedReply)
  const [error, setError] = useState('')

  const modes = [
    ['AI Suggested Reply', Sparkles], ['Reply', Reply], ['Reply All', ReplyAll], ['Forward', Forward],
  ]

  useEffect(() => {
    setDraft(suggestedReply)
  }, [suggestedReply])

  async function sendReply() {
    if (!draft.trim()) return
    setSending(true)
    setError('')
    try {
      if (activeMode === 'Reply All') await mailService.replyAllMessage(message.id, draft)
      else await mailService.replyToMessage(message.id, draft)
      onSent(activeMode === 'Reply All' ? 'Reply sent to all recipients' : 'Suggested reply sent')
    } catch (sendError) {
      setError(sendError.message)
    } finally {
      setSending(false)
    }
  }

  async function rewrite(action) {
    if (!draft.trim()) return
    setRewriting(true)
    setError('')
    try {
      const response = await aiService.rewriteDraft({
        action,
        draft,
        recipient: message.email,
        subject: message.subject,
      })
      setDraft(response.draft)
    } catch (rewriteError) {
      setError(rewriteError.message)
    } finally {
      setRewriting(false)
    }
  }

  return (
    <div className="replybox">
      <div className="replytabs" role="tablist">
        {modes.map(([mode, Icon]) => (
          <button type="button" role="tab" aria-selected={activeMode === mode} className={activeMode === mode ? 'active' : ''} key={mode} onClick={() => setActiveMode(mode)}>
            <Icon size={14} />{mode}
          </button>
        ))}
      </div>
      <div className="composeActions">
        {[
          ['formal', 'Professional'],
          ['shorter', 'Shorter'],
          ['friendly', 'Friendlier'],
          ['improve', 'Clearer'],
          ['translate-fr', 'FR'],
          ['translate-es', 'ES'],
          ['translate-en', 'EN'],
        ].map(([action, label]) => (
          <button key={action} className="icon" type="button" onClick={() => rewrite(action)} disabled={rewriting || !draft.trim()}>
            {label}
          </button>
        ))}
      </div>
      <textarea className="draft" aria-label="Reply draft" placeholder={aiStatus === 'error' ? 'Olivia AI is temporarily unavailable.' : 'Olivia is preparing a suggested reply…'} value={draft} onChange={(event) => setDraft(event.target.value)} />
      {error ? <p className="formError" role="alert">{error}</p> : null}
      <button className="sendAi" type="button" onClick={sendReply} disabled={sending || rewriting || !draft.trim() || activeMode === 'Forward'}>
        <Send size={15} />{activeMode === 'Forward' ? 'Use the Forward button above' : sending ? 'Sending…' : rewriting ? 'Rewriting…' : 'Send suggested reply'}
      </button>
    </div>
  )
}
