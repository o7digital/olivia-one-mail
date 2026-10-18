import { useEffect, useState } from 'react'
import { apiClient } from '../services/apiClient'

export function useStorageQuota(enabled, email) {
  const [state, setState] = useState({ owner: null, storage: null, status: 'loading' })
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    if (!enabled || !email) return
    let active = true
    let requestVersion = 0
    async function refresh() {
      const version = ++requestVersion
      try {
        const { storage } = await apiClient.get('/api/drive/storage')
        if (active && version === requestVersion) setState({ owner: email, storage, status: storage ? 'ready' : 'unavailable' })
      } catch {
        if (active && version === requestVersion) setState({ owner: email, storage: null, status: 'error' })
      }
    }
    function refreshWhenVisible() { if (document.visibilityState === 'visible') refresh() }
    refresh()
    const timer = window.setInterval(refreshWhenVisible, 60000)
    window.addEventListener('focus', refreshWhenVisible)
    window.addEventListener('olivia:storage-changed', refresh)
    window.addEventListener('olivia:mail-sent', refresh)
    document.addEventListener('visibilitychange', refreshWhenVisible)
    return () => {
      active = false
      window.clearInterval(timer)
      window.removeEventListener('focus', refreshWhenVisible)
      window.removeEventListener('olivia:storage-changed', refresh)
      window.removeEventListener('olivia:mail-sent', refresh)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
    }
  }, [enabled, email, revision])
  return {
    ...(enabled && state.owner === email ? state : { storage: null, status: 'loading' }),
    retry: () => { setState({ owner: email, storage: null, status: 'loading' }); setRevision((current) => current + 1) },
  }
}
