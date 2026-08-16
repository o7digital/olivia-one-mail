import { AlertTriangle, Inbox as InboxIcon, RefreshCw } from 'lucide-react'

export function MailListSkeleton() {
  return (
    <div className="skeletonList" aria-label="Loading messages" aria-busy="true">
      {Array.from({ length: 5 }, (_, index) => (
        <div className="skeletonRow" key={index}>
          <span className="skeletonAvatar" />
          <div><i /><i /><i /></div>
        </div>
      ))}
    </div>
  )
}

export function EmptyState({ query }) {
  return (
    <div className="viewState">
      <InboxIcon size={22} />
      <b>{query ? 'No matching messages' : 'Nothing here yet'}</b>
      <small>{query ? 'Try a different person, subject, or keyword.' : 'This folder is refreshingly quiet.'}</small>
    </div>
  )
}

export function ErrorState({ onRetry }) {
  return (
    <div className="viewState errorState" role="alert">
      <AlertTriangle size={22} />
      <b>Messages could not be loaded</b>
      <small>The mock mail service did not respond.</small>
      <button type="button" onClick={onRetry}><RefreshCw size={13} />Try again</button>
    </div>
  )
}
