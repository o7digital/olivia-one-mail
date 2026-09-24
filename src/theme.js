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
    // Intensity still applies for the current session when browser storage is unavailable.
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

function toHex({ r, g, b }) {
  const channel = (value) => value.toString(16).padStart(2, '0')
  return `#${channel(r)}${channel(g)}${channel(b)}`
}

function mixHex(from, to, ratio) {
  const source = hexToRgb(from)
  const target = hexToRgb(to)
  const rgb = {
    r: mixChannel(source.r, target.r, ratio),
    g: mixChannel(source.g, target.g, ratio),
    b: mixChannel(source.b, target.b, ratio),
  }
  return { hex: toHex(rgb), rgb: `${rgb.r}, ${rgb.g}, ${rgb.b}` }
}

function mixRgba([r, g, b, a], [tr, tg, tb, ta], ratio) {
  return `rgba(${mixChannel(r, tr, ratio)}, ${mixChannel(g, tg, ratio)}, ${mixChannel(b, tb, ratio)}, ${a + (ta - a) * ratio})`
}

// Keep the original 40–160 control range while limiting the color blend enough
// to preserve readable contrast at both ends of the slider.
function intensityBlend(intensityPercent) {
  const factor = clampIntensity(intensityPercent) / 100
  const ratio = Math.min(0.2, (Math.abs(factor - 1) / 0.6) * 0.2)
  return { ratio, target: factor > 1 ? 255 : 0 }
}

export function adjustColorIntensity(hex, intensityPercent) {
  const { r, g, b } = hexToRgb(hex)
  const { ratio, target } = intensityBlend(intensityPercent)
  const rr = mixChannel(r, target, ratio)
  const gg = mixChannel(g, target, ratio)
  const bb = mixChannel(b, target, ratio)
  return { hex: toHex({ r: rr, g: gg, b: bb }), rgb: `${rr}, ${gg}, ${bb}` }
}

function adjustRgbaIntensity([r, g, b, a], intensityPercent) {
  const { ratio, target } = intensityBlend(intensityPercent)
  const rr = mixChannel(r, target, ratio)
  const gg = mixChannel(g, target, ratio)
  const bb = mixChannel(b, target, ratio)
  return `rgba(${rr}, ${gg}, ${bb}, ${a})`
}

const THEME_PALETTES = {
  default: { accent: '#39d9ff', lightAccent: '#087da3', secondary: '#8b5cf6', lightSecondary: '#7652d5', bgStart: '#0d2035', bgMid: '#07111f', bgEnd: '#0b1a2e', topbar: [6, 16, 29, .93], cardStart: [15, 34, 55, .98], cardEnd: [8, 24, 42, .97], actionStart: '#159ab3', actionEnd: '#08708d', selectedStart: [23, 74, 112, .58], selectedEnd: [13, 44, 75, .66] },
  light: { accent: '#087da3', secondary: '#7652d5', bgStart: '#f8fafc', bgMid: '#edf2f7', bgEnd: '#e7edf4', topbar: [255, 255, 255, .96], cardStart: [255, 255, 255, .98], cardEnd: [247, 249, 252, .98], actionStart: '#1687a7', actionEnd: '#086b87', selectedStart: [221, 241, 248, .9], selectedEnd: [231, 239, 250, .95] },
  green: { accent: '#59e59b', lightAccent: '#16764b', secondary: '#22c55e', lightSecondary: '#15803d', bgStart: '#10291f', bgMid: '#07150f', bgEnd: '#0c2118', topbar: [7, 22, 15, .94], cardStart: [16, 41, 31, .98], cardEnd: [8, 28, 20, .97], actionStart: '#269f69', actionEnd: '#16764b', selectedStart: [29, 101, 73, .58], selectedEnd: [16, 67, 47, .68] },
  gray: { accent: '#c7d0da', lightAccent: '#526173', secondary: '#7f8fa4', lightSecondary: '#64748b', bgStart: '#222831', bgMid: '#11151a', bgEnd: '#1b2027', topbar: [17, 21, 26, .95], cardStart: [37, 43, 51, .98], cardEnd: [22, 27, 32, .97], actionStart: '#687684', actionEnd: '#46515e', selectedStart: [64, 75, 87, .65], selectedEnd: [42, 50, 59, .72] },
  orange: { accent: '#ffb454', lightAccent: '#a94a10', secondary: '#f97316', lightSecondary: '#c2410c', bgStart: '#2a1c12', bgMid: '#160e09', bgEnd: '#21140b', topbar: [25, 15, 8, .95], cardStart: [44, 30, 20, .98], cardEnd: [26, 16, 11, .97], actionStart: '#d77824', actionEnd: '#a94a10', selectedStart: [122, 69, 26, .62], selectedEnd: [76, 40, 16, .7] },
  violet: { accent: '#b69cff', lightAccent: '#6541b5', secondary: '#8b5cf6', lightSecondary: '#6d28d9', bgStart: '#21183a', bgMid: '#100b1e', bgEnd: '#1b1230', topbar: [17, 11, 31, .95], cardStart: [36, 26, 61, .98], cardEnd: [21, 15, 39, .97], actionStart: '#7f5ddb', actionEnd: '#5c38b6', selectedStart: [74, 50, 119, .64], selectedEnd: [47, 31, 78, .72] },
}

const WHITE_SURFACES = {
  bgStart: '#ffffff', bgMid: '#ffffff', bgEnd: '#ffffff',
  topbar: [255, 255, 255, .98], cardStart: [255, 255, 255, .99], cardEnd: [255, 255, 255, .99],
  selectedStart: [232, 242, 247, .92], selectedEnd: [240, 244, 249, .96],
}

export function buildThemeCssVars(themeId, intensityPercent = DEFAULT_COLOR_INTENSITY) {
  const base = THEME_PALETTES[themeId] ?? THEME_PALETTES.default
  const intensity = themeId === 'light' ? DEFAULT_COLOR_INTENSITY : clampIntensity(intensityPercent)
  if (themeId !== 'light' && intensity > DEFAULT_COLOR_INTENSITY) {
    const ratio = ((intensity - DEFAULT_COLOR_INTENSITY) / (MAX_COLOR_INTENSITY - DEFAULT_COLOR_INTENSITY)) ** 2
    const accent = mixHex(base.accent, base.lightAccent, ratio)
    const secondary = mixHex(base.secondary, base.lightSecondary, ratio)
    const actionStart = mixHex(base.actionStart, base.lightAccent, ratio)
    const actionEnd = mixHex(base.actionEnd, base.lightAccent, ratio)
    return {
      '--theme-accent': accent.hex,
      '--theme-accent-rgb': accent.rgb,
      '--theme-secondary-rgb': secondary.rgb,
      '--theme-bg-start': mixHex(base.bgStart, WHITE_SURFACES.bgStart, ratio).hex,
      '--theme-bg-mid': mixHex(base.bgMid, WHITE_SURFACES.bgMid, ratio).hex,
      '--theme-bg-end': mixHex(base.bgEnd, WHITE_SURFACES.bgEnd, ratio).hex,
      '--theme-topbar': mixRgba(base.topbar, WHITE_SURFACES.topbar, ratio),
      '--theme-card-start': mixRgba(base.cardStart, WHITE_SURFACES.cardStart, ratio),
      '--theme-card-end': mixRgba(base.cardEnd, WHITE_SURFACES.cardEnd, ratio),
      '--theme-action-start': actionStart.hex,
      '--theme-action-end': actionEnd.hex,
      '--theme-selected-start': mixRgba(base.selectedStart, WHITE_SURFACES.selectedStart, ratio),
      '--theme-selected-end': mixRgba(base.selectedEnd, WHITE_SURFACES.selectedEnd, ratio),
    }
  }
  const accent = adjustColorIntensity(base.accent, intensity)
  const secondary = adjustColorIntensity(base.secondary, intensity)
  const bgStart = adjustColorIntensity(base.bgStart, intensity)
  const bgMid = adjustColorIntensity(base.bgMid, intensity)
  const bgEnd = adjustColorIntensity(base.bgEnd, intensity)
  const actionStart = adjustColorIntensity(base.actionStart, intensity)
  const actionEnd = adjustColorIntensity(base.actionEnd, intensity)
  return {
    '--theme-accent': accent.hex,
    '--theme-accent-rgb': accent.rgb,
    '--theme-secondary-rgb': secondary.rgb,
    '--theme-bg-start': bgStart.hex,
    '--theme-bg-mid': bgMid.hex,
    '--theme-bg-end': bgEnd.hex,
    '--theme-topbar': adjustRgbaIntensity(base.topbar, intensity),
    '--theme-card-start': adjustRgbaIntensity(base.cardStart, intensity),
    '--theme-card-end': adjustRgbaIntensity(base.cardEnd, intensity),
    '--theme-action-start': actionStart.hex,
    '--theme-action-end': actionEnd.hex,
    '--theme-selected-start': adjustRgbaIntensity(base.selectedStart, intensity),
    '--theme-selected-end': adjustRgbaIntensity(base.selectedEnd, intensity),
  }
}
