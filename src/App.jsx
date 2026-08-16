import { useCallback, useEffect, useRef, useState } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { AIWorkspace } from './components/ai/AIWorkspace'
import { AppRail } from './components/layout/AppRail'
import { FeaturePage } from './components/layout/FeaturePage'
import { Sidebar } from './components/layout/Sidebar'
import { TopBar } from './components/layout/TopBar'
import { MailList } from './components/mail/MailList'
import { MailReader } from './components/mail/MailReader'
import { OpportunityDialog } from './features/ai-workspace/OpportunityDialog'
import { ComposeModal } from './features/composer/ComposeModal'
import { useInbox } from './features/inbox/useInbox'

function App() {
  const location = useLocation()
  const navigate = useNavigate()
  const searchRef = useRef(null)
  const toastTimer = useRef(null)
  const [activeFolder, setActiveFolder] = useState('Inbox')
  const [aiOpen, setAiOpen] = useState(true)
  const [composeOpen, setComposeOpen] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [opportunityOpen, setOpportunityOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [toast, setToast] = useState('')
  const inbox = useInbox(activeFolder, query)

  const notify = useCallback((message) => {
    window.clearTimeout(toastTimer.current)
    setToast(message)
    toastTimer.current = window.setTimeout(() => setToast(''), 2600)
  }, [])

  useEffect(() => () => window.clearTimeout(toastTimer.current), [])

  useEffect(() => {
    function handleShortcut(event) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        navigate('/mail')
        window.setTimeout(() => searchRef.current?.focus(), 0)
      }
      if (event.key === 'Escape') {
        setComposeOpen(false)
        setOpportunityOpen(false)
        setMobileNavOpen(false)
      }
    }
    window.addEventListener('keydown', handleShortcut)
    return () => window.removeEventListener('keydown', handleShortcut)
  }, [navigate])

  function changeFolder(folder) {
    setActiveFolder(folder)
    setQuery('')
    setMobileNavOpen(false)
    navigate('/mail')
  }

  function updateQuery(value) {
    setQuery(value)
    if (value && location.pathname !== '/mail') navigate('/mail')
  }

  function confirmOpportunity() {
    setOpportunityOpen(false)
    notify('Mock opportunity created in O7 Pulse')
  }

  return (
    <div className="app">
      <div className="glow g1" /><div className="glow g2" />
      <TopBar
        aiOpen={aiOpen}
        onAiToggle={() => setAiOpen((current) => !current)}
        onMenuToggle={() => setMobileNavOpen((current) => !current)}
        query={query}
        searchRef={searchRef}
        setQuery={updateQuery}
      />

      {mobileNavOpen ? <button type="button" className="navScrim" onClick={() => setMobileNavOpen(false)} aria-label="Close navigation" /> : null}

      <Routes>
        <Route path="/" element={<Navigate to="/mail" replace />} />
        <Route path="/mail" element={(
          <main className={`grid ${aiOpen ? 'aiOn' : 'aiOff'}`}>
            <Sidebar activeFolder={activeFolder} mobileOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} onCompose={() => setComposeOpen(true)} onFolderChange={changeFolder} />
            <MailList activeFolder={activeFolder} error={inbox.error} messages={inbox.filteredMessages} onRetry={inbox.reload} onSelect={inbox.selectMessage} query={query} selectedId={inbox.selectedId} status={inbox.status} />
            <MailReader aiOpen={aiOpen} message={inbox.selected} onAiToggle={() => setAiOpen((current) => !current)} onNotify={notify} />
            {aiOpen ? <AIWorkspace message={inbox.selected} onCreateOpportunity={() => setOpportunityOpen(true)} onNotify={notify} /> : null}
            <AppRail />
          </main>
        )} />
        {['calendar', 'contacts', 'tasks', 'pulse', 'settings'].map((page) => (
          <Route key={page} path={`/${page}`} element={(
            <main className="grid pageGrid">
              <Sidebar activeFolder={activeFolder} mobileOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} onCompose={() => setComposeOpen(true)} onFolderChange={changeFolder} />
              <FeaturePage page={page} />
              <AppRail />
            </main>
          )} />
        ))}
        <Route path="*" element={<Navigate to="/mail" replace />} />
      </Routes>

      {composeOpen ? <ComposeModal onClose={() => setComposeOpen(false)} onSent={notify} /> : null}
      {opportunityOpen && inbox.selected ? <OpportunityDialog message={inbox.selected} onCancel={() => setOpportunityOpen(false)} onConfirm={confirmOpportunity} /> : null}
      {toast ? <div className="toast" role="status"><span />{toast}</div> : null}
    </div>
  )
}

export default App
