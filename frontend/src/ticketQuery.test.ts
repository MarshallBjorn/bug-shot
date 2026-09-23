import { describe, expect, it } from 'vitest'
import {
  defaultLimit,
  defaultSort,
  isFiltered,
  matchesQuery,
  normalizePage,
  parseTicketQuery,
  ticketQueryToParams,
  type TicketQuery,
  emptyQuery,
} from './ticketQuery'
import type { TicketListItem } from './types'

const base: TicketQuery = {
  ...emptyQuery,
  search: '',
  sort: 'receivedAt:desc',
  limit: defaultLimit,
}

function ticket(patch: Partial<TicketListItem> = {}): TicketListItem {
  return {
    id: 't1',
    description: 'Koszyk gubi produkty',
    pageUrl: 'https://acme.example/cart',
    page: 'acme.example/cart',
    browserName: 'Chrome',
    osName: 'Windows',
    deviceType: 'desktop',
    status: 'New',
    reportedAt: null,
    receivedAt: '2026-09-09T10:00:00+00:00',
    updatedAt: '2026-09-09T10:00:00+00:00',
    commentCount: 0,
    hasScreenshot: false,
    ...patch,
  }
}

describe('parametry listy', () => {
  it('czyta filtry i limit z adresu', () => {
    const query = parseTicketQuery(
      new URLSearchParams('status=Resolved&search=koszyk&sort=reportedAt:asc&limit=50'),
    )

    expect(query).toEqual({
      ...emptyQuery,
      statuses: ['Resolved'],
      search: 'koszyk',
      sort: 'reportedAt:asc',
      limit: 50,
    })
  })

  it('pusty adres daje wartosci domyslne', () => {
    expect(parseTicketQuery(new URLSearchParams())).toEqual(base)
  })

  it('obcina spacje wokol szukanej frazy', () => {
    expect(parseTicketQuery(new URLSearchParams('search=%20bug%20')).search).toBe('bug')
  })

  it('przycina limit do granicy z kontrolera', () => {
    expect(parseTicketQuery(new URLSearchParams('limit=500')).limit).toBe(100)
    expect(parseTicketQuery(new URLSearchParams('limit=0')).limit).toBe(defaultLimit)
    expect(parseTicketQuery(new URLSearchParams('limit=nic')).limit).toBe(defaultLimit)
    expect(parseTicketQuery(new URLSearchParams('limit=-5')).limit).toBe(defaultLimit)
    expect(parseTicketQuery(new URLSearchParams('limit=10.5')).limit).toBe(defaultLimit)
  })

  it('nieznany status i sortowanie wracaja do domyslnych', () => {
    const query = parseTicketQuery(new URLSearchParams('status=Nieznany&sort=cokolwiek'))

    expect(query.statuses).toEqual([])
    expect(query.sort).toBe('receivedAt:desc')
  })

  it('pomija wartosci domyslne w adresie', () => {
    expect(ticketQueryToParams(base).toString()).toBe('')
    expect(ticketQueryToParams({ ...base, limit: 50 }).toString()).toBe('limit=50')
  })

  it('serializuje wszystkie niestandardowe wartosci', () => {
    expect(
      ticketQueryToParams({
        ...emptyQuery,
        statuses: ['Resolved'],
        search: 'login bug',
        sort: 'reportedAt:asc',
        limit: 50,
      }).toString(),
    ).toBe('status=Resolved&search=login+bug&sort=reportedAt%3Aasc&limit=50')
  })

  // kursor nie siedzi w adresie bo po odswiezeniu strony i tak zaczynamy od poczatku listy
  it('nie zapisuje kursora w adresie', () => {
    expect(ticketQueryToParams({ ...base, search: 'koszyk' }).toString()).toBe('search=koszyk')
  })
})

describe('dopasowanie zgloszenia do filtra', () => {
  it('bez filtra przechodzi wszystko poza tombstone', () => {
    expect(matchesQuery(ticket(), base)).toBe(true)
    expect(matchesQuery(ticket({ status: 'Deleted' }), base)).toBe(false)
  })

  it('filtr statusu przepuszcza tylko swoj status', () => {
    const query = { ...base, statuses: ['Resolved' as const] }

    expect(matchesQuery(ticket({ status: 'Resolved' }), query)).toBe(true)
    expect(matchesQuery(ticket({ status: 'New' }), query)).toBe(false)
  })

  it('szukanie idzie po opisie i adresie bez wzgledu na wielkosc liter', () => {
    expect(matchesQuery(ticket(), { ...base, search: 'KOSZYK' })).toBe(true)
    expect(matchesQuery(ticket(), { ...base, search: 'ACME.example' })).toBe(true)
    expect(matchesQuery(ticket(), { ...base, search: 'faktura' })).toBe(false)
  })
})

// te same przypadki co PageAddressTests w backendzie
describe('normalizacja adresu strony', () => {
  it.each([
    ['https://Sklep.example/Koszyk?utm_source=newsletter#opinie', 'sklep.example/koszyk'],
    ['https://sklep.example/szukaj?q=buty', 'sklep.example/szukaj'],
    ['https://sklep.example/', 'sklep.example'],
    ['http://127.0.0.1:5500/cart/', '127.0.0.1:5500/cart'],
    ['https://sklep.example/produkt#opinie?x=1', 'sklep.example/produkt'],
    [' https://sklep.example/kontakt ', 'sklep.example/kontakt'],
    ['', ''],
  ])('%s', (url, expected) => {
    expect(normalizePage(url)).toBe(expected)
  })

  it('zgloszenie z kanalu live pasuje do filtra wpisanego pelnym adresem', () => {
    const query = parseTicketQuery(new URLSearchParams('page=http://127.0.0.1:5500/'))

    expect(query.page).toBe('127.0.0.1:5500')
    expect(matchesQuery(ticket({ page: '127.0.0.1:5500' }), query)).toBe(true)
  })
})

describe('isFiltered', () => {
  it('rozpoznaje filtr statusu i wyszukiwania', () => {
    expect(isFiltered({ ...base, statuses: ['Resolved'] })).toBe(true)
    expect(isFiltered({ ...base, search: 'bug' })).toBe(true)
  })

  it('nie uznaje sortowania ani limitu za filtr', () => {
    expect(isFiltered({ ...base, sort: 'reportedAt:asc', limit: 50 })).toBe(false)
    expect(base.sort).toBe(defaultSort)
  })
})
