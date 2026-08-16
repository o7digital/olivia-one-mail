import { CalendarDays, CheckSquare2, ContactRound, Settings2, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { peopleService } from '../../services/peopleService'

const pageDetails = {
  calendar: { eyebrow: 'Schedule', title: 'Calendar', copy: 'Your connected calendar experience will arrive in Phase 2.', icon: CalendarDays, stats: ['3 meetings today', 'Next: 2:30 PM', 'Focus time protected'] },
  contacts: { eyebrow: 'Relationships', title: 'Contacts', copy: 'A calm, intelligent view of every relationship in your network.', icon: ContactRound, stats: ['248 contacts', '18 active conversations', '12 warm leads'] },
  tasks: { eyebrow: 'Momentum', title: 'Tasks', copy: 'Follow-ups detected by Olivia will become actionable here.', icon: CheckSquare2, stats: ['8 open tasks', '3 due today', '5 AI-extracted'] },
  pulse: { eyebrow: 'O7 ecosystem', title: 'Pulse', copy: 'Opportunities and conversations will connect without leaving Olivia One.', icon: Sparkles, stats: ['$420K pipeline', '7 active deals', '4 high-intent leads'] },
  settings: { eyebrow: 'Workspace', title: 'Settings', copy: 'Account, provider, intelligence, and security preferences.', icon: Settings2, stats: ['O7 Mail protected', 'AI assistance on', 'Mock provider active'] },
}

export function FeaturePage({ page }) {
  const [dynamicStats, setDynamicStats] = useState(null)
  const detail = pageDetails[page]
  const Icon = detail.icon

  useEffect(() => {
    let active = true

    async function load() {
      if (page === 'contacts') {
        const contacts = await peopleService.listContacts()
        if (!active) return
        setDynamicStats([`${contacts.length} contacts`, '18 active conversations', '12 warm leads'])
        return
      }

      if (page === 'calendar') {
        const events = await peopleService.listCalendarEvents()
        if (!active) return
        setDynamicStats([`${events.length} meetings today`, 'Next: 2:30 PM', 'Focus time protected'])
        return
      }

      setDynamicStats(null)
    }

    load()
    return () => {
      active = false
    }
  }, [page])

  return (
    <section className="featurePage card">
      <div className="featureHero"><span className="featureIcon"><Icon size={24} /></span><small>{detail.eyebrow}</small><h1>{detail.title}</h1><p>{detail.copy}</p></div>
      <div className="featureStats">{(dynamicStats ?? detail.stats).map((stat) => <div key={stat}><span /><b>{stat}</b></div>)}</div>
      <div className="phaseNote"><Sparkles size={17} /><div><b>Phase 2 gateway ready</b><p>This route now has a server-side boundary. Live provider adapters can replace the mock gateway without redesigning the UI.</p></div></div>
    </section>
  )
}
