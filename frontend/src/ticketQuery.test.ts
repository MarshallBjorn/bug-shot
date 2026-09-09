import { describe, expect, it } from 'vitest'
import {
  defaultLimit,
  matchesQuery,
  parseTicketQuery,
  ticketQueryToParams,
  type TicketQuery,
} from './ticketQuery'
import type { TicketListItem } from './types'

const base: TicketQuery = {
  status: null,
  search: '',
  sort: 'receivedAt:desc',
  limit: defaultLimit,
}

function ticket(patch: Partial<TicketListItem> = {}): TicketListItem {
  return {
    id: 't1',
    description: 'Koszyk gubi produkty',
    pageUrl: 'https://acme.example/cart',
    status: 'New',
    reportedAt: null,
    receivedAt: '2026-09-09T10:00:00+00:00',
    updatedAt: '2026-09-09T10:00:00+00:00',
    ...patch,
  }
}

describe('parametry listy', () => {
  it('czyta filtry i limit z adresu', () => {
    const query = parseTicketQuery(
      new URLSearchParams('status=Resolved&search=koszyk&sort=reportedAt:asc&limit=50'),
    )

    expect(query).toEqual({
      status: 'Resolved',
      search: 'koszyk',
      sort: 'reportedAt:asc',
      limit: 50,
    })
  })

  it('przycina limit do granicy z kontrolera', () => {
    expect(parseTicketQuery(new URLSearchParams('limit=500')).limit).toBe(100)
    expect(parseTicketQuery(new URLSearchParams('limit=0')).limit).toBe(defaultLimit)
    expect(parseTicketQuery(new URLSearchParams('limit=nic')).limit).toBe(defaultLimit)
  })

  it('nieznany status i sortowanie wracaja do domyslnych', () => {
    const query = parseTicketQuery(new URLSearchParams('status=Nieznany&sort=cokolwiek'))

    expect(query.status).toBeNull()
    expect(query.sort).toBe('receivedAt:desc')
  })

  it('pomija wartosci domyslne w adresie', () => {
    expect(ticketQueryToParams(base).toString()).toBe('')
    expect(ticketQueryToParams({ ...base, limit: 50 }).toString()).toBe('limit=50')
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
    const query = { ...base, status: 'Resolved' as const }

    expect(matchesQuery(ticket({ status: 'Resolved' }), query)).toBe(true)
    expect(matchesQuery(ticket({ status: 'New' }), query)).toBe(false)
  })

  it('szukanie idzie po opisie i adresie bez wzgledu na wielkosc liter', () => {
    expect(matchesQuery(ticket(), { ...base, search: 'KOSZYK' })).toBe(true)
    expect(matchesQuery(ticket(), { ...base, search: 'ACME.example' })).toBe(true)
    expect(matchesQuery(ticket(), { ...base, search: 'faktura' })).toBe(false)
  })
})
