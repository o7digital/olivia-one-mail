import { Building2, CalendarDays, Check, CheckSquare2, Cloud, ContactRound, Mail, Palette, Settings2, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { peopleService } from '../../services/peopleService'
import { COLOR_THEMES, DEFAULT_COLOR_INTENSITY, MAX_COLOR_INTENSITY, MIN_COLOR_INTENSITY } from '../../theme'

const pageDetails = {
  calendar: { eyebrow: 'Schedule', title: 'Calendar', copy: 'Your connected calendar experience will arrive in Phase 2.', icon: CalendarDays, stats: ['3 meetings today', 'Next: 2:30 PM', 'Focus time protected'] },
  contacts: { eyebrow: 'Relationships', title: 'Contacts', copy: 'A calm, intelligent view of every relationship in your network.', icon: ContactRound, stats: ['248 contacts', '18 active conversations', '12 warm leads'] },
  tasks: { eyebrow: 'Momentum', title: 'Tasks', copy: 'Follow-ups detected by Olivia will become actionable here.', icon: CheckSquare2, stats: ['8 open tasks', '3 due today', '5 AI-extracted'] },
  pulse: { eyebrow: 'O7 ecosystem', title: 'Pulse', copy: 'Opportunities and conversations will connect without leaving Olivia One.', icon: Sparkles, stats: ['$420K pipeline', '7 active deals', '4 high-intent leads'] },
  settings: { eyebrow: 'Workspace', title: 'Settings', copy: 'Account, provider, intelligence, and security preferences.', icon: Settings2, stats: ['O7 Mail protected', 'AI assistance on', 'Mock provider active'] },
}

export function FeaturePage({ page, colorTheme = 'default', onColorThemeChange, colorIntensity = DEFAULT_COLOR_INTENSITY, onColorIntensityChange }) {
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
      {page === 'settings' ? <AppearanceSettings colorTheme={colorTheme} onColorThemeChange={onColorThemeChange} colorIntensity={colorIntensity} onColorIntensityChange={onColorIntensityChange} /> : null}
      {page === 'settings' ? <ConnectedAccounts /> : null}
      <div className="featureStats">{(dynamicStats ?? detail.stats).map((stat) => <div key={stat}><span /><b>{stat}</b></div>)}</div>
      <div className="phaseNote"><Sparkles size={17} /><div><b>Phase 2 gateway ready</b><p>This route now has a server-side boundary. Live provider adapters can replace the mock gateway without redesigning the UI.</p></div></div>
    </section>
  )
}

function AppearanceSettings({ colorTheme, onColorThemeChange, colorIntensity = DEFAULT_COLOR_INTENSITY, onColorIntensityChange }) {
  const activeTheme = COLOR_THEMES.find((theme) => theme.id === colorTheme) ?? COLOR_THEMES[0]
  const darkThemes = COLOR_THEMES.filter((theme) => theme.id !== 'light')
  const [preferredDarkTheme, setPreferredDarkTheme] = useState(colorTheme === 'light' ? 'default' : colorTheme)

  useEffect(() => {
    if (colorTheme !== 'light') setPreferredDarkTheme(colorTheme)
  }, [colorTheme])

  function selectDarkTheme(themeId) {
    setPreferredDarkTheme(themeId)
    onColorThemeChange?.(themeId)
  }

  return (
    <section className="appearanceSettings" aria-labelledby="appearance-settings-title">
      <div className="connectedHead">
        <div><small>APPEARANCE</small><h2 id="appearance-settings-title">Light or dark</h2><p>Choose a bright workspace with dark text, or a dark workspace with white text.</p></div>
        <span><Palette size={16} />Personalize</span>
      </div>
      <div className="appearanceModeGrid" role="radiogroup" aria-label="Appearance mode">
        <button className={`appearanceMode light ${colorTheme === 'light' ? 'selected' : ''}`} type="button" role="radio" aria-checked={colorTheme === 'light'} onClick={() => onColorThemeChange?.('light')}>
          <span className="modePreview" aria-hidden="true"><i /><i /><i /></span>
          <span><b>Light</b><small>White surfaces · dark text</small></span>
          <i className="modeCheck" aria-hidden="true">{colorTheme === 'light' ? <Check size={16} /> : null}</i>
        </button>
        <button className={`appearanceMode dark ${colorTheme !== 'light' ? 'selected' : ''}`} type="button" role="radio" aria-checked={colorTheme !== 'light'} onClick={() => selectDarkTheme(preferredDarkTheme)}>
          <span className="modePreview" aria-hidden="true"><i /><i /><i /></span>
          <span><b>Dark</b><small>Midnight surfaces · white text</small></span>
          <i className="modeCheck" aria-hidden="true">{colorTheme !== 'light' ? <Check size={16} /> : null}</i>
        </button>
      </div>
      <div className="darkPaletteSection">
        <div><b>Color palette</b><small>Choose a color, then move it from dark to white</small></div>
        <div className="darkPaletteGrid" aria-label="Color palette">
          {darkThemes.map((theme) => {
            const selected = colorTheme !== 'light' && theme.id === activeTheme.id
            return (
              <button key={theme.id} className={selected ? 'selected' : ''} type="button" aria-pressed={selected} onClick={() => selectDarkTheme(theme.id)}>
                <span style={{ '--palette-accent': theme.colors[0], '--palette-surface': theme.colors[1], '--palette-secondary': theme.colors[2] }} aria-hidden="true" />
                <b>{theme.name}</b>
                <small>{theme.description}</small>
                {selected ? <Check size={14} /> : null}
              </button>
            )
          })}
        </div>
        {colorTheme !== 'light' ? (
          <label className="darkPaletteIntensity">
            <span><span>Intensity · <b>{activeTheme.name}</b></span><strong>{colorIntensity}%</strong></span>
            <input
              type="range"
              min={MIN_COLOR_INTENSITY}
              max={MAX_COLOR_INTENSITY}
              step={5}
              value={colorIntensity}
              aria-label={`${activeTheme.name} color intensity`}
              aria-valuetext={`${colorIntensity}%`}
              onChange={(event) => onColorIntensityChange?.(Number(event.target.value))}
            />
            <small><span>Darker</span><span>Original</span><span>White</span></small>
          </label>
        ) : null}
      </div>
      <p className="themeStatus" role="status">{colorTheme === 'light' ? 'Light mode active' : colorIntensity >= 140 ? `${activeTheme.name} palette · Light appearance` : `Dark mode · ${activeTheme.name} palette`}</p>
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
  return (
    <section className="connectedAccounts" aria-labelledby="connected-accounts-title">
      <div className="connectedHead">
        <div><small>MAIL & CALENDAR</small><h2 id="connected-accounts-title">Connected accounts</h2><p>Additional mailbox connections are not available yet.</p></div>
        <span><Settings2 size={16} />Not available</span>
      </div>
      <div className="providerGrid">
        {accountProviders.map((provider) => {
          const ProviderIcon = provider.icon
          return (
            <button type="button" key={provider.name} disabled title={`${provider.name} is not available yet`}>
              <i className={`providerIcon ${provider.tone}`}><ProviderIcon size={20} /></i>
              <span><b>{provider.name}</b><small>{provider.detail}</small></span>
              <em>Not available</em>
            </button>
          )
        })}
      </div>
    </section>
  )
}
