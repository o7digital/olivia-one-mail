import { BriefcaseBusiness, X } from 'lucide-react'
import { IconButton } from '../../components/common/IconButton'

export function OpportunityDialog({ message, onCancel, onConfirm }) {
  return (
    <div className="overlay" onMouseDown={(event) => event.target === event.currentTarget && onCancel()}>
      <div className="confirmDialog" role="dialog" aria-modal="true" aria-labelledby="opportunity-title">
        <div className="confirmIcon"><BriefcaseBusiness size={22} /></div>
        <IconButton className="confirmClose" label="Close" onClick={onCancel}><X size={17} /></IconButton>
        <small>O7 Pulse · Mock action</small>
        <h2 id="opportunity-title">Create Partnership Expansion?</h2>
        <p>This will simulate syncing {message.sender}, {message.company}, and this conversation into O7 Pulse. No external data will be changed in Phase 1.</p>
        <div className="confirmMeta"><span>Estimated value</span><b>$120,000</b></div>
        <div className="confirmActions"><button type="button" onClick={onCancel}>Cancel</button><button type="button" onClick={onConfirm}>Confirm opportunity</button></div>
      </div>
    </div>
  )
}
