import { useState, useEffect } from 'react'
import { getConfig, saveConfig } from '../api'

export function useDarkMode(): [boolean, () => void] {
  function getInitialDark(): boolean {
    const stored = localStorage.getItem('theme')
    if (stored === 'dark') return true
    if (stored === 'light') return false
    return true // default to dark mode
  }

  const [isDark, setIsDark] = useState<boolean>(getInitialDark)

  // Load theme from config on mount
  useEffect(() => {
    getConfig().then(config => {
      const theme = config.appearance?.theme ?? 'system'
      if (theme === 'dark') {
        setIsDark(true)
      } else if (theme === 'light') {
        setIsDark(false)
      } else {
        // system: use stored preference or default
        setIsDark(getInitialDark())
      }
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }

    // Save to config file
    getConfig().then(config => {
      const updated = {
        ...config,
        appearance: {
          ...config.appearance,
          theme: (isDark ? 'dark' : 'light') as 'dark' | 'light' | 'system'
        }
      }
      return saveConfig(updated)
    }).catch(() => {})
  }, [isDark])

  function toggle() {
    setIsDark(prev => !prev)
  }

  return [isDark, toggle]
}
