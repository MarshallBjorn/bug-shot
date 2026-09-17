import { createContext, useContext } from 'react'

export type Theme = 'light' | 'dark'

export interface ThemeState {
  theme: Theme
  toggle: () => void
}

export const ThemeContext = createContext<ThemeState | null>(null)

export function useTheme() {
  const state = useContext(ThemeContext)

  if (!state) {
    throw new Error('useTheme wymaga ThemeProvider')
  }

  return state
}
