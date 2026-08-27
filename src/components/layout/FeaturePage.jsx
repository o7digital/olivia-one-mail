import { Building2, CalendarDays, CheckSquare2, Cloud, ContactRound, ExternalLink, Mail, Settings2, ShieldCheck, Sparkles, X } from 'lucide-react'
import { useClerk } from '@clerk/react'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { peopleService } from '../../services/peopleService'

const pageDetails = {
  calendar: { eyebrow: 'Schedule', title: 'Calendar', copy: 'Your connected calendar experience will arrive in Phase 2.', icon: CalendarDays, stats: ['3 meetings today', 'Next: 2:30 PM', 'Focus time protected'] },
  contacts: { eyebrow: 'Relationships', title: 'Contacts', copy: 'A calm, intelligent view of every relationship in your network.', icon: ContactRound, stats: ['248 contacts', '18 active conversations', '12 warm leads'] },
  tasks: { eyebrow: 'Momentum', title: 'Tasks', copy: 'Follow-ups detected by Olivia will become actionable here.', icon: CheckSquare2, stats: ['8 open tasks', '3 due today', '5 AI-extracted'] },
  pulse: { eyebrow: 'O7 ecosystem', title: 'Pulse', copy: 'Opportunities and conversations will connect without leaving Olivia One.', icon: Sparkles, stats: ['$420K pipeline', '7 active deals', '4 high-intent leads'] },
  settings: { eyebrow: 'Workspace', title: 'Settings', copy: 'Account, provider, intelligence, and security preferences.', icon: Settings2, stats: ['O7 Mail protected', 'AI assistance on', 'Mock provider active'] },
}

export function FeaturePage({ page }) {
  const [dynamicStats, setDynamicStats] = useState(null)
  const detail = pageDetails[page]
  const Icon = detail.icon

  useEffect(() => {
    let active = true

    async function load() {
      if (page === 'contacts') {
        const contacts = await peopleService.listContacts()
        if (!active) return
        setDynamicStats([`${contacts.length} contacts`, '18 active conversations', '12 warm leads'])
        return
      }

      if (page === 'calendar') {
        const events = await peopleService.listCalendarEvents()
        if (!active) return
        setDynamicStats([`${events.length} meetings today`, 'Next: 2:30 PM', 'Focus time protected'])
        return
      }

      setDynamicStats(null)
    }

    load()
    return () => {
      active = false
    }
  }, [page])

  return (
    <section className="featurePage card">
      <div className="featureHero"><span className="featureIcon"><Icon size={24} /></span><small>{detail.eyebrow}</small><h1>{detail.title}</h1><p>{detail.copy}</p></div>
      {page === 'settings' ? <ConnectedAccounts /> : null}
      <div className="featureStats">{(dynamicStats ?? detail.stats).map((stat) => <div key={stat}><span /><b>{stat}</b></div>)}</div>
      <div className="phaseNote"><Sparkles size={17} /><div><b>Phase 2 gateway ready</b><p>This route now has a server-side boundary. Live provider adapters can replace the mock gateway without redesigning the UI.</p></div></div>
    </section>
  )
}

const accountProviders = [
  { name: 'Google', detail: 'Gmail + Google Calendar', method: 'Secure OAuth connection', icon: Mail, tone: 'google' },
  { name: 'Microsoft', detail: 'Outlook + Microsoft Calendar', method: 'Secure OAuth connection', icon: Building2, tone: 'microsoft' },
  { name: 'iCloud', detail: 'iCloud Mail + Calendar', method: 'App password + CalDAV', icon: Cloud, tone: 'icloud' },
  { name: 'Other account', detail: 'OVH, O7 Mail or custom provider', method: 'IMAP/SMTP + CalDAV', icon: Settings2, tone: 'other' },
]

function ConnectedAccounts() {
  const [setupProvider, setSetupProvider] = useState(null)
  const [searchParams, setSearchParams] = useSearchParams()

  useEffect(() => {
    if (searchParams.get('connect') !== 'google') return
    setSetupProvider(accountProviders[0])
    setSearchParams({}, { replace: true })
  }, [searchParams, setSearchParams])

  return (
    <section className="connectedAccounts" aria-labelledby="connected-accounts-title">
      <div className="connectedHead">
        <div><small>MAIL & CALENDAR</small><h2 id="connected-accounts-title">Connected accounts</h2><p>Add another mailbox and let Olivia analyze it in the same workspace.</p></div>
        <span><Settings2 size={16} />Setup</span>
      </div>
      <div className="providerGrid">
        {accountProviders.map((provider) => {
          const ProviderIcon = provider.icon
          return (
            <button type="button" key={provider.name} onClick={() => setSetupProvider(provider)}>
              <i className={`providerIcon ${provider.tone}`}><ProviderIcon size={20} /></i>
              <span><b>{provider.name}</b><small>{provider.detail}</small></span>
              <em>Set up</em>
            </button>
          )
        })}
      </div>
      {setupProvider ? <AccountSetupDialog provider={setupProvider} onClose={() => setSetupProvider(null)} /> : null}
    </section>
  )
}

function AccountSetupDialog({ onClose, provider }) {
  const [notice, setNotice] = useState('')
  const [connecting, setConnecting] = useState(false)
  const clerk = useClerk()
  const ProviderIcon = provider.icon
  const isOAuth = provider.name === 'Google' || provider.name === 'Microsoft'
  const defaultEmail = provider.name === 'Google' ? 'olivier.steineur@gmail.com' : provider.name === 'iCloud' ? 'olivier.steineur@icloud.com' : ''

  const googleScopes = [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/calendar.readonly',
  ]

  async function connectGoogle(email) {
    if (!clerk.loaded) throw new Error('Clerk is still loading. Please try again in a moment.')

    if (!clerk.user) {
      window.sessionStorage.setItem('olivia-google-link-pending', 'true')
      await clerk.client.signIn.authenticateWithRedirect({
        strategy: 'oauth_google',
        redirectUrl: '/sso-callback',
        redirectUrlComplete: '/settings?connect=google',
        oidcPrompt: 'select_account',
      })
      return
    }

    const existingGoogleAccount = clerk.user.externalAccounts.find((account) => account.provider === 'google')
    const externalAccount = existingGoogleAccount
      ? await existingGoogleAccount.reauthorize({
        additionalScopes: googleScopes,
        redirectUrl: '/sso-callback',
        oidcPrompt: 'consent',
        oidcLoginHint: email,
      })
      : await clerk.user.createExternalAccount({
        strategy: 'oauth_google',
        additionalScopes: googleScopes,
        redirectUrl: '/sso-callback',
        oidcPrompt: 'consent',
        oidcLoginHint: email,
      })

    const authorizationUrl = externalAccount.verification?.externalVerificationRedirectURL
    if (!authorizationUrl) {
      await clerk.user.reload()
      setNotice('Google is connected. Gmail and Calendar permissions are active.')
      window.sessionStorage.removeItem('olivia-google-link-pending')
      return
    }

    window.sessionStorage.setItem('olivia-google-link-pending', 'true')
    window.location.assign(authorizationUrl.toString())
  }

  async function continueSetup(event) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const email = String(formData.get('connectedEmail') ?? '')
    setNotice('')
    setConnecting(true)

    try {
      if (provider.name === 'Google') {
        await connectGoogle(email)
        return
      }

      setNotice(isOAuth
        ? `${provider.name} OAuth will be enabled in the next connector update.`
        : `${provider.name} server connector must be enabled before credentials can be securely validated.`)
    } catch (error) {
      setNotice(error?.errors?.[0]?.longMessage || error?.message || `Unable to connect ${provider.name}.`)
    } finally {
      setConnecting(false)
    }
  }

  useEffect(() => {
    if (provider.name !== 'Google' || !clerk.loaded || !clerk.user) return
    if (window.sessionStorage.getItem('olivia-google-link-pending') !== 'true') return

    const googleAccount = clerk.user.externalAccounts.find((account) => account.provider === 'google')
    const hasMailScope = googleAccount?.approvedScopes?.includes('gmail.readonly')
    const hasCalendarScope = googleAccount?.approvedScopes?.includes('calendar.readonly')
    if (hasMailScope && hasCalendarScope) {
      window.sessionStorage.removeItem('olivia-google-link-pending')
      setNotice(`Connected securely to ${googleAccount.emailAddress}. Gmail and Calendar are ready.`)
      return
    }

    const email = googleAccount?.emailAddress || defaultEmail
    connectGoogle(email).catch((error) => {
      setNotice(error?.errors?.[0]?.longMessage || error?.message || 'Unable to request Gmail permissions.')
      window.sessionStorage.removeItem('olivia-google-link-pending')
    })
  // This intentionally runs after Clerk finishes the OAuth return flow.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clerk.loaded, clerk.user, provider.name])

  return (
    <div className="overlay accountSetupOverlay" role="presentation">
      <section className="accountSetupDialog" role="dialog" aria-modal="true" aria-labelledby="account-setup-title">
        <button type="button" className="setupClose" onClick={onClose} aria-label="Close account setup"><X size={18} /></button>
        <i className={`providerIcon ${provider.tone}`}><ProviderIcon size={21} /></i>
        <small>CONNECTED ACCOUNT</small>
        <h2 id="account-setup-title">Add {provider.name}</h2>
        <p>{provider.detail} will appear in the unified Olivia workspace after the provider validates the connection.</p>

        <form className="accountSetupForm" onSubmit={continueSetup}>
          <label>Email address<input name="connectedEmail" type="email" defaultValue={defaultEmail} placeholder="name@example.com" required /></label>
          {isOAuth ? (
            <div className="oauthExplanation"><ShieldCheck size={17} /><span>Olivia never asks for your {provider.name} password. Authorization uses the provider’s secure OAuth page.</span></div>
          ) : (
            <>
              <label>App-specific password<input name="appPassword" type="password" placeholder="App password" autoComplete="new-password" required /></label>
              {provider.name === 'Other account' ? <label>IMAP server<input name="imapHost" placeholder="imap.example.com" required /></label> : null}
            </>
          )}
          <label className="syncChoice"><input type="checkbox" defaultChecked />Sync mail and calendar</label>
          {notice ? <p className="setupNotice" role="status">{notice}</p> : null}
          <div className="setupActions"><button type="button" onClick={onClose}>Cancel</button><button type="submit" disabled={connecting}>{connecting ? 'Connecting…' : isOAuth ? <><ExternalLink size={14} />Continue with {provider.name}</> : `Connect ${provider.name}`}</button></div>
        </form>
      </section>
    </div>
  )
}
