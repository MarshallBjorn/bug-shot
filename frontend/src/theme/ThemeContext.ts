import { createContext, useContext } from 'react'

// tryb to wybor uzytkownika, motyw to kolor ktory z niego wychodzi
// przy trybie systemowym te dwie rzeczy zyja osobno wiec nie da sie ich trzymac w jednym polu
export type ThemeMode = 'light' | 'dark' | 'system'

export type Theme = 'light' | 'dark'

export interface ThemeState {
  mode: ThemeMode
  theme: Theme
  setMode: (mode: ThemeMode) => void
}

export const ThemeContext = createContext<ThemeState | null>(null)

export function useTheme() {
  const state = useContext(ThemeContext)

  if (!state) {
    throw new Error('useTheme wymaga ThemeProvider')
  }

  return state
}
