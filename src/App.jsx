import { useCallback, useEffect, useRef, useState } from 'react'
import { AuthenticateWithRedirectCallback } from '@clerk/react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { AIWorkspace } from './components/ai/AIWorkspace'
import { CalendarPage } from './components/calendar/CalendarPage'
import { AppRail } from './components/layout/AppRail'
import { FeaturePage } from './components/layout/FeaturePage'
import { Sidebar } from './components/layout/Sidebar'
import { TopBar } from './components/layout/TopBar'
import { MailList } from './components/mail/MailList'
import { MailReader } from './components/mail/MailReader'
import { TasksPage } from './components/tasks/TasksPage'
import { OpportunityDialog } from './features/ai-workspace/OpportunityDialog'
import { ComposeModal } from './features/composer/ComposeModal'
import { PrivacyNotice, PRIVACY_VERSION } from './components/legal/PrivacyNotice'
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
  const [composeState, setComposeState] = useState(null)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [opportunityOpen, setOpportunityOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [toast, setToast] = useState('')
  const [loginError, setLoginError] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)
  const [privacyOpen, setPrivacyOpen] = useState(false)
  const [privacyAccepted, setPrivacyAccepted] = useState(false)
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
        setComposeState(null)
        setOpportunityOpen(false)
        setMobileNavOpen(false)
      }
    }
    window.addEventListener('keydown', handleShortcut)
    return () => window.removeEventListener('keydown', handleShortcut)
  }, [navigate])

  function openCompose(mode, message) {
    if (mode === 'reply' || mode === 'reply-all') {
      const subject = message.subject.startsWith('Re:') ? message.subject : `Re: ${message.subject}`
      setComposeState({ mode, messageId: message.id, initialTo: message.email, initialSubject: subject })
    } else if (mode === 'forward') {
      const subject = message.subject.startsWith('Fwd:') ? message.subject : `Fwd: ${message.subject}`
      setComposeState({ mode, messageId: message.id, initialTo: '', initialSubject: subject })
    } else {
      setComposeState({ mode: 'new', initialTo: '', initialSubject: '' })
    }
  }

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

    const opportunity = await pulseService.createOpportunity({
      title: aiWorkspace.analysis.opportunity.title,
      messageId: inbox.selected.id,
      senderName: inbox.selected.sender,
      senderEmail: inbox.selected.email,
      company: inbox.selected.company,
      estimatedValue: aiWorkspace.analysis.opportunity.estimatedValue,
      currency: aiWorkspace.analysis.opportunity.currency,
      confidence: aiWorkspace.analysis.opportunity.confidence,
      tasks: aiWorkspace.analysis.tasks,
    })
    setOpportunityOpen(false)
    notify(`Opportunity created in O7 Pulse (deal ${opportunity.dealId})`)
  }

  async function handleLogin(event) {
    event.preventDefault()
    if (!privacyAccepted) {
      setLoginError('Please review and accept the privacy notice to continue.')
      setPrivacyOpen(true)
      return
    }
    const formData = new FormData(event.currentTarget)
    setLoginError('')
    setLoginLoading(true)
    try {
      await session.login({
        email: String(formData.get('email') ?? ''),
        password: String(formData.get('password') ?? ''),
        privacyAccepted,
        privacyVersion: PRIVACY_VERSION,
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
          <div className={`privacyConsentCard ${privacyAccepted ? 'accepted' : ''}`}>
            <label className="privacyConsent">
              <input name="privacyAccepted" type="checkbox" checked={privacyAccepted} onChange={(event) => { setPrivacyAccepted(event.target.checked); setLoginError('') }} required />
              <span><b>Privacy agreement required</b>I agree to the processing of connected mail/calendar data and Olivia AI analysis.</span>
            </label>
            <button type="button" className="privacyDocumentLink" onClick={() => setPrivacyOpen(true)}>View the full privacy document</button>
          </div>
          {loginError ? <p className="formError" role="alert">{loginError}</p> : null}
          <button className="sendAi" type="submit" disabled={loginLoading || !privacyAccepted}>{loginLoading ? 'Signing in…' : 'Sign in securely'}</button>
        </form>
        {privacyOpen ? <PrivacyNotice onClose={() => setPrivacyOpen(false)} onAccept={() => { setPrivacyAccepted(true); setPrivacyOpen(false) }} /> : null}
      </div>
    )
  }

  return (
    <div className="app">
      <div className="glow g1" /><div className="glow g2" />
      <TopBar
        aiOpen={aiOpen}
        onAiToggle={() => setAiOpen((current) => !current)}
        onLogout={async () => {
          try {
            await session.logout()
            setQuery('')
            setComposeState(null)
            setOpportunityOpen(false)
          } catch (error) {
            notify(error.message || 'Unable to sign out')
          }
        }}
        onMenuToggle={() => setMobileNavOpen((current) => !current)}
        query={query}
        searchRef={searchRef}
        setQuery={updateQuery}
        user={session.session?.user}
      />

      {mobileNavOpen ? <button type="button" className="navScrim" onClick={() => setMobileNavOpen(false)} aria-label="Close navigation" /> : null}

      <Routes>
        <Route path="/sso-callback" element={(
          <div className="authShell">
            <div className="authCard">
              <b>Connecting your Google account…</b>
              <p>Olivia One is completing the secure authorization.</p>
              <AuthenticateWithRedirectCallback
                signInFallbackRedirectUrl="/settings?connect=google"
                signUpFallbackRedirectUrl="/settings?connect=google"
              />
            </div>
          </div>
        )} />
        <Route path="/" element={<Navigate to="/mail" replace />} />
        <Route path="/mail" element={(
          <main className={`grid ${aiOpen ? 'aiOn' : 'aiOff'}`}>
            <Sidebar activeFolder={activeFolder} activeLabel={inbox.labelFilter} folders={folders.folders} knownLabels={inbox.knownLabels} mobileOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} onCompose={() => openCompose('new')} onFolderChange={changeFolder} onLabelSelect={inbox.setLabelFilter} user={session.session?.user} />
            <MailList
              activeFolder={activeFolder}
              category={inbox.category}
              error={inbox.error}
              labelFilter={inbox.labelFilter}
              messages={inbox.filteredMessages}
              onClearLabelFilter={() => inbox.setLabelFilter(null)}
              onCategoryChange={inbox.setCategory}
              onRetry={inbox.reload}
              onSelect={inbox.selectMessage}
              onSortChange={inbox.setSortBy}
              query={query}
              selectedId={inbox.selectedId}
              sortBy={inbox.sortBy}
              status={inbox.status}
            />
            <MailReader
              aiOpen={aiOpen}
              aiStatus={aiWorkspace.status}
              analysis={aiWorkspace.analysis}
              knownLabels={inbox.knownLabels}
              message={inbox.selected}
              onAiToggle={() => setAiOpen((current) => !current)}
              onArchive={() => inbox.archiveMessage(inbox.selected.id)}
              onDelete={() => inbox.deleteMessage(inbox.selected.id)}
              onForward={() => openCompose('forward', inbox.selected)}
              onLabelsChange={inbox.updateMessageLabels}
              onMoveToSpam={() => inbox.moveMessage(inbox.selected.id, 'Spam')}
              onNotify={notify}
              onReply={() => openCompose('reply', inbox.selected)}
              onReplyAll={() => openCompose('reply-all', inbox.selected)}
              onSnooze={() => inbox.moveMessage(inbox.selected.id, 'Snoozed')}
              onToggleStar={() => inbox.toggleStarMessage(inbox.selected.id)}
            />
            {aiOpen ? <AIWorkspace analysis={aiWorkspace.analysis} message={inbox.selected} onCreateOpportunity={() => setOpportunityOpen(true)} onNotify={notify} status={aiWorkspace.status} /> : null}
            <AppRail />
          </main>
        )} />
        <Route path="/tasks" element={(
          <main className="grid pageGrid">
            <Sidebar activeFolder={activeFolder} folders={folders.folders} mobileOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} onCompose={() => openCompose('new')} onFolderChange={changeFolder} user={session.session?.user} />
            <TasksPage onNotify={notify} />
            <AppRail />
          </main>
        )} />
        <Route path="/calendar" element={(
          <main className="grid pageGrid">
            <Sidebar activeFolder={activeFolder} folders={folders.folders} mobileOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} onCompose={() => openCompose('new')} onFolderChange={changeFolder} user={session.session?.user} />
            <CalendarPage />
            <AppRail />
          </main>
        )} />
        {['contacts', 'pulse', 'settings'].map((page) => (
          <Route key={page} path={`/${page}`} element={(
            <main className="grid pageGrid">
              <Sidebar activeFolder={activeFolder} folders={folders.folders} mobileOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} onCompose={() => openCompose('new')} onFolderChange={changeFolder} user={session.session?.user} />
              <FeaturePage page={page} />
              <AppRail />
            </main>
          )} />
        ))}
        <Route path="*" element={<Navigate to="/mail" replace />} />
      </Routes>

      {composeState ? (
        <ComposeModal
          initialSubject={composeState.initialSubject}
          initialTo={composeState.initialTo}
          messageId={composeState.messageId}
          mode={composeState.mode}
          onClose={() => setComposeState(null)}
          onSent={(message) => {
            notify(message)
            if (composeState.mode !== 'new') inbox.reload()
          }}
        />
      ) : null}
      {opportunityOpen && inbox.selected && aiWorkspace.analysis ? <OpportunityDialog analysis={aiWorkspace.analysis} message={inbox.selected} onCancel={() => setOpportunityOpen(false)} onConfirm={confirmOpportunity} /> : null}
      {toast ? <div className="toast" role="status"><span />{toast}</div> : null}
    </div>
  )
}

export default App
