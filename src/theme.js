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

export const DEFAULT_COLOR_INTENSITY = 100
export const MIN_COLOR_INTENSITY = 40
export const MAX_COLOR_INTENSITY = 160

function clampIntensity(value) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return DEFAULT_COLOR_INTENSITY
  return Math.min(MAX_COLOR_INTENSITY, Math.max(MIN_COLOR_INTENSITY, Math.round(numeric)))
}

function intensityStorageKey(email, themeId) {
  return `olivia-one-color-intensity:${String(email || 'workspace').trim().toLowerCase()}:${themeId}`
}

export function loadColorIntensity(email, themeId) {
  try {
    const stored = window.localStorage.getItem(intensityStorageKey(email, themeId))
    return stored === null ? DEFAULT_COLOR_INTENSITY : clampIntensity(stored)
  } catch {
    return DEFAULT_COLOR_INTENSITY
  }
}

export function saveColorIntensity(email, themeId, value) {
  const nextIntensity = clampIntensity(value)
  try {
    window.localStorage.setItem(intensityStorageKey(email, themeId), String(nextIntensity))
  } catch {
    // Intensity still applies for the current session when storage is unavailable.
  }
  return nextIntensity
}

function hexToRgb(hex) {
  const normalized = hex.replace('#', '')
  const expanded = normalized.length === 3 ? normalized.split('').map((char) => char + char).join('') : normalized
  const bigint = parseInt(expanded, 16)
  return { r: (bigint >> 16) & 255, g: (bigint >> 8) & 255, b: bigint & 255 }
}

function mixChannel(channel, target, ratio) {
  return Math.round(channel + (target - channel) * ratio)
}

// 100% keeps the original color. Above 100% blends toward white (lighter); below 100% blends toward black (darker).
// This is a straight, monotonic blend (no saturation/hue math) so the result always moves in the expected direction.
function intensityBlend(intensityPercent) {
  const factor = clampIntensity(intensityPercent) / 100
  const ratio = Math.min(0.82, (Math.abs(factor - 1) / 0.6) * 0.82)
  return { ratio, target: factor > 1 ? 255 : 0 }
}

export function adjustColorIntensity(hex, intensityPercent) {
  const { r, g, b } = hexToRgb(hex)
  const { ratio, target } = intensityBlend(intensityPercent)
  const rr = mixChannel(r, target, ratio)
  const gg = mixChannel(g, target, ratio)
  const bb = mixChannel(b, target, ratio)
  const toHex = (channel) => channel.toString(16).padStart(2, '0')
  return { hex: `#${toHex(rr)}${toHex(gg)}${toHex(bb)}`, rgb: `${rr}, ${gg}, ${bb}` }
}

function adjustRgbaIntensity([r, g, b, a], intensityPercent) {
  const { ratio, target } = intensityBlend(intensityPercent)
  const rr = mixChannel(r, target, ratio)
  const gg = mixChannel(g, target, ratio)
  const bb = mixChannel(b, target, ratio)
  return `rgba(${rr}, ${gg}, ${bb}, ${a})`
}

// Base (100%) palette values, matching the .app[data-theme='X'] rules in styles/index.css.
const THEME_PALETTES = {
  default: { accent: '#39d9ff', secondary: '#8b5cf6', bgStart: '#0d2035', bgMid: '#07111f', bgEnd: '#0b1a2e', topbar: [6, 16, 29, .93], cardStart: [15, 34, 55, .98], cardEnd: [8, 24, 42, .97], actionStart: '#159ab3', actionEnd: '#08708d', selectedStart: [23, 74, 112, .58], selectedEnd: [13, 44, 75, .66] },
  green: { accent: '#59e59b', secondary: '#22c55e', bgStart: '#10291f', bgMid: '#07150f', bgEnd: '#0c2118', topbar: [7, 22, 15, .94], cardStart: [16, 41, 31, .98], cardEnd: [8, 28, 20, .97], actionStart: '#269f69', actionEnd: '#16764b', selectedStart: [29, 101, 73, .58], selectedEnd: [16, 67, 47, .68] },
  gray: { accent: '#c7d0da', secondary: '#7f8fa4', bgStart: '#222831', bgMid: '#11151a', bgEnd: '#1b2027', topbar: [17, 21, 26, .95], cardStart: [37, 43, 51, .98], cardEnd: [22, 27, 32, .97], actionStart: '#687684', actionEnd: '#46515e', selectedStart: [64, 75, 87, .65], selectedEnd: [42, 50, 59, .72] },
  orange: { accent: '#ffb454', secondary: '#f97316', bgStart: '#2a1c12', bgMid: '#160e09', bgEnd: '#21140b', topbar: [25, 15, 8, .95], cardStart: [44, 30, 20, .98], cardEnd: [26, 16, 11, .97], actionStart: '#d77824', actionEnd: '#a94a10', selectedStart: [122, 69, 26, .62], selectedEnd: [76, 40, 16, .7] },
  violet: { accent: '#b69cff', secondary: '#8b5cf6', bgStart: '#21183a', bgMid: '#100b1e', bgEnd: '#1b1230', topbar: [17, 11, 31, .95], cardStart: [36, 26, 61, .98], cardEnd: [21, 15, 39, .97], actionStart: '#7f5ddb', actionEnd: '#5c38b6', selectedStart: [74, 50, 119, .64], selectedEnd: [47, 31, 78, .72] },
}

// Recomputes every theme CSS variable at the given intensity, so the whole
// app (background, cards, buttons) gets lighter/darker, not just the accent.
export function buildThemeCssVars(themeId, intensityPercent) {
  const base = THEME_PALETTES[themeId] ?? THEME_PALETTES.default
  const accent = adjustColorIntensity(base.accent, intensityPercent)
  const secondary = adjustColorIntensity(base.secondary, intensityPercent)
  const bgStart = adjustColorIntensity(base.bgStart, intensityPercent)
  const bgMid = adjustColorIntensity(base.bgMid, intensityPercent)
  const bgEnd = adjustColorIntensity(base.bgEnd, intensityPercent)
  const actionStart = adjustColorIntensity(base.actionStart, intensityPercent)
  const actionEnd = adjustColorIntensity(base.actionEnd, intensityPercent)
  return {
    '--theme-accent': accent.hex,
    '--theme-accent-rgb': accent.rgb,
    '--theme-secondary-rgb': secondary.rgb,
    '--theme-bg-start': bgStart.hex,
    '--theme-bg-mid': bgMid.hex,
    '--theme-bg-end': bgEnd.hex,
    '--theme-topbar': adjustRgbaIntensity(base.topbar, intensityPercent),
    '--theme-card-start': adjustRgbaIntensity(base.cardStart, intensityPercent),
    '--theme-card-end': adjustRgbaIntensity(base.cardEnd, intensityPercent),
    '--theme-action-start': actionStart.hex,
    '--theme-action-end': actionEnd.hex,
    '--theme-selected-start': adjustRgbaIntensity(base.selectedStart, intensityPercent),
    '--theme-selected-end': adjustRgbaIntensity(base.selectedEnd, intensityPercent),
  }
}

