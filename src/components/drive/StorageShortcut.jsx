import { ArrowUpRight, HardDrive, RefreshCw } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { formatStorageBytes } from '../../utils/storage'

export function StorageShortcut({ quota, onClose }) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { storage, status = 'loading' } = quota ?? {}
  const percent = storage ? Math.min(100, storage.used / storage.limit * 100) : 0
  return (
    <section className={`storageShortcut ${pathname === '/drive' ? 'isActive' : ''}`} aria-label="Drive and storage">
      <button className="storageShortcutLink" type="button" onClick={() => { navigate('/drive'); onClose?.() }} aria-label="Open Drive and storage" aria-current={pathname === '/drive' ? 'page' : undefined}>
        <span className="storageShortcutIcon"><HardDrive size={19} /></span><span><b>Drive & storage</b><small>Mail + files</small></span><ArrowUpRight size={16} />
      </button>
      <div className="storageShortcutDetails" aria-live="polite">
        {storage ? <><span className="storageUsage"><b>{formatStorageBytes(storage.used)}</b> of {formatStorageBytes(storage.limit)} used</span><progress aria-label="Mailbox and Drive storage used" value={percent} max="100" /><small className={percent >= 90 ? 'storageWarning' : ''}>{formatStorageBytes(Math.max(0, storage.limit - storage.used))} available</small></> : <><span>{status === 'loading' ? 'Loading storage…' : 'Storage unavailable'}</span>{status !== 'loading' ? <button type="button" className="storageRetry" onClick={() => quota?.retry()}><RefreshCw size={12} />Retry</button> : null}</>}
      </div>
    </section>
  )
}
