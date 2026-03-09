import { useState, useEffect } from 'react'

export type ThemeId =
  | 'default'
  // light
  | 'github-light'
  | 'solarized-light'
  | 'one-light'
  | 'catppuccin-latte'
  // dark
  | 'gruvbox-dark'
  | 'darcula'
  | 'catppuccin-mocha'
  | 'nord'
  | 'tokyo-night'
  | 'dracula'
  | 'solarized-dark'
  | 'one-dark'

interface ThemeDef {
  id: ThemeId
  label: string
  mode: 'light' | 'dark'
}

const THEMES: ThemeDef[] = [
  // light
  { id: 'github-light',      label: 'GitHub',          mode: 'light' },
  { id: 'solarized-light',   label: 'Solarized',       mode: 'light' },
  { id: 'one-light',         label: 'One Light',        mode: 'light' },
  { id: 'catppuccin-latte',  label: 'Catppuccin Latte', mode: 'light' },
  // dark
  { id: 'gruvbox-dark',      label: 'Gruvbox',          mode: 'dark' },
  { id: 'darcula',           label: 'Darcula',          mode: 'dark' },
  { id: 'catppuccin-mocha',  label: 'Catppuccin',       mode: 'dark' },
  { id: 'nord',              label: 'Nord',             mode: 'dark' },
  { id: 'tokyo-night',       label: 'Tokyo Night',      mode: 'dark' },
  { id: 'dracula',           label: 'Dracula',          mode: 'dark' },
  { id: 'solarized-dark',    label: 'Solarized Dark',   mode: 'dark' },
  { id: 'one-dark',          label: 'One Dark',         mode: 'dark' },
]

const ALL_THEME_CLASSES = THEMES.map(t => `theme-${t.id}`)
const STORAGE_KEY = 'saw-theme'

function isDarkMode(): boolean {
  return document.documentElement.classList.contains('dark')
}

function applyTheme(id: ThemeId) {
  const html = document.documentElement
  ALL_THEME_CLASSES.forEach(cls => html.classList.remove(cls))
  if (id !== 'default') {
    html.classList.add(`theme-${id}`)
  }
}

function themeMode(id: ThemeId): 'light' | 'dark' | 'default' {
  if (id === 'default') return 'default'
  return THEMES.find(t => t.id === id)?.mode ?? 'dark'
}

export default function ThemePicker(): JSX.Element {
  const [theme, setTheme] = useState<ThemeId>(() => {
    return (localStorage.getItem(STORAGE_KEY) as ThemeId) ?? 'default'
  })
  const [dark, setDark] = useState<boolean>(isDarkMode)

  // Watch for dark class changes on <html> (triggered by DarkModeToggle)
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setDark(isDarkMode())
    })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  // When mode flips, reset theme if it doesn't belong to the new mode
  useEffect(() => {
    const mode = themeMode(theme)
    if (mode === 'default') return
    const nowDark = dark
    if ((mode === 'light' && nowDark) || (mode === 'dark' && !nowDark)) {
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
    applyTheme((localStorage.getItem(STORAGE_KEY) as ThemeId) ?? 'default')
  }, [])

  const visible = THEMES.filter(t => (dark ? t.mode === 'dark' : t.mode === 'light'))

  return (
    <select
      value={theme}
      onChange={e => setTheme(e.target.value as ThemeId)}
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
