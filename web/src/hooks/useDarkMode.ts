import { useState, useEffect } from 'react'
import { getConfig } from '../api'

export function useDarkMode(): [boolean, () => void] {
  const [isDark, setIsDark] = useState<boolean>(() => {
    const t = localStorage.getItem('saw-theme')
    if (t === 'dark') return true
    if (t === 'light') return false
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })
  const [themeMode, setThemeMode] = useState<'system' | 'light' | 'dark'>(() => {
    return (localStorage.getItem('saw-theme') as 'system' | 'light' | 'dark') ?? 'system'
  })

  function getSystemDark(): boolean {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  }

  // Load theme from config on mount
  useEffect(() => {
    getConfig().then(config => {
      const theme = config.appearance?.theme ?? 'system'
      setThemeMode(theme)
      localStorage.setItem('saw-theme', theme)

      if (theme === 'dark') {
        setIsDark(true)
      } else if (theme === 'light') {
        setIsDark(false)
      } else {
        // system: follow OS preference
        setIsDark(getSystemDark())
      }
    }).catch(() => {
      setIsDark(getSystemDark())
    })
  }, [])

  // Watch for system theme changes when in system mode
  useEffect(() => {
    if (themeMode !== 'system') return

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e: MediaQueryListEvent) => setIsDark(e.matches)
    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [themeMode])

  // Apply dark class to document
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [isDark])

  // Toggle flips between light and dark directly.
  // The system/light/dark tri-state is available in Settings.
  function toggle() {
    const nextTheme: 'light' | 'dark' = isDark ? 'light' : 'dark'
    setThemeMode(nextTheme)
    setIsDark(nextTheme === 'dark')
    localStorage.setItem('saw-theme', nextTheme)

    // Persist in background — don't block the UI
    getConfig().then(async config => {
      const { saveConfig } = await import('../api')
      await saveConfig({
        ...config,
        appearance: { ...config.appearance, theme: nextTheme }
      })
    }).catch(() => {})
  }

  return [isDark, toggle]
}
