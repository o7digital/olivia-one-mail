import { BrainCircuit, BriefcaseBusiness, CalendarClock, CheckSquare2, Link2, Mail, Settings2, UsersRound } from 'lucide-react'
import { useState } from 'react'
import { Avatar } from '../common/Avatar'
import { InsightCard } from './InsightCard'
import { intelligenceService } from '../../services/intelligenceService'
import { taskService } from '../../services/taskService'

const tabs = ['Overview', 'Insights', 'Context']

export function AIWorkspace({ analysis, error, message, onArchive, onCreateOpportunity, onReply, onReplyAll, onNotify, onRetry, status }) {
  const [activeTab, setActiveTab] = useState('Overview')
  const [pendingAction, setPendingAction] = useState('')

  if (!message) return null
  if (status === 'error') return <aside className="ai card" aria-label="AI Workspace"><div className="aihead"><b><BrainCircuit size={18} />AI Workspace</b><Settings2 size={15} /></div><div className="aiTabContent"><BrainCircuit size={24} /><b>Olivia V3.5 could not analyze this email</b><p>{error?.message || 'The request failed safely. You can retry without duplicating the jobs.'}</p><button className="textbtn" type="button" onClick={onRetry}>Retry analysis</button></div></aside>
  if (!analysis && status !== 'loading') return null

  async function runAction(action) {
    if (analysis?.sandbox) return onNotify('Sandbox: no action was executed')
    setPendingAction(action.type)
    try {
      if (action.type === 'reply') onReply()
      else if (action.type === 'reply_all') onReplyAll()
      else if (action.type === 'archive') await onArchive()
      else if (action.type === 'create_opportunity') onCreateOpportunity()
      else if (action.type === 'create_task') {
        await taskService.create({ title: action.label, dueAt: null, priority: analysis.urgency === 'High' || analysis.urgency === 'Critical' ? 'high' : 'normal', sourceMessageId: message.id })
        onNotify('Task created')
      } else if (action.type === 'mark_waiting' || action.type === 'follow_up' || action.type === 'add_reminder') {
        await intelligenceService.createFollowUp({ messageId: message.id, threadId: null, contactName: message.sender, contactEmail: message.email, subject: message.subject, note: action.label, followUpAt: new Date(Date.now() + 3 * 86400000).toISOString() })
        onNotify('Conversation added to Waiting')
      } else if (action.type === 'create_event') onNotify('Calendar provider is unavailable; no event was created')
      else onNotify('This action needs a connected provider')
    } catch (error) { onNotify(error.message || 'Action could not be completed') } finally { setPendingAction('') }
  }

  return (
    <aside className="ai card" aria-label="AI Workspace">
      <div className="aihead"><b><BrainCircuit size={18} />AI Workspace</b><Settings2 size={15} /></div>
      <div className="aitabs" role="tablist">
        {tabs.map((tab) => <button type="button" role="tab" aria-selected={activeTab === tab} className={activeTab === tab ? 'active' : ''} key={tab} onClick={() => setActiveTab(tab)}>{tab}</button>)}
      </div>

      {activeTab === 'Overview' && status === 'loading' ? (
        <div className="aiTabContent"><BrainCircuit size={24} /><b>Analyzing conversation</b><p>Olivia is preparing summary, tasks, and opportunity signals.</p></div>
      ) : null}

      {activeTab === 'Overview' && analysis ? (
        <>
          {analysis.engine === 'v3' ? <InsightCard title="Olivia V3.5"><p>Live intelligence · generated drafts require your review and an explicit Send action.</p><small>{[analysis.provider, analysis.model].filter(Boolean).join(' · ')}</small></InsightCard> : null}
          <InsightCard title="Email Summary">{analysis.summary.map((line) => <p key={line}>{line}</p>)}</InsightCard>
          {analysis.classification ? <InsightCard title="Analysis / Classification"><p>{analysis.classification.category}</p><small>{Math.round(analysis.classification.confidence * 100)}% confidence</small></InsightCard> : null}
          {analysis.messageType === 'delivery_failure' && analysis.deliveryFailure ? <InsightCard title="Delivery Failure"><div className="contextDetails"><b>{analysis.deliveryFailure.recipient || 'Recipient unavailable'}</b><span>{[analysis.deliveryFailure.smtpStatus, analysis.deliveryFailure.enhancedStatusCode].filter(Boolean).join(' · ') || 'SMTP status unavailable'}</span><p>{analysis.deliveryFailure.reason || analysis.deliveryFailure.likelyCause || 'No delivery reason was returned.'}</p><small>{analysis.deliveryFailure.remoteServer || 'Remote server unavailable'} · {analysis.deliveryFailure.responsibility}</small></div></InsightCard> : null}
          {analysis.messageType === 'invoice_payment' && analysis.invoice ? <InsightCard title="Invoice Details"><div className="contextDetails"><b>{analysis.invoice.amount != null && analysis.invoice.currency ? new Intl.NumberFormat(undefined, { style: 'currency', currency: analysis.invoice.currency }).format(analysis.invoice.amount) : 'Amount unavailable'}</b><span>{analysis.invoice.invoiceNumber || 'Invoice number unavailable'}</span><p>{analysis.invoice.dueDate ? `Due ${analysis.invoice.dueDate}` : 'Due date unavailable'}</p></div></InsightCard> : null}
          {analysis.messageType === 'meeting_scheduling' && analysis.scheduling ? <InsightCard title="Scheduling"><div className="contextDetails"><b>{analysis.scheduling.proposedPeriods.join(' · ') || 'No exact period extracted'}</b><span>{analysis.scheduling.timezone || 'Timezone unavailable'}</span>{analysis.scheduling.availableSlots.map((slot) => <button className="textbtn" type="button" key={slot.startAt}>{new Date(slot.startAt).toLocaleString()}</button>)}</div></InsightCard> : null}
          {!['delivery_failure', 'invoice_payment'].includes(analysis.messageType) ? <div className="twocol">
            <InsightCard title="Lead Score"><div className="score">{analysis.leadScore == null ? 'Unavailable' : Math.round(analysis.leadScore)}</div><small className="good">{analysis.sentiment.label} · {analysis.sentiment.confidence == null ? '—' : `${Math.round(analysis.sentiment.confidence * 100)}%`}</small></InsightCard>
            <InsightCard title="Urgency"><div className="urgency">{analysis.urgency ?? 'Unavailable in V3 sandbox'}</div><small>{analysis.intent}</small></InsightCard>
          </div> : null}
          <InsightCard title="Recommended Actions"><div className="recommendedActions">{analysis.recommendedActions.length ? analysis.recommendedActions.map((action) => <button type="button" disabled={Boolean(pendingAction)} key={`${action.type}:${action.label}`} onClick={() => runAction(action)}>{action.type === 'create_task' ? <CheckSquare2 size={14} /> : action.type.includes('waiting') || action.type.includes('follow') ? <CalendarClock size={14} /> : <Mail size={14} />}{pendingAction === action.type ? 'Working…' : action.label}<small>{Math.round(action.confidence * 100)}%</small></button>) : <p>No reliable action was returned for this message.</p>}</div></InsightCard>
          {analysis.extractedActions ? <InsightCard title="Extracted Actions (review only)">{analysis.extractedActions.length ? analysis.extractedActions.map((action, index) => <p key={index}>{action.description}</p>) : <p>No explicit action found.</p>}</InsightCard> : null}
          <InsightCard title="Extracted Tasks">
            {analysis.tasks.map((task) => <button className="task" type="button" key={task.title} onClick={() => runAction({ type: 'create_task', label: task.title })}><span /><b>{task.title}</b><small>{task.dueAt || 'No due date'}</small></button>)}
          </InsightCard>
          {!analysis.sandbox ? <><InsightCard title="Business Opportunity">
            <div className="opp"><div><b>{analysis.opportunity.title || 'No active opportunity detected'}</b><small>Estimated value</small></div><em>{Math.round(analysis.opportunity.confidence * 100)}%</em></div>
            <div className="money">{analysis.opportunity.estimatedValue && analysis.opportunity.currency ? new Intl.NumberFormat('en-US', { style: 'currency', currency: analysis.opportunity.currency }).format(analysis.opportunity.estimatedValue) : 'Not estimated'}</div><div className="spark" aria-label="Opportunity trend"><i /><i /><i /><i /><i /><i /><i /></div>
          </InsightCard>
          <InsightCard title="Contact Insights">
            <div className="contact"><Avatar initials={message.initials} tone={message.tone} small /><div><b>{message.sender}</b><small>{message.role}</small><small>{message.company}</small></div><div><Mail size={14} /><Link2 size={14} /><UsersRound size={14} /></div></div>
            <p>{analysis.contactInsights.summary}</p><small className="engage">● {analysis.contactInsights.engagement}</small>
          </InsightCard>
          </> : null}
          {analysis.opportunity.detected ? <div className="pulse"><div><b>Convert to Opportunity in O7 Pulse</b><p>Review and explicitly confirm the real CRM action.</p><button type="button" onClick={onCreateOpportunity}><BriefcaseBusiness size={15} />Review Opportunity</button></div><strong>O7</strong></div> : null}
        </>
      ) : null}

      {activeTab === 'Insights' ? (
        <div className="aiTabContent"><BrainCircuit size={24} /><b>Conversation intelligence</b><p>{analysis?.buyingSignals?.[0] || 'No strong buying signal detected.'}</p><div className="signal"><span>Sentiment</span><strong>{analysis?.sentiment.label} · {analysis?.sentiment.confidence == null ? '—' : `${Math.round(analysis.sentiment.confidence * 100)}%`}</strong></div><div className="signal"><span>Buying signals</span><strong>{analysis?.buyingSignals?.join(' · ') || 'None'}</strong></div></div>
      ) : null}

      {activeTab === 'Context' ? (
        <div className="aiTabContent"><UsersRound size={24} /><b>Relationship context</b><p>{analysis?.contactInsights.summary || 'No verified relationship context is available.'}</p>{message.company ? <div className="contextChip">{message.company}</div> : null}<div className="contextChip">{analysis?.contactInsights.engagement || 'Engagement unavailable'}</div>{analysis?.sources?.length ? <><b>Sources / memory used</b>{analysis.sources.map((source) => <div className="contextChip" key={`${source.kind}:${source.source}:${source.document_id ?? ''}`}>{source.kind === 'memory' ? 'Memory' : 'Source'} · {source.source}</div>)}</> : <small>No tenant memory source was used for this result.</small>}</div>
      ) : null}
    </aside>
  )
}
