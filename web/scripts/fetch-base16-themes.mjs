/**
 * Fetch Base16 color schemes from tinted-theming/schemes and generate
 * web/src/lib/base16-themes.ts
 *
 * Usage: node scripts/fetch-base16-themes.mjs
 *
 * Source: https://github.com/tinted-theming/schemes (MIT license)
 * Scheme spec: https://github.com/tinted-theming/home/blob/main/styling.md
 */

import { writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dir = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dir, '../src/lib/base16-themes.ts')

const BRANCH = 'spec-0.11'
const API_URL = `https://api.github.com/repos/tinted-theming/schemes/contents/base16?ref=${BRANCH}`
const RAW_BASE = `https://raw.githubusercontent.com/tinted-theming/schemes/${BRANCH}/base16/`

// ── Parsers ──────────────────────────────────────────────────────────────────

function parseYaml(text) {
  const str = (key) => {
    const m = text.match(new RegExp(`^[ \\t]*${key}:\\s*["']?([^"'\\n]+?)["']?\\s*$`, 'm'))
    return m ? m[1].trim() : ''
  }
  const name    = str('name')
  const variant = str('variant')  // 'dark' | 'light' — present in spec-0.11
  const author  = str('author')

  const palette = {}
  const re = /base([0-9A-Fa-f]{2}):\s*["']?#?([0-9a-fA-F]{6})["']?/g
  let m
  while ((m = re.exec(text)) !== null) {
    palette[`base${m[1].toUpperCase()}`] = m[2].toLowerCase()
  }

  return { name, variant, author, palette }
}

// ── Color math ───────────────────────────────────────────────────────────────

function hexToHsl(hex) {
  const r = parseInt(hex.slice(0, 2), 16) / 255
  const g = parseInt(hex.slice(2, 4), 16) / 255
  const b = parseInt(hex.slice(4, 6), 16) / 255

  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  const l = (max + min) / 2

  if (max === min) return `0 0% ${Math.round(l * 100)}%`

  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h = max === r ? ((g - b) / d + (g < b ? 6 : 0)) / 6
        : max === g ? ((b - r) / d + 2) / 6
                    : ((r - g) / d + 4) / 6

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`
}

function hexLightness(hex) {
  const r = parseInt(hex.slice(0, 2), 16) / 255
  const g = parseInt(hex.slice(2, 4), 16) / 255
  const b = parseInt(hex.slice(4, 6), 16) / 255
  return ((Math.max(r, g, b) + Math.min(r, g, b)) / 2) * 100
}

function slugify(name) {
  return name.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// ── Conversion ───────────────────────────────────────────────────────────────

function convertBase16(scheme) {
  const { name, variant, palette } = scheme
  if (Object.keys(palette).length < 16) return null  // incomplete scheme

  // Determine mode: trust 'variant' field if present, otherwise infer from base00 lightness
  const isDark = variant === 'dark'
    ? true
    : variant === 'light'
      ? false
      : hexLightness(palette.BASE00 ?? palette.base00 ?? '000000') < 50

  // Normalise keys — spec uses uppercase BASE00..BASE0F
  const p = {}
  for (const [k, v] of Object.entries(palette)) {
    p[k.toUpperCase()] = v
  }

  const bg   = p.BASE00
  const fg   = p.BASE05
  const card = p.BASE01
  const sel  = p.BASE02
  const comm = p.BASE03  // comments / muted
  const dark4= p.BASE04  // slightly brighter muted-foreground

  return {
    id:    slugify(name),
    label: name,
    mode:  isDark ? 'dark' : 'light',
    vars: {
      '--background':             hexToHsl(bg),
      '--foreground':             hexToHsl(fg),
      '--card':                   hexToHsl(card),
      '--card-foreground':        hexToHsl(fg),
      '--muted':                  hexToHsl(card),
      '--muted-foreground':       hexToHsl(isDark ? dark4 : comm),
      '--border':                 hexToHsl(sel),
      '--input':                  hexToHsl(card),
      '--ring':                   hexToHsl(p.BASE0D),
      '--primary':                hexToHsl(p.BASE0D),   // functions / headings
      '--primary-foreground':     hexToHsl(isDark ? p.BASE07 : bg),
      '--accent':                 hexToHsl(sel),
      '--accent-foreground':      hexToHsl(fg),
      '--secondary':              hexToHsl(sel),
      '--secondary-foreground':   hexToHsl(fg),
      '--destructive':            hexToHsl(p.BASE08),   // variables / deleted (red)
      '--destructive-foreground': hexToHsl(isDark ? p.BASE07 : bg),
      '--popover':                hexToHsl(card),
      '--popover-foreground':     hexToHsl(fg),
    },
  }
}

// ── Fetch & generate ─────────────────────────────────────────────────────────

console.log(`Fetching scheme list from GitHub (branch: ${BRANCH})…`)
const listRes = await fetch(API_URL, {
  headers: { 'User-Agent': 'polywave-theme-fetcher' },
})
if (!listRes.ok) throw new Error(`GitHub API error: ${listRes.status} ${listRes.statusText}`)

const files = await listRes.json()
const yamlFiles = files.filter(f => f.name.endsWith('.yaml'))
console.log(`Found ${yamlFiles.length} schemes`)

const themes = []
let ok = 0, skipped = 0

for (const file of yamlFiles) {
  const text = await fetch(RAW_BASE + file.name).then(r => r.text())
  const parsed = parseYaml(text)
  const theme  = convertBase16(parsed)
  if (theme) {
    themes.push(theme)
    ok++
  } else {
    skipped++
    console.warn(`  skip: ${file.name} (incomplete palette)`)
  }
}

// Sort: light first, then dark; alphabetically within each group
themes.sort((a, b) => {
  if (a.mode !== b.mode) return a.mode === 'light' ? -1 : 1
  return a.label.localeCompare(b.label)
})

console.log(`Converted ${ok} schemes (${skipped} skipped)`)

// ── Write output ─────────────────────────────────────────────────────────────

const themeJson = JSON.stringify(themes, null, 2)
const ts = `// AUTO-GENERATED by scripts/fetch-base16-themes.mjs
// Source: https://github.com/tinted-theming/schemes (MIT)
// Run \`npm run themes:update\` to refresh.
// ${ok} Base16 schemes — ${themes.filter(t => t.mode === 'light').length} light, ${themes.filter(t => t.mode === 'dark').length} dark

import type { ThemeDef } from './themes'

export const BASE16_THEMES: ThemeDef[] = ${themeJson}
`

writeFileSync(OUT, ts, 'utf8')
console.log(`Written → ${OUT}`)
