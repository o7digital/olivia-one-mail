import { Forward, RefreshCw, Reply, ReplyAll, Send, Sparkles, WandSparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { aiService } from '../../services/aiService'
import { mailService } from '../../services/mailService'

const MODES = [['AI draft', Sparkles], ['Reply', Reply], ['Reply all', ReplyAll], ['Forward', Forward]]
const TONES = [['formal', 'Professional'], ['shorter', 'Shorter'], ['friendly', 'Friendly'], ['improve', 'Clearer']]
const LANGUAGES = [['auto', 'Auto'], ['translate-fr', 'FR'], ['translate-es', 'ES'], ['translate-en', 'EN']]

export function SuggestedReply({ aiStatus, message, onSent, suggestedReply }) {
  const [activeMode, setActiveMode] = useState('AI draft')
  const [activeTone, setActiveTone] = useState('formal')
  const [activeLanguage, setActiveLanguage] = useState('auto')
  const [sending, setSending] = useState(false)
  const [rewriting, setRewriting] = useState(false)
  const [draft, setDraft] = useState(suggestedReply)
  const [error, setError] = useState('')

  useEffect(() => setDraft(suggestedReply), [suggestedReply])

  async function sendReply() {
    if (!draft.trim()) return
    setSending(true)
    setError('')
    try {
      if (activeMode === 'Reply all') await mailService.replyAllMessage(message.id, draft)
      else await mailService.replyToMessage(message.id, draft)
      onSent(activeMode === 'Reply all' ? 'Reply sent to all recipients' : 'Reply sent')
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
      const response = await aiService.rewriteDraft({ action, draft, recipient: message.email, subject: message.subject })
      setDraft(response.draft)
    } catch (rewriteError) {
      setError(rewriteError.message)
    } finally {
      setRewriting(false)
    }
  }

  const unavailable = aiStatus === 'error'

  return (
    <section className="replyComposer" aria-label="AI Suggested Reply">
      <header className="replyComposerHeader">
        <div className="replyComposerTitle"><span><Sparkles size={16} /></span><div><b>AI Suggested Reply</b><small>Review and edit before sending</small></div></div>
        <div className="replyModeSwitch" role="tablist" aria-label="Reply type">
          {MODES.map(([mode, Icon]) => (
            <button type="button" role="tab" aria-selected={activeMode === mode} className={activeMode === mode ? 'active' : ''} key={mode} onClick={() => setActiveMode(mode)}><Icon size={14} /><span>{mode}</span></button>
          ))}
        </div>
      </header>

      <div className="replyPreferences">
        <fieldset>
          <legend>Tone</legend>
          <div className="preferencePills">
            {TONES.map(([action, label]) => <button type="button" aria-pressed={activeTone === action} className={activeTone === action ? 'active' : ''} key={action} onClick={() => setActiveTone(action)}>{label}</button>)}
          </div>
        </fieldset>
        <fieldset>
          <legend>Language</legend>
          <div className="preferencePills languagePills">
            {LANGUAGES.map(([action, label]) => <button type="button" aria-pressed={activeLanguage === action} className={activeLanguage === action ? 'active' : ''} key={action} onClick={() => setActiveLanguage(action)}>{label}</button>)}
          </div>
        </fieldset>
      </div>

      <div className={`draftSurface ${unavailable ? 'hasError' : ''}`}>
        <textarea className="draft" aria-label="Reply draft" placeholder={unavailable ? 'Olivia AI is temporarily unavailable. You can still write your reply here.' : 'Olivia is preparing a suggested reply…'} value={draft} onChange={(event) => setDraft(event.target.value)} />
        <span className="draftStatus">Editable draft · Nothing sends automatically</span>
      </div>
      {error ? <p className="formError replyError" role="alert">{error}</p> : null}

      <footer className="replyComposerFooter">
        <div className="rewriteActions">
          <button type="button" onClick={() => rewrite('improve')} disabled={rewriting || !draft.trim()}><RefreshCw size={14} />Regenerate</button>
          <button type="button" className="rewritePrimary" onClick={() => rewrite(activeLanguage === 'auto' ? activeTone : activeLanguage)} disabled={rewriting || !draft.trim()}><WandSparkles size={14} />{rewriting ? 'Rewriting…' : 'Rewrite'}</button>
        </div>
        <button className="sendReply" type="button" onClick={sendReply} disabled={sending || rewriting || !draft.trim() || activeMode === 'Forward'}><Send size={15} />{activeMode === 'Forward' ? 'Use Forward above' : sending ? 'Sending…' : 'Send reply'}</button>
      </footer>
    </section>
  )
}
