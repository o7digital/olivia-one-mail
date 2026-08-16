import { CalendarDays, CheckSquare2, ContactRound, Settings2, Sparkles } from 'lucide-react'

const pageDetails = {
  calendar: { eyebrow: 'Schedule', title: 'Calendar', copy: 'Your connected calendar experience will arrive in Phase 2.', icon: CalendarDays, stats: ['3 meetings today', 'Next: 2:30 PM', 'Focus time protected'] },
  contacts: { eyebrow: 'Relationships', title: 'Contacts', copy: 'A calm, intelligent view of every relationship in your network.', icon: ContactRound, stats: ['248 contacts', '18 active conversations', '12 warm leads'] },
  tasks: { eyebrow: 'Momentum', title: 'Tasks', copy: 'Follow-ups detected by Olivia will become actionable here.', icon: CheckSquare2, stats: ['8 open tasks', '3 due today', '5 AI-extracted'] },
  pulse: { eyebrow: 'O7 ecosystem', title: 'Pulse', copy: 'Opportunities and conversations will connect without leaving Olivia One.', icon: Sparkles, stats: ['$420K pipeline', '7 active deals', '4 high-intent leads'] },
  settings: { eyebrow: 'Workspace', title: 'Settings', copy: 'Account, provider, intelligence, and security preferences.', icon: Settings2, stats: ['O7 Mail protected', 'AI assistance on', 'Mock provider active'] },
}

export function FeaturePage({ page }) {
  const detail = pageDetails[page]
  const Icon = detail.icon
  return (
    <section className="featurePage card">
      <div className="featureHero"><span className="featureIcon"><Icon size={24} /></span><small>{detail.eyebrow}</small><h1>{detail.title}</h1><p>{detail.copy}</p></div>
      <div className="featureStats">{detail.stats.map((stat) => <div key={stat}><span /><b>{stat}</b></div>)}</div>
      <div className="phaseNote"><Sparkles size={17} /><div><b>Phase 1 shell</b><p>This route is ready for its dedicated feature work. Live providers and server integrations remain intentionally disconnected.</p></div></div>
    </section>
  )
}
