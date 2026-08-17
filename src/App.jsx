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
import { useAIWorkspace } from './hooks/useAIWorkspace'
import { useSession } from './hooks/useSession'
import { pulseService } from './services/pulseService'
import { useInbox, useMailFolders } from './features/inbox/useInbox'

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
  const [loginError, setLoginError] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)
  const session = useSession()
  const isAuthenticated = session.isAuthenticated
  const folders = useMailFolders(isAuthenticated)
  const inbox = useInbox(activeFolder, query, isAuthenticated)
  const aiWorkspace = useAIWorkspace(inbox.selected?.id, isAuthenticated)

  const notify = useCallback((message) => {
    window.clearTimeout(toastTimer.current)
    setToast(message)
    toastTimer.current = window.setTimeout(() => setToast(''), 2600)
  }, [])

  useEffect(() => () => window.clearTimeout(toastTimer.current), [])

  useEffect(() => {
    if (session.error) setLoginError(session.error)
  }, [session.error])

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

  async function confirmOpportunity() {
    if (!inbox.selected || !aiWorkspace.analysis) return

    const contact = await pulseService.syncContact({
      name: inbox.selected.sender,
      email: inbox.selected.email,
      company: inbox.selected.company,
    })
    const opportunity = await pulseService.createOpportunity({
      title: aiWorkspace.analysis.opportunity.title,
      messageId: inbox.selected.id,
      estimatedValue: aiWorkspace.analysis.opportunity.estimatedValue,
      currency: aiWorkspace.analysis.opportunity.currency,
      confirmed: true,
    })
    await pulseService.linkConversation({
      threadId: inbox.selected.id,
      opportunityId: opportunity.opportunityId,
    })
    await pulseService.createTasks(aiWorkspace.analysis.tasks)
    setOpportunityOpen(false)
    notify(`Opportunity created in O7 Pulse for ${contact.contactId}`)
  }

  async function handleLogin(event) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    setLoginError('')
    setLoginLoading(true)
    try {
      await session.login({
        email: String(formData.get('email') ?? ''),
        password: String(formData.get('password') ?? ''),
      })
    } catch (error) {
      setLoginError(error.message)
    } finally {
      setLoginLoading(false)
    }
  }

  if (!session.ready) {
    return <div className="authShell"><div className="authCard"><b>Restoring secure session…</b><p>Olivia One is checking your mailbox session.</p></div></div>
  }

  if (!isAuthenticated) {
    return (
      <div className="authShell">
        <div className="glow g1" /><div className="glow g2" />
        <form className="authCard" onSubmit={handleLogin}>
          <div className="brand authBrand"><div className="brandmark">O1</div><span>Olivia One</span></div>
          <h1>Sign in to your mailbox</h1>
          <p>Use your O7 Mail email address and password.</p>
          <input autoFocus name="email" type="email" placeholder="you@o7digitalgroup.com" aria-label="Email" />
          <input name="password" type="password" placeholder="Password" aria-label="Password" />
          {loginError ? <p className="formError" role="alert">{loginError}</p> : null}
          <button className="sendAi" type="submit" disabled={loginLoading}>{loginLoading ? 'Signing in…' : 'Sign in securely'}</button>
        </form>
      </div>
    )
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
            <Sidebar activeFolder={activeFolder} folders={folders.folders} mobileOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} onCompose={() => setComposeOpen(true)} onFolderChange={changeFolder} />
            <MailList activeFolder={activeFolder} error={inbox.error} messages={inbox.filteredMessages} onRetry={inbox.reload} onSelect={inbox.selectMessage} query={query} selectedId={inbox.selectedId} status={inbox.status} />
            <MailReader aiOpen={aiOpen} analysis={aiWorkspace.analysis} message={inbox.selected} onAiToggle={() => setAiOpen((current) => !current)} onNotify={notify} />
            {aiOpen ? <AIWorkspace analysis={aiWorkspace.analysis} message={inbox.selected} onCreateOpportunity={() => setOpportunityOpen(true)} onNotify={notify} status={aiWorkspace.status} /> : null}
            <AppRail />
          </main>
        )} />
        {['calendar', 'contacts', 'tasks', 'pulse', 'settings'].map((page) => (
          <Route key={page} path={`/${page}`} element={(
            <main className="grid pageGrid">
              <Sidebar activeFolder={activeFolder} folders={folders.folders} mobileOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} onCompose={() => setComposeOpen(true)} onFolderChange={changeFolder} />
              <FeaturePage page={page} />
              <AppRail />
            </main>
          )} />
        ))}
        <Route path="*" element={<Navigate to="/mail" replace />} />
      </Routes>

      {composeOpen ? <ComposeModal onClose={() => setComposeOpen(false)} onSent={notify} /> : null}
      {opportunityOpen && inbox.selected && aiWorkspace.analysis ? <OpportunityDialog analysis={aiWorkspace.analysis} message={inbox.selected} onCancel={() => setOpportunityOpen(false)} onConfirm={confirmOpportunity} /> : null}
      {toast ? <div className="toast" role="status"><span />{toast}</div> : null}
    </div>
  )
}

export default App
