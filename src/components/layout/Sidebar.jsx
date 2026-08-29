import {
  Archive, CalendarDays, ChevronDown, Clock3, FileText, Inbox, PenLine, Send, ShieldCheck,
  Settings2, Sparkles, Trash2, X,
} from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Avatar } from '../common/Avatar'
import { getWorkspaceIdentity } from '../../utils/workspaceIdentity'

const folderIcons = {
  Inbox, Priority: Sparkles, Snoozed: Clock3, Sent: Send, Drafts: FileText,
  Scheduled: CalendarDays, Spam: ShieldCheck, Trash: Trash2, Archive,
}

function SidebarSection({ items, title }) {
  return (
    <div className="section">
      <div className="sectiontitle"><span>{title}</span></div>
      {items.map((item) => (
        <button type="button" key={item}>
          <i className="spaceicon" />{item}
        </button>
      ))}
    </div>
  )
}

function LabelsSection({ activeLabel, labels = [], onLabelSelect = () => {} }) {
  return (
    <div className="section">
      <div className="sectiontitle"><span>Labels</span></div>
      {labels.length ? labels.map((label, index) => (
        <button
          type="button"
          key={label}
          className={label === activeLabel ? 'active' : ''}
          onClick={() => onLabelSelect(label === activeLabel ? null : label)}
        >
          <i className={`dot d${index % 4}`} />{label}
        </button>
      )) : <p className="labelsEmpty">No labels yet. Open a message to create one.</p>}
    </div>
  )
}

export function Sidebar({ activeFolder, activeLabel, folders, knownLabels, mobileOpen, onClose, onCompose, onFolderChange, onLabelSelect, user }) {
  const navigate = useNavigate()
  const location = useLocation()
  const workspace = getWorkspaceIdentity(user)

  return (
    <aside className={`sidebar card ${mobileOpen ? 'mobileOpen' : ''}`}>
      <button type="button" className="closeSidebar" onClick={onClose} aria-label="Close navigation"><X size={18} /></button>
      <div className="account">
        <Avatar initials={workspace.initials} />
        <div><b>{workspace.displayName}</b><small>{workspace.email}</small></div>
        <button type="button" className="accountSetup" aria-label="Setup connected accounts" onClick={() => { navigate('/settings'); onClose() }} title="Setup connected accounts"><Settings2 size={16} /></button>
      </div>
      <button className="compose" type="button" onClick={onCompose}><PenLine size={18} /><span>Compose</span><ChevronDown size={15} /></button>
      <nav aria-label="Mail folders">
        {folders.map(({ label, count }) => {
          const Icon = folderIcons[label]
          return (
            <button key={label} type="button" className={`navitem ${label === activeFolder ? 'active' : ''}`} onClick={() => onFolderChange(label)}>
              <span><Icon size={16} />{label}</span>{count ? <em>{count}</em> : null}
            </button>
          )
        })}
        <button type="button" className={`navitem ${location.pathname === '/waiting' ? 'active' : ''}`} onClick={() => { navigate('/waiting'); onClose() }}>
          <span><Clock3 size={16} />Waiting</span>
        </button>
      </nav>
      <SidebarSection title="Spaces" items={workspace.spaces} />
      <LabelsSection activeLabel={activeLabel} labels={knownLabels ?? []} onLabelSelect={onLabelSelect} />
      <div className="secure"><ShieldCheck size={15} />Protected by O7 Mail</div>
    </aside>
  )
}
