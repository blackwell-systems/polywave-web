import { useState, useEffect } from 'react'
import { getConfig } from '../api'

export function useContrast(): [boolean, () => void] {
  const [isHighContrast, setIsHighContrast] = useState<boolean>(false)

  // Load contrast preference from config on mount
  useEffect(() => {
    getConfig().then(config => {
      const contrast = config.appearance?.contrast ?? 'normal'
      setIsHighContrast(contrast === 'high')
    }).catch(() => {})
  }, [])

  // Apply .high-contrast class to <html>
  useEffect(() => {
    if (isHighContrast) {
      document.documentElement.classList.add('high-contrast')
    } else {
      document.documentElement.classList.remove('high-contrast')
    }
  }, [isHighContrast])

  function toggle() {
    const next = !isHighContrast
    setIsHighContrast(next)

    // Persist in background
    getConfig().then(async config => {
      const { saveConfig } = await import('../api')
      await saveConfig({
        ...config,
        appearance: {
          ...config.appearance,
          contrast: next ? 'high' : 'normal'
        }
      })
    }).catch(() => {})
  }

  return [isHighContrast, toggle]
}
