import { Forward, Reply, ReplyAll, Send, Sparkles } from 'lucide-react'
import { useState } from 'react'

export function SuggestedReply({ message, onSent }) {
  const [activeMode, setActiveMode] = useState('AI Suggested Reply')
  const [sending, setSending] = useState(false)
  const firstName = message.sender.split(' ')[0]

  const modes = [
    ['AI Suggested Reply', Sparkles], ['Reply', Reply], ['Reply All', ReplyAll], ['Forward', Forward],
  ]

  async function sendReply() {
    setSending(true)
    await new Promise((resolve) => window.setTimeout(resolve, 450))
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
        <p>Hi {firstName},</p>
        <p>Thank you for sharing the proposal and materials. I’ve reviewed them and everything looks great.</p>
        <p>I’d be happy to schedule a call this week to discuss next steps. Please share your availability.</p>
        <p>Best regards,<br />Olivier</p>
      </div>
      <button className="sendAi" type="button" onClick={sendReply} disabled={sending}><Send size={15} />{sending ? 'Sending…' : 'Send suggested reply'}</button>
    </div>
  )
}
