import { Forward, Reply, ReplyAll, Send, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { mailService } from '../../services/mailService'

export function SuggestedReply({ message, onSent, suggestedReply }) {
  const [activeMode, setActiveMode] = useState('AI Suggested Reply')
  const [sending, setSending] = useState(false)

  const modes = [
    ['AI Suggested Reply', Sparkles], ['Reply', Reply], ['Reply All', ReplyAll], ['Forward', Forward],
  ]

  async function sendReply() {
    setSending(true)
    await mailService.replyToMessage(message.id, suggestedReply)
    setSending(false)
    onSent('Suggested reply sent')
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
      <div className="draft" contentEditable suppressContentEditableWarning aria-label="Reply draft">
        {suggestedReply.split('\n\n').map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
      </div>
      <button className="sendAi" type="button" onClick={sendReply} disabled={sending}><Send size={15} />{sending ? 'Sending…' : 'Send suggested reply'}</button>
    </div>
  )
}
