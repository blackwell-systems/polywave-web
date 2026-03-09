import { useState, useEffect } from 'react'
import { THEMES, ThemeDef } from '../lib/themes'

export type ThemeId = string  // open — any theme id from themes.ts, plus 'default'

const ALL_THEME_CLASSES = THEMES.map(t => `theme-${t.id}`)
const STORAGE_KEY = 'saw-theme'

function isDarkMode(): boolean {
  return document.documentElement.classList.contains('dark')
}

function applyTheme(id: string) {
  const html = document.documentElement
  ALL_THEME_CLASSES.forEach(cls => html.classList.remove(cls))
  if (id !== 'default') {
    html.classList.add(`theme-${id}`)
  }
}

function themeMode(id: string): 'light' | 'dark' | 'default' {
  if (id === 'default') return 'default'
  return THEMES.find(t => t.id === id)?.mode ?? 'dark'
}

export default function ThemePicker(): JSX.Element {
  const [theme, setTheme] = useState<string>(() => {
    return localStorage.getItem(STORAGE_KEY) ?? 'default'
  })
  const [dark, setDark] = useState<boolean>(isDarkMode)

  // Watch for dark class changes (triggered by DarkModeToggle)
  useEffect(() => {
    const observer = new MutationObserver(() => setDark(isDarkMode()))
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  // Reset theme to default when mode flips and current theme doesn't belong to new mode
  useEffect(() => {
    const mode = themeMode(theme)
    if (mode === 'default') return
    if ((mode === 'light' && dark) || (mode === 'dark' && !dark)) {
      setTheme('default')
    }
  }, [dark])

  // Apply theme class + persist whenever theme changes
  useEffect(() => {
    applyTheme(theme)
    localStorage.setItem(STORAGE_KEY, theme)
  }, [theme])

  // Apply on mount (handles page reload)
  useEffect(() => {
    applyTheme(localStorage.getItem(STORAGE_KEY) ?? 'default')
  }, [])

  const visible: ThemeDef[] = THEMES.filter(t => dark ? t.mode === 'dark' : t.mode === 'light')

  return (
    <select
      value={theme}
      onChange={e => setTheme(e.target.value)}
      className="text-xs px-2 py-1 rounded-md border border-border bg-background text-foreground hover:bg-muted transition-colors cursor-pointer"
      title="Color theme"
    >
      <option value="default">Default</option>
      {visible.map(t => (
        <option key={t.id} value={t.id}>{t.label}</option>
      ))}
    </select>
  )
}
