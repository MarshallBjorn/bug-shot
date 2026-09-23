import type { Theme, ThemeMode } from './ThemeContext'

export const themeStorageKey = 'bugshot-theme'

export const defaultMode: ThemeMode = 'system'

// prywatne okno potrafi rzucic przy samym siegnieciu po localStorage wiec kazdy dostep jest oslonięty
export function readMode(): ThemeMode | null {
  try {
    const saved = localStorage.getItem(themeStorageKey)

    return saved === 'dark' || saved === 'light' || saved === 'system' ? saved : null
  } catch {
    return null
  }
}

export function writeMode(mode: ThemeMode) {
  try {
    localStorage.setItem(themeStorageKey, mode)
  } catch {
    // brak zapisu tylko gubi preferencje miedzy wejsciami i nie psuje panelu
  }
}

export function systemTheme(): Theme {
  return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}

export function resolveTheme(mode: ThemeMode): Theme {
  return mode === 'system' ? systemTheme() : mode
}

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme
}

// brak zapisu znaczy ze nikt jeszcze nie wybieral wiec idziemy za systemem
export function currentMode(): ThemeMode {
  return readMode() ?? defaultMode
}
