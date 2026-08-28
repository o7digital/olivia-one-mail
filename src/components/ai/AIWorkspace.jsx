import { BrainCircuit, BriefcaseBusiness, CheckCircle2, ChevronDown, Circle, ContactRound, Lightbulb, ListTodo, Sparkles, Target, UsersRound } from 'lucide-react'
import { useState } from 'react'
import { Avatar } from '../common/Avatar'

function WorkspaceSection({ children, icon: Icon, title }) {
  return (
    <details className="workspaceSection">
      <summary><Icon size={15} /><span>{title}</span><ChevronDown size={14} /></summary>
      <div className="workspaceSectionBody">{children}</div>
    </details>
  )
}

export function AIWorkspace({ analysis, message, onCreateOpportunity, onNotify, status }) {
  const [completedTasks, setCompletedTasks] = useState([])
  if (!message) return null

  function toggleTask(task) {
    setCompletedTasks((current) => current.includes(task) ? current.filter((item) => item !== task) : [...current, task])
  }

  if (status === 'error') {
    return <aside className="ai aiWorkspace" aria-label="AI Workspace"><div className="aiWorkspaceHead"><span><Sparkles size={16} /></span><div><b>Olivia AI</b><small>Workspace</small></div></div><div className="aiUnavailable"><BrainCircuit size={22} /><b>AI temporarily unavailable</b><p>Your email remains fully available. Try again in a moment.</p></div></aside>
  }
  if (!analysis && status !== 'loading') return null
  if (status === 'loading') {
    return <aside className="ai aiWorkspace" aria-label="AI Workspace"><div className="aiWorkspaceHead"><span><Sparkles size={16} /></span><div><b>Olivia AI</b><small>Workspace</small></div></div><div className="aiLoading"><i /><i /><i /><small>Reading this conversation…</small></div></aside>
  }

  const tasks = analysis.tasks ?? []
  const money = analysis.opportunity.estimatedValue && analysis.opportunity.currency
    ? new Intl.NumberFormat('en-US', { style: 'currency', currency: analysis.opportunity.currency, maximumFractionDigits: 0 }).format(analysis.opportunity.estimatedValue)
    : 'Value not estimated'

  return (
    <aside className="ai aiWorkspace" aria-label="AI Workspace">
      <div className="aiWorkspaceHead"><span><Sparkles size={16} /></span><div><b>Olivia AI</b><small>Workspace</small></div></div>
      <section className="aiSummaryBlock"><div className="eyebrow"><BrainCircuit size={13} />AI Summary</div>{analysis.summary.map((line) => <p key={line}>{line}</p>)}</section>
      <section className="recommendedActions">
        <div className="eyebrow"><Lightbulb size={13} />Recommended actions</div>
        {tasks.slice(0, 2).map((task) => <button type="button" key={task.title} onClick={() => toggleTask(task.title)}>{completedTasks.includes(task.title) ? <CheckCircle2 size={15} /> : <Circle size={15} />}<span>{task.title}</span></button>)}
        {!tasks.length ? <p>No action required right now.</p> : null}
      </section>

      <div className="workspaceSections">
        <WorkspaceSection icon={Lightbulb} title="Insights">
          <dl className="insightList"><div><dt>Sentiment</dt><dd>{analysis.sentiment.label} · {Math.round(analysis.sentiment.confidence * 100)}%</dd></div><div><dt>Urgency</dt><dd>{analysis.urgency}</dd></div><div><dt>Intent</dt><dd>{analysis.intent}</dd></div></dl>
          {analysis.buyingSignals?.length ? <p>{analysis.buyingSignals.join(' · ')}</p> : null}
        </WorkspaceSection>
        <WorkspaceSection icon={ListTodo} title={`Tasks${tasks.length ? ` · ${tasks.length}` : ''}`}>
          {tasks.map((task) => <button className={`workspaceTask ${completedTasks.includes(task.title) ? 'complete' : ''}`} type="button" key={task.title} onClick={() => toggleTask(task.title)}>{completedTasks.includes(task.title) ? <CheckCircle2 size={14} /> : <Circle size={14} />}<span>{task.title}</span></button>)}
          <button className="quietAction" type="button" onClick={() => onNotify('Task creation is coming soon')}>+ Add task</button>
        </WorkspaceSection>
        <WorkspaceSection icon={ContactRound} title="Contact">
          <div className="workspaceContact"><Avatar initials={message.initials} tone={message.tone} small /><div><b>{message.sender}</b><small>{message.role}</small><small>{message.company}</small></div></div><p>{analysis.contactInsights.summary}</p>
        </WorkspaceSection>
        <WorkspaceSection icon={Target} title="Opportunity">
          <div className="compactOpportunity"><div><b>{analysis.opportunity.title || 'No active opportunity'}</b><small>{money} · {Math.round(analysis.opportunity.confidence * 100)}% confidence</small></div><button type="button" onClick={onCreateOpportunity}><BriefcaseBusiness size={14} />Create in Pulse</button></div>
        </WorkspaceSection>
        <WorkspaceSection icon={UsersRound} title="Context"><p>{message.sender} represents {message.company}. Relationship context is kept secondary to this conversation.</p></WorkspaceSection>
      </div>
    </aside>
  )
}
