import {
  CalendarDays, CheckSquare2, ChevronDown, Command, LayoutGrid, Menu, Search, Sparkles,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Avatar } from '../common/Avatar'
import { IconButton } from '../common/IconButton'

export function TopBar({ aiOpen, onAiToggle, onMenuToggle, query, searchRef, setQuery }) {
  const navigate = useNavigate()

  return (
    <header className="topbar">
      <div className="brand">
        <IconButton className="menuButton" label="Open navigation" onClick={onMenuToggle}><Menu size={18} /></IconButton>
        <div className="brandmark">O1</div><span>Olivia One</span>
      </div>
      <label className="searchbox">
        <Search size={17} />
        <input
          ref={searchRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search messages, people, or anything…"
          aria-label="Search messages"
        />
        {query ? <button type="button" onClick={() => setQuery('')} aria-label="Clear search">Clear</button> : <span className="shortcut"><Command size={12} />K</span>}
      </label>
      <div className="topright">
        <button className={`aiTop ${aiOpen ? 'active' : ''}`} type="button" onClick={onAiToggle} aria-pressed={aiOpen}>
          <Sparkles size={16} />AI Workspace<span />
        </button>
        <IconButton label="Calendar" onClick={() => navigate('/calendar')}><CalendarDays size={18} /></IconButton>
        <IconButton label="Tasks" onClick={() => navigate('/tasks')}><CheckSquare2 size={18} /></IconButton>
        <IconButton label="Apps" onClick={() => navigate('/pulse')}><LayoutGrid size={18} /></IconButton>
        <div className="profile"><Avatar initials="OS" small /><div><b>Olivier Steineur</b><small>info@o7digitalgroup.com</small></div><ChevronDown size={16} /></div>
      </div>
    </header>
  )
}
