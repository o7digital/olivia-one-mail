import { BrainCircuit, BriefcaseBusiness, Link2, Mail, Settings2, UsersRound } from 'lucide-react'
import { useState } from 'react'
import { Avatar } from '../common/Avatar'
import { InsightCard } from './InsightCard'

const tabs = ['Overview', 'Insights', 'Context']

export function AIWorkspace({ analysis, message, onCreateOpportunity, onNotify, status }) {
  const [activeTab, setActiveTab] = useState('Overview')
  const [completedTasks, setCompletedTasks] = useState([])
  const [customTasks, setCustomTasks] = useState([])

  if (!message) return null
  if (status === 'error') return <aside className="ai card" aria-label="AI Workspace"><div className="aihead"><b><BrainCircuit size={18} />AI Workspace</b><Settings2 size={15} /></div><div className="aiTabContent"><BrainCircuit size={24} /><b>Olivia AI temporarily unavailable</b><p>The gateway could not reach the internal Olivia AI service.</p></div></aside>
  if (!analysis && status !== 'loading') return null

  function toggleTask(task) {
    setCompletedTasks((current) => current.includes(task) ? current.filter((item) => item !== task) : [...current, task])
  }

  function addTask() {
    const nextIndex = customTasks.length + 1
    setCustomTasks((current) => [...current, `Follow-up task ${nextIndex}`])
    onNotify('Mock task added')
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
          <InsightCard title="Email Summary">{analysis.summary.map((line) => <p key={line}>{line}</p>)}</InsightCard>
          <div className="twocol">
            <InsightCard title="Lead Score"><div className="score">{Math.round(analysis.leadScore)}</div><small className="good">{analysis.sentiment.label} · {Math.round(analysis.sentiment.confidence * 100)}%</small></InsightCard>
            <InsightCard title="Urgency"><div className="urgency">{analysis.urgency}</div><small>{analysis.intent}</small></InsightCard>
          </div>
          <InsightCard title="Extracted Tasks">
            {[...analysis.tasks.map((task) => task.title), ...customTasks].map((task) => (
              <button className={`task ${completedTasks.includes(task) ? 'complete' : ''}`} type="button" key={task} onClick={() => toggleTask(task)}>
                <span /><b>{task}</b><small>Follow-up</small>
              </button>
            ))}
            <button className="textbtn" type="button" onClick={addTask}>+ Add task</button>
          </InsightCard>
          <InsightCard title="Business Opportunity">
            <div className="opp"><div><b>{analysis.opportunity.title || 'No active opportunity detected'}</b><small>Estimated value</small></div><em>{Math.round(analysis.opportunity.confidence * 100)}%</em></div>
            <div className="money">{analysis.opportunity.estimatedValue && analysis.opportunity.currency ? new Intl.NumberFormat('en-US', { style: 'currency', currency: analysis.opportunity.currency }).format(analysis.opportunity.estimatedValue) : 'Not estimated'}</div><div className="spark" aria-label="Opportunity trend"><i /><i /><i /><i /><i /><i /><i /></div>
          </InsightCard>
          <InsightCard title="Contact Insights">
            <div className="contact"><Avatar initials={message.initials} tone={message.tone} small /><div><b>{message.sender}</b><small>{message.role}</small><small>{message.company}</small></div><div><Mail size={14} /><Link2 size={14} /><UsersRound size={14} /></div></div>
            <p>{analysis.contactInsights.summary}</p><small className="engage">● {analysis.contactInsights.engagement}</small>
          </InsightCard>
          <div className="pulse"><div><b>Convert to Opportunity in O7 Pulse</b><p>Create a new opportunity and sync this conversation.</p><button type="button" onClick={onCreateOpportunity}><BriefcaseBusiness size={15} />Create Opportunity</button></div><strong>O7</strong></div>
        </>
      ) : null}

      {activeTab === 'Insights' ? (
        <div className="aiTabContent"><BrainCircuit size={24} /><b>Conversation intelligence</b><p>{analysis?.buyingSignals?.[0] || 'No strong buying signal detected.'}</p><div className="signal"><span>Sentiment</span><strong>{analysis?.sentiment.label} · {Math.round((analysis?.sentiment.confidence || 0) * 100)}%</strong></div><div className="signal"><span>Buying signals</span><strong>{analysis?.buyingSignals?.join(' · ') || 'None'}</strong></div></div>
      ) : null}

      {activeTab === 'Context' ? (
        <div className="aiTabContent"><UsersRound size={24} /><b>Relationship context</b><p>{message.sender} has exchanged 18 messages with O7 in the last 90 days.</p><div className="contextChip">{message.company}</div><div className="contextChip">Active opportunity</div><div className="contextChip">Last contact: today</div></div>
      ) : null}
    </aside>
  )
}
