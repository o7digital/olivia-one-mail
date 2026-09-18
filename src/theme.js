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

function rgbToHsl({ r, g, b }) {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const delta = max - min
  const l = (max + min) / 2
  let h = 0
  let s = 0
  if (delta) {
    s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min)
    if (max === rn) h = ((gn - bn) / delta) % 6
    else if (max === gn) h = (bn - rn) / delta + 2
    else h = (rn - gn) / delta + 4
    h *= 60
    if (h < 0) h += 360
  }
  return { h, s: s * 100, l: l * 100 }
}

function hslToRgb({ h, s, l }) {
  const sn = s / 100
  const ln = l / 100
  const c = (1 - Math.abs(2 * ln - 1)) * sn
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = ln - c / 2
  let [rp, gp, bp] = [0, 0, 0]
  if (h < 60) [rp, gp, bp] = [c, x, 0]
  else if (h < 120) [rp, gp, bp] = [x, c, 0]
  else if (h < 180) [rp, gp, bp] = [0, c, x]
  else if (h < 240) [rp, gp, bp] = [0, x, c]
  else if (h < 300) [rp, gp, bp] = [x, 0, c]
  else [rp, gp, bp] = [c, 0, x]
  return { r: Math.round((rp + m) * 255), g: Math.round((gp + m) * 255), b: Math.round((bp + m) * 255) }
}

// Adjusts a theme color's saturation (and slightly its lightness) by a 40-160% intensity factor.
export function adjustColorIntensity(hex, intensityPercent) {
  const factor = clampIntensity(intensityPercent) / 100
  const hsl = rgbToHsl(hexToRgb(hex))
  const nextSaturation = Math.min(100, Math.max(0, hsl.s * factor))
  const nextLightness = Math.min(92, Math.max(8, hsl.l + (factor - 1) * 12))
  const { r, g, b } = hslToRgb({ h: hsl.h, s: nextSaturation, l: nextLightness })
  const toHex = (channel) => channel.toString(16).padStart(2, '0')
  return { hex: `#${toHex(r)}${toHex(g)}${toHex(b)}`, rgb: `${r}, ${g}, ${b}` }
}

