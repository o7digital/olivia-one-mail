export const COLOR_THEMES = [
  { id: 'default', name: 'Olivia', description: 'The original cyan and midnight palette.', colors: ['#39d9ff', '#0d2035', '#8b5cf6'] },
  { id: 'green', name: 'Green', description: 'A calm emerald workspace.', colors: ['#59e59b', '#10291f', '#22c55e'] },
  { id: 'gray', name: 'Graphite', description: 'A neutral, understated gray palette.', colors: ['#c7d0da', '#252b33', '#7f8fa4'] },
  { id: 'orange', name: 'Orange', description: 'A warm amber and copper workspace.', colors: ['#ffb454', '#2c1e14', '#f97316'] },
  { id: 'violet', name: 'Violet', description: 'A rich purple, low-light palette.', colors: ['#b69cff', '#241a3d', '#8b5cf6'] },
]

const THEME_IDS = new Set(COLOR_THEMES.map((theme) => theme.id))

function storageKey(email) {
  return `olivia-one-color-theme:${String(email || 'workspace').trim().toLowerCase()}`
}

export function loadColorTheme(email) {
  try {
    const storedTheme = window.localStorage.getItem(storageKey(email))
    return THEME_IDS.has(storedTheme) ? storedTheme : 'default'
  } catch {
    return 'default'
  }
}

export function saveColorTheme(email, theme) {
  const nextTheme = THEME_IDS.has(theme) ? theme : 'default'
  try {
    window.localStorage.setItem(storageKey(email), nextTheme)
  } catch {
    // The active theme still works when browser storage is unavailable.
  }
  return nextTheme
}
