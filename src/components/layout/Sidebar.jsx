import {
  Archive, CalendarDays, ChevronDown, Clock3, FileText, Inbox, PenLine, Send, ShieldCheck,
  Sparkles, Trash2, X,
} from 'lucide-react'
import { Avatar } from '../common/Avatar'
import { labels, spaces } from '../../mocks/mail'

const folderIcons = {
  Inbox, Priority: Sparkles, Snoozed: Clock3, Sent: Send, Drafts: FileText,
  Scheduled: CalendarDays, Spam: ShieldCheck, Trash: Trash2, Archive,
}

function SidebarSection({ items, labels: withLabels = false, title }) {
  return (
    <div className="section">
      <div className="sectiontitle"><span>{title}</span></div>
      {items.map((item, index) => (
        <button type="button" key={item}>
          {withLabels ? <i className={`dot d${index}`} /> : <i className="spaceicon" />}{item}
        </button>
      ))}
    </div>
  )
}

export function Sidebar({ activeFolder, folders, mobileOpen, onClose, onCompose, onFolderChange }) {
  return (
    <aside className={`sidebar card ${mobileOpen ? 'mobileOpen' : ''}`}>
      <button type="button" className="closeSidebar" onClick={onClose} aria-label="Close navigation"><X size={18} /></button>
      <div className="account"><Avatar initials="OS" /><div><b>Olivier Steineur</b><small>info@o7digitalgroup.com</small></div><ChevronDown size={15} /></div>
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
      </nav>
      <SidebarSection title="Spaces" items={spaces} />
      <SidebarSection title="Labels" items={labels} labels />
      <div className="secure"><ShieldCheck size={15} />Protected by O7 Mail</div>
    </aside>
  )
}
