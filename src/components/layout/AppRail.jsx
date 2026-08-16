import { CheckSquare2, ContactRound, Link2, Mail, Settings2, Sparkles } from 'lucide-react'
import { NavLink } from 'react-router-dom'

const items = [
  ['/contacts', ContactRound, 'Contacts'],
  ['/mail', Mail, 'Mail'],
  ['/tasks', CheckSquare2, 'Tasks'],
  ['/calendar', Link2, 'Calendar'],
]

export function AppRail() {
  return (
    <nav className="rail card" aria-label="Applications">
      {items.map(([path, Icon, label]) => <NavLink key={path} to={path} aria-label={label} title={label}><Icon size={17} /></NavLink>)}
      <span />
      <NavLink className="pulseRail" to="/pulse" aria-label="O7 Pulse" title="O7 Pulse"><Sparkles size={18} /></NavLink>
      <NavLink to="/settings" aria-label="Settings" title="Settings"><Settings2 size={17} /></NavLink>
    </nav>
  )
}
