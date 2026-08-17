import { Forward, Reply, ReplyAll, Send, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { aiService } from '../../services/aiService'
import { mailService } from '../../services/mailService'

export function SuggestedReply({ message, onSent, suggestedReply }) {
  const [activeMode, setActiveMode] = useState('AI Suggested Reply')
  const [sending, setSending] = useState(false)
  const [rewriting, setRewriting] = useState(false)
  const [draft, setDraft] = useState(suggestedReply)

  const modes = [
    ['AI Suggested Reply', Sparkles], ['Reply', Reply], ['Reply All', ReplyAll], ['Forward', Forward],
  ]

  useEffect(() => {
    setDraft(suggestedReply)
  }, [suggestedReply])

  async function sendReply() {
    setSending(true)
    await mailService.replyToMessage(message.id, draft)
    setSending(false)
    onSent('Suggested reply sent')
  }

  async function rewrite(action) {
    setRewriting(true)
    try {
      const response = await aiService.rewriteDraft({
        action,
        draft,
        recipient: message.email,
        subject: message.subject,
      })
      setDraft(response.draft)
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
          ['improve', 'Regenerate'],
          ['shorter', 'Shorter'],
          ['formal', 'More formal'],
          ['friendly', 'More friendly'],
          ['translate-fr', 'FR'],
          ['translate-es', 'ES'],
          ['translate-en', 'EN'],
        ].map(([action, label]) => (
          <button key={action} className="icon" type="button" onClick={() => rewrite(action)} disabled={rewriting}>
            {label}
          </button>
        ))}
      </div>
      <textarea className="draft" aria-label="Reply draft" value={draft} onChange={(event) => setDraft(event.target.value)} />
      <button className="sendAi" type="button" onClick={sendReply} disabled={sending || rewriting}><Send size={15} />{sending ? 'Sending…' : rewriting ? 'Rewriting…' : 'Send suggested reply'}</button>
    </div>
  )
}
