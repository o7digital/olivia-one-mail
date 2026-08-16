import { BrainCircuit, BriefcaseBusiness, Link2, Mail, Settings2, UsersRound } from 'lucide-react'
import { useMemo, useState } from 'react'
import { aiByMessage } from '../../mocks/mail'
import { Avatar } from '../common/Avatar'
import { InsightCard } from './InsightCard'

const tabs = ['Overview', 'Insights', 'Context']

export function AIWorkspace({ message, onCreateOpportunity, onNotify }) {
  const [activeTab, setActiveTab] = useState('Overview')
  const [completedTasks, setCompletedTasks] = useState([])
  const [customTasks, setCustomTasks] = useState([])
  const analysis = useMemo(() => aiByMessage[message?.id] ?? aiByMessage.default, [message?.id])

  if (!message) return null

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

      {activeTab === 'Overview' ? (
        <>
          <InsightCard title="Email Summary">{analysis.summary.map((line) => <p key={line}>{line}</p>)}</InsightCard>
          <div className="twocol">
            <InsightCard title="Lead Score"><div className="score">{analysis.leadScore}</div><small className="good">High</small></InsightCard>
            <InsightCard title="Urgency"><div className="urgency">{analysis.urgency}</div><small>Respond within 24h</small></InsightCard>
          </div>
          <InsightCard title="Extracted Tasks">
            {[...analysis.tasks, ...customTasks].map((task, index) => (
              <button className={`task ${completedTasks.includes(task) ? 'complete' : ''}`} type="button" key={task} onClick={() => toggleTask(task)}>
                <span /><b>{task}</b><small>May {16 + index}</small>
              </button>
            ))}
            <button className="textbtn" type="button" onClick={addTask}>+ Add task</button>
          </InsightCard>
          <InsightCard title="Business Opportunity">
            <div className="opp"><div><b>{analysis.opportunity.title}</b><small>Estimated value</small></div><em>{analysis.opportunity.confidence}</em></div>
            <div className="money">{analysis.opportunity.value}</div><div className="spark" aria-label="Opportunity trend"><i /><i /><i /><i /><i /><i /><i /></div>
          </InsightCard>
          <InsightCard title="Contact Insights">
            <div className="contact"><Avatar initials={message.initials} tone={message.tone} small /><div><b>{message.sender}</b><small>{message.role}</small><small>{message.company}</small></div><div><Mail size={14} /><Link2 size={14} /><UsersRound size={14} /></div></div>
            <small className="engage">● Strong engagement in the last 30 days</small>
          </InsightCard>
          <div className="pulse"><div><b>Convert to Opportunity in O7 Pulse</b><p>Create a new opportunity and sync this conversation.</p><button type="button" onClick={onCreateOpportunity}><BriefcaseBusiness size={15} />Create Opportunity</button></div><strong>O7</strong></div>
        </>
      ) : null}

      {activeTab === 'Insights' ? (
        <div className="aiTabContent"><BrainCircuit size={24} /><b>Conversation intelligence</b><p>Positive intent is rising. Commercial terms, timing, and a decision-maker are all present in this thread.</p><div className="signal"><span>Sentiment</span><strong>Positive · 91%</strong></div><div className="signal"><span>Buying signal</span><strong>Strong</strong></div></div>
      ) : null}

      {activeTab === 'Context' ? (
        <div className="aiTabContent"><UsersRound size={24} /><b>Relationship context</b><p>{message.sender} has exchanged 18 messages with O7 in the last 90 days.</p><div className="contextChip">{message.company}</div><div className="contextChip">Active opportunity</div><div className="contextChip">Last contact: today</div></div>
      ) : null}
    </aside>
  )
}
