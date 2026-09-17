import type { Theme } from './ThemeContext'

export const themeStorageKey = 'bugshot-theme'

// prywatne okno potrafi rzucic przy samym siegnieciu po localStorage wiec kazdy dostep jest oslonięty
export function readTheme(): Theme | null {
  try {
    const saved = localStorage.getItem(themeStorageKey)

    return saved === 'dark' || saved === 'light' ? saved : null
  } catch {
    return null
  }
}

export function writeTheme(theme: Theme) {
  try {
    localStorage.setItem(themeStorageKey, theme)
  } catch {
    // brak zapisu tylko gubi preferencje miedzy wejsciami i nie psuje panelu
  }
}

export function systemTheme(): Theme {
  return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}

// skrypt w index.html ustawil juz atrybut wiec czytamy stan zamiast liczyc go drugi raz
export function currentTheme(): Theme {
  const applied = document.documentElement.dataset.theme

  return applied === 'dark' || applied === 'light' ? applied : readTheme() ?? systemTheme()
}
