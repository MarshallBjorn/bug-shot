import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  readSavedFilters,
  removeSavedFilter,
  saveFilter,
  savedFiltersSnapshot,
  subscribeSavedFilters,
} from './savedFilters'

function memoryStorage(initial: Record<string, string> = {}) {
  const data = { ...initial }

  return {
    store: data,
    getItem: (key: string) => data[key] ?? null,
    setItem: (key: string, value: string) => {
      data[key] = value
    },
  } as unknown as Storage & { store: Record<string, string> }
}

beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('zapisane filtry', () => {
  it('zapis wraca na poczatek listy', () => {
    saveFilter('p1', 'Nowe', 'status=New')
    const filters = saveFilter('p1', 'Koszyk', 'page=acme.example/cart')

    expect(filters.map((filter) => filter.name)).toEqual(['Koszyk', 'Nowe'])
  })

  it('ta sama nazwa nadpisuje wpis', () => {
    saveFilter('p1', 'Nowe', 'status=New')
    const filters = saveFilter('p1', 'Nowe', 'status=InProgress')

    expect(filters).toEqual([{ name: 'Nowe', search: 'status=InProgress' }])
  })

  it('pusta nazwa nie zapisuje niczego', () => {
    saveFilter('p1', '   ', 'status=New')

    expect(readSavedFilters('p1')).toEqual([])
  })

  it('nazwa traci spacje z brzegow', () => {
    expect(saveFilter('p1', '  Koszyk  ', 'page=x')[0].name).toBe('Koszyk')
  })

  it('filtry nie przeciekaja miedzy projektami', () => {
    saveFilter('p1', 'Nowe', 'status=New')

    expect(readSavedFilters('p2')).toEqual([])
  })

  it('usuwanie zdejmuje tylko wskazany wpis', () => {
    saveFilter('p1', 'Nowe', 'status=New')
    saveFilter('p1', 'Koszyk', 'page=x')

    expect(removeSavedFilter('p1', 'Nowe').map((filter) => filter.name)).toEqual(['Koszyk'])
  })

  it('obcy zapis w magazynie nie wywraca odczytu', () => {
    vi.stubGlobal('localStorage', memoryStorage({ 'bugshot-filters:p1': '{"nie":"tablica"}' }))
    expect(readSavedFilters('p1')).toEqual([])

    vi.stubGlobal('localStorage', memoryStorage({ 'bugshot-filters:p1': 'to nie json' }))
    expect(readSavedFilters('p1')).toEqual([])

    vi.stubGlobal('localStorage', memoryStorage({ 'bugshot-filters:p1': '[{"name":1}]' }))
    expect(readSavedFilters('p1')).toEqual([])
  })

  it('prywatne okno rzuca i odczyt oddaje pusta liste', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('SecurityError')
      },
    } as unknown as Storage)

    expect(readSavedFilters('p1')).toEqual([])
  })

  it('blad zapisu nie wywraca akcji', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError')
      },
    } as unknown as Storage)

    expect(() => saveFilter('p1', 'Nowe', 'status=New')).not.toThrow()
  })
})

describe('magazyn dla panelu bocznego', () => {
  it('kolejne odczyty oddaja te sama referencje', () => {
    const first = savedFiltersSnapshot('p1')

    expect(savedFiltersSnapshot('p1')).toBe(first)
  })

  it('zapis powiadamia sluchaczy i podmienia referencje', () => {
    const listener = vi.fn()
    const unsubscribe = subscribeSavedFilters(listener)

    const before = savedFiltersSnapshot('p1')
    saveFilter('p1', 'Nowe', 'status=New')

    expect(listener).toHaveBeenCalledTimes(1)
    expect(savedFiltersSnapshot('p1')).not.toBe(before)

    unsubscribe()
    saveFilter('p1', 'Koszyk', 'page=x')

    expect(listener).toHaveBeenCalledTimes(1)
  })
})
