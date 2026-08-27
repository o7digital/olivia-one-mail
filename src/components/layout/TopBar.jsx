import {
  CalendarDays, CheckSquare2, ChevronDown, Command, LayoutGrid, LogOut, Menu, Search, Sparkles,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Avatar } from '../common/Avatar'
import { IconButton } from '../common/IconButton'
import { getWorkspaceIdentity } from '../../utils/workspaceIdentity'

export function TopBar({ aiOpen, onAiToggle, onLogout, onMenuToggle, query, searchRef, setQuery, user }) {
  const navigate = useNavigate()
  const [profileOpen, setProfileOpen] = useState(false)
  const [logoutPending, setLogoutPending] = useState(false)
  const profileRef = useRef(null)
  const workspace = getWorkspaceIdentity(user)

  useEffect(() => {
    function closeProfile(event) {
      if (!profileRef.current?.contains(event.target)) setProfileOpen(false)
    }
    function closeOnEscape(event) {
      if (event.key === 'Escape') setProfileOpen(false)
    }
    document.addEventListener('pointerdown', closeProfile)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeProfile)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [])

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
        <div className="profileWrap" ref={profileRef}>
          <button className="profile" type="button" aria-expanded={profileOpen} aria-haspopup="menu" onClick={() => setProfileOpen((current) => !current)}>
            <Avatar initials={workspace.initials} small />
            <span className="profileIdentity"><b>{workspace.displayName}</b><small>{workspace.email}</small></span>
            <ChevronDown size={16} />
          </button>
          {profileOpen ? (
            <div className="profileMenu" role="menu">
              <button
                type="button"
                role="menuitem"
                disabled={logoutPending}
                onClick={async () => {
                  setLogoutPending(true)
                  try {
                    await onLogout()
                  } finally {
                    setLogoutPending(false)
                  }
                }}
              >
                <LogOut size={15} />{logoutPending ? 'Signing out…' : 'Sign out'}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  )
}
