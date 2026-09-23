import { describe, expect, it } from 'vitest'
import { hasSidebarItems, readListSearch } from './navigation'

describe('readListSearch', () => {
  it('zwraca zapisany query string', () => {
    expect(readListSearch({ listSearch: '?status=Resolved&page=2' }))
      .toBe('?status=Resolved&page=2')
  })

  it('zwraca pusty string dla braku stanu', () => {
    expect(readListSearch(null)).toBe('')
    expect(readListSearch(undefined)).toBe('')
  })

  it('zwraca pusty string dla niepoprawnego stanu', () => {
    expect(readListSearch({ listSearch: 123 })).toBe('')
    expect(readListSearch({ other: 'value' })).toBe('')
  })
})

describe('hasSidebarItems', () => {
  it('pusta nawigacja tylko dla zwyklego uzytkownika poza projektem', () => {
    expect(hasSidebarItems('', false)).toBe(false)
    expect(hasSidebarItems('p1', false)).toBe(true)
    expect(hasSidebarItems('', true)).toBe(true)
    expect(hasSidebarItems('p1', true)).toBe(true)
  })
})
