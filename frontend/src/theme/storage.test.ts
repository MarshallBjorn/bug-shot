import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { currentTheme, readTheme, systemTheme, themeStorageKey, writeTheme } from './storage'

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
    expect(readTheme()).toBe('dark')

    stubStorage({ getItem: () => 'light' })
    expect(readTheme()).toBe('light')

    stubStorage({ getItem: () => 'sepia' })
    expect(readTheme()).toBeNull()

    stubStorage({ getItem: () => null })
    expect(readTheme()).toBeNull()
  })

  it('prywatne okno rzuca przy siegnieciu po magazyn i nie wywraca panelu', () => {
    stubStorage({
      getItem: () => {
        throw new Error('SecurityError')
      },
    })

    expect(readTheme()).toBeNull()
  })
})

describe('zapis preferencji', () => {
  it('zapisuje pod ustalonym kluczem', () => {
    const setItem = vi.fn()
    stubStorage({ setItem })

    writeTheme('dark')

    expect(setItem).toHaveBeenCalledWith(themeStorageKey, 'dark')
  })

  it('blad zapisu gubi tylko preferencje', () => {
    stubStorage({
      setItem: () => {
        throw new Error('QuotaExceededError')
      },
    })

    expect(() => writeTheme('light')).not.toThrow()
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

describe('motyw biezacy', () => {
  it('czyta atrybut ustawiony przez skrypt z index.html', () => {
    document.documentElement.dataset.theme = 'dark'
    stubStorage({ getItem: () => 'light' })

    expect(currentTheme()).toBe('dark')
  })

  it('bez atrybutu schodzi na zapisana preferencje', () => {
    stubStorage({ getItem: () => 'dark' })
    vi.stubGlobal('matchMedia', () => ({ matches: false }))

    expect(currentTheme()).toBe('dark')
  })

  it('bez atrybutu i bez preferencji pyta system', () => {
    stubStorage({ getItem: () => null })
    vi.stubGlobal('matchMedia', () => ({ matches: true }))

    expect(currentTheme()).toBe('dark')
  })
})
