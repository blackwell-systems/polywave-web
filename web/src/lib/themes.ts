// Theme system for Polywave UI.
// Themes are sourced from Base16 (tinted-theming/schemes, MIT).
// To refresh: npm run themes:update  (runs scripts/fetch-base16-themes.mjs)

import { BASE16_THEMES } from './base16-themes'

export interface ThemeDef {
  id: string
  label: string
  mode: 'light' | 'dark'
  vars: Record<string, string>
}

// All available themes — generated from Base16 registry
export const THEMES: ThemeDef[] = BASE16_THEMES

/**
 * Inject all theme CSS vars as a <style> tag into <head> at app startup.
 * Runtime injection bypasses Tailwind's build-time purging entirely.
 */
export function injectThemeStyles(): void {
  if (document.getElementById('polywave-themes')) return

  const css = THEMES.map(t => {
    const selector = t.mode === 'dark' ? `.dark.theme-${t.id}` : `.theme-${t.id}`
    const vars = Object.entries(t.vars).map(([k, v]) => `  ${k}: ${v};`).join('\n')
    return `${selector} {\n${vars}\n}`
  }).join('\n\n')

  const style = document.createElement('style')
  style.id = 'polywave-themes'
  style.textContent = css
  document.head.appendChild(style)
}

/** Convert a stored HSL channel string "H S% L%" to a CSS hsl() color for display. */
export function varToHsl(v: string): string {
  return `hsl(${v})`
}
