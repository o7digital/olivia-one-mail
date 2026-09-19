export const COLOR_THEMES = [
  { id: 'light', name: 'Light', description: 'A bright workspace with dark, readable text.', colors: ['#087da3', '#f8fafc', '#7652d5'] },
  { id: 'default', name: 'Olivia', description: 'Cyan and midnight.', colors: ['#39d9ff', '#0d2035', '#8b5cf6'] },
  { id: 'green', name: 'Green', description: 'Deep emerald.', colors: ['#59e59b', '#10291f', '#22c55e'] },
  { id: 'gray', name: 'Graphite', description: 'Neutral charcoal.', colors: ['#c7d0da', '#252b33', '#7f8fa4'] },
  { id: 'orange', name: 'Orange', description: 'Amber and copper.', colors: ['#ffb454', '#2c1e14', '#f97316'] },
  { id: 'violet', name: 'Violet', description: 'Rich purple.', colors: ['#b69cff', '#241a3d', '#8b5cf6'] },
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

function hexToRgb(hex) {
  const normalized = hex.replace('#', '')
  const expanded = normalized.length === 3 ? normalized.split('').map((char) => char + char).join('') : normalized
  const bigint = parseInt(expanded, 16)
  return { r: (bigint >> 16) & 255, g: (bigint >> 8) & 255, b: bigint & 255 }
}

const THEME_PALETTES = {
  default: { accent: '#39d9ff', secondary: '#8b5cf6', bgStart: '#0d2035', bgMid: '#07111f', bgEnd: '#0b1a2e', topbar: [6, 16, 29, .93], cardStart: [15, 34, 55, .98], cardEnd: [8, 24, 42, .97], actionStart: '#159ab3', actionEnd: '#08708d', selectedStart: [23, 74, 112, .58], selectedEnd: [13, 44, 75, .66] },
  light: { accent: '#087da3', secondary: '#7652d5', bgStart: '#f8fafc', bgMid: '#edf2f7', bgEnd: '#e7edf4', topbar: [255, 255, 255, .96], cardStart: [255, 255, 255, .98], cardEnd: [247, 249, 252, .98], actionStart: '#1687a7', actionEnd: '#086b87', selectedStart: [221, 241, 248, .9], selectedEnd: [231, 239, 250, .95] },
  green: { accent: '#59e59b', secondary: '#22c55e', bgStart: '#10291f', bgMid: '#07150f', bgEnd: '#0c2118', topbar: [7, 22, 15, .94], cardStart: [16, 41, 31, .98], cardEnd: [8, 28, 20, .97], actionStart: '#269f69', actionEnd: '#16764b', selectedStart: [29, 101, 73, .58], selectedEnd: [16, 67, 47, .68] },
  gray: { accent: '#c7d0da', secondary: '#7f8fa4', bgStart: '#222831', bgMid: '#11151a', bgEnd: '#1b2027', topbar: [17, 21, 26, .95], cardStart: [37, 43, 51, .98], cardEnd: [22, 27, 32, .97], actionStart: '#687684', actionEnd: '#46515e', selectedStart: [64, 75, 87, .65], selectedEnd: [42, 50, 59, .72] },
  orange: { accent: '#ffb454', secondary: '#f97316', bgStart: '#2a1c12', bgMid: '#160e09', bgEnd: '#21140b', topbar: [25, 15, 8, .95], cardStart: [44, 30, 20, .98], cardEnd: [26, 16, 11, .97], actionStart: '#d77824', actionEnd: '#a94a10', selectedStart: [122, 69, 26, .62], selectedEnd: [76, 40, 16, .7] },
  violet: { accent: '#b69cff', secondary: '#8b5cf6', bgStart: '#21183a', bgMid: '#100b1e', bgEnd: '#1b1230', topbar: [17, 11, 31, .95], cardStart: [36, 26, 61, .98], cardEnd: [21, 15, 39, .97], actionStart: '#7f5ddb', actionEnd: '#5c38b6', selectedStart: [74, 50, 119, .64], selectedEnd: [47, 31, 78, .72] },
}

export function buildThemeCssVars(themeId) {
  const base = THEME_PALETTES[themeId] ?? THEME_PALETTES.default
  const accent = hexToRgb(base.accent)
  const secondary = hexToRgb(base.secondary)
  return {
    '--theme-accent': base.accent,
    '--theme-accent-rgb': `${accent.r}, ${accent.g}, ${accent.b}`,
    '--theme-secondary-rgb': `${secondary.r}, ${secondary.g}, ${secondary.b}`,
    '--theme-bg-start': base.bgStart,
    '--theme-bg-mid': base.bgMid,
    '--theme-bg-end': base.bgEnd,
    '--theme-topbar': `rgba(${base.topbar.join(', ')})`,
    '--theme-card-start': `rgba(${base.cardStart.join(', ')})`,
    '--theme-card-end': `rgba(${base.cardEnd.join(', ')})`,
    '--theme-action-start': base.actionStart,
    '--theme-action-end': base.actionEnd,
    '--theme-selected-start': `rgba(${base.selectedStart.join(', ')})`,
    '--theme-selected-end': `rgba(${base.selectedEnd.join(', ')})`,
  }
}
