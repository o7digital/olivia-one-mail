import { BriefcaseBusiness, X } from 'lucide-react'
import { useState } from 'react'
import { IconButton } from '../../components/common/IconButton'

export function OpportunityDialog({ analysis, message, onCancel, onConfirm }) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    if (submitting) return
    setSubmitting(true)
    setError('')
    try {
      await onConfirm()
    } catch (confirmError) {
      setError(confirmError.message || 'Unable to create the opportunity in O7 Pulse.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="overlay" onMouseDown={(event) => event.target === event.currentTarget && onCancel()}>
      <div className="confirmDialog" role="dialog" aria-modal="true" aria-labelledby="opportunity-title">
        <div className="confirmIcon"><BriefcaseBusiness size={22} /></div>
        <IconButton className="confirmClose" label="Close" onClick={onCancel}><X size={17} /></IconButton>
        <small>O7 Pulse · Real CRM sync</small>
        <h2 id="opportunity-title">Create Partnership Expansion?</h2>
        <p>This will create a real client and deal for {message.sender}, {message.company}, in O7 Pulse through the Olivia Gateway. Mailcow stays untouched.</p>
        <div className="confirmMeta"><span>Estimated value</span><b>{new Intl.NumberFormat('en-US', { style: 'currency', currency: analysis.opportunity.currency }).format(analysis.opportunity.estimatedValue)}</b></div>
        {error ? <p className="formError" role="alert">{error}</p> : null}
        <div className="confirmActions"><button type="button" onClick={onCancel}>Cancel</button><button type="button" onClick={submit} disabled={submitting}>{submitting ? 'Syncing…' : 'Confirm opportunity'}</button></div>
      </div>
    </div>
  )
}
