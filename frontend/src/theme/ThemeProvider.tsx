import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ThemeContext, type ThemeMode } from './ThemeContext'
import { applyTheme, currentMode, systemTheme, writeMode } from './storage'

// zapytanie medialne trzyma sie osobno od trybu, bo w trybie systemowym motyw ma zmieniac sie
// w trakcie sesji a nie dopiero po odswiezeniu panelu
function useSystemTheme() {
  const [theme, setTheme] = useState(systemTheme)

  useEffect(() => {
    if (typeof matchMedia !== 'function') return

    const query = matchMedia('(prefers-color-scheme: dark)')

    if (typeof query.addEventListener !== 'function') return

    function update(event: MediaQueryListEvent) {
      setTheme(event.matches ? 'dark' : 'light')
    }

    query.addEventListener('change', update)

    return () => query.removeEventListener('change', update)
  }, [])

  return theme
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setStoredMode] = useState<ThemeMode>(currentMode)
  const system = useSystemTheme()
  const theme = mode === 'system' ? system : mode

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  const setMode = useCallback((next: ThemeMode) => {
    setStoredMode(next)
    writeMode(next)
  }, [])

  const value = useMemo(() => ({ mode, theme, setMode }), [mode, theme, setMode])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
