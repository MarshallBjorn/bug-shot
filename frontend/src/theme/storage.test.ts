import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  applyTheme,
  currentMode,
  readMode,
  resolveTheme,
  systemTheme,
  themeStorageKey,
  writeMode,
} from './storage'

function stubStorage(value: Partial<Storage>) {
  vi.stubGlobal('localStorage', value as Storage)
}

beforeEach(() => {
  document.documentElement.removeAttribute('data-theme')
})

afterEach(() => {
  vi.unstubAllGlobals()
  document.documentElement.removeAttribute('data-theme')
})

describe('odczyt preferencji', () => {
  it('przyjmuje tylko znane wartosci', () => {
    stubStorage({ getItem: () => 'dark' })
    expect(readMode()).toBe('dark')

    stubStorage({ getItem: () => 'light' })
    expect(readMode()).toBe('light')

    stubStorage({ getItem: () => 'system' })
    expect(readMode()).toBe('system')

    stubStorage({ getItem: () => 'sepia' })
    expect(readMode()).toBeNull()

    stubStorage({ getItem: () => null })
    expect(readMode()).toBeNull()
  })

  it('prywatne okno rzuca przy siegnieciu po magazyn i nie wywraca panelu', () => {
    stubStorage({
      getItem: () => {
        throw new Error('SecurityError')
      },
    })

    expect(readMode()).toBeNull()
  })
})

describe('zapis preferencji', () => {
  it('zapisuje pod ustalonym kluczem', () => {
    const setItem = vi.fn()
    stubStorage({ setItem })

    writeMode('system')

    expect(setItem).toHaveBeenCalledWith(themeStorageKey, 'system')
  })

  it('blad zapisu gubi tylko preferencje', () => {
    stubStorage({
      setItem: () => {
        throw new Error('QuotaExceededError')
      },
    })

    expect(() => writeMode('light')).not.toThrow()
  })
})

describe('motyw systemowy', () => {
  it('idzie za zapytaniem medialnym', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }))
    expect(systemTheme()).toBe('dark')

    vi.stubGlobal('matchMedia', () => ({ matches: false }))
    expect(systemTheme()).toBe('light')
  })

  // jsdom nie ma matchMedia wiec brak funkcji musi byc obsluzony a nie zakladany
  it('brak matchMedia schodzi na motyw jasny', () => {
    vi.stubGlobal('matchMedia', undefined)
    expect(systemTheme()).toBe('light')
  })
})

describe('rozwiazanie trybu', () => {
  it('jawny tryb nie pyta systemu', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }))

    expect(resolveTheme('light')).toBe('light')
    expect(resolveTheme('dark')).toBe('dark')
    expect(resolveTheme('system')).toBe('dark')
  })
})

describe('tryb biezacy', () => {
  it('czyta zapisana preferencje', () => {
    stubStorage({ getItem: () => 'light' })

    expect(currentMode()).toBe('light')
  })

  it('bez zapisu schodzi na tryb systemowy', () => {
    stubStorage({ getItem: () => null })

    expect(currentMode()).toBe('system')
  })
})

describe('naniesienie motywu', () => {
  it('ustawia atrybut na dokumencie', () => {
    applyTheme('dark')

    expect(document.documentElement.dataset.theme).toBe('dark')
  })
})
