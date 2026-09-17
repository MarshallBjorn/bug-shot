import { describe, expect, it } from 'vitest'
import type { TicketEvent } from '../live/ticketEvents'
import { defaultLimit, type TicketQuery, emptyQuery } from '../ticketQuery'
import type { TicketListItem } from '../types'
import { initialTicketListState, ticketListReducer, type TicketListState } from './ticketListState'

const query: TicketQuery = {
  ...emptyQuery,
  search: '',
  sort: 'receivedAt:desc',
  limit: defaultLimit,
}

function ticket(id: string, patch: Partial<TicketListItem> = {}): TicketListItem {
  return {
    id,
    description: `Zgloszenie ${id}`,
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

function state(items: TicketListItem[], patch: Partial<TicketListState> = {}): TicketListState {
  return { ...initialTicketListState, items, loading: false, ...patch }
}

describe('strony listy', () => {
  it('pierwsza strona zastepuje liste i zdejmuje ladowanie', () => {
    const next = ticketListReducer(initialTicketListState, {
      type: 'loaded',
      page: { items: [ticket('a')], nextCursor: 'kursor-1', total: 7 },
      append: false,
    })

    expect(next.items.map((item) => item.id)).toEqual(['a'])
    expect(next.nextCursor).toBe('kursor-1')
    expect(next.total).toBe(7)
    expect(next.loading).toBe(false)
  })

  // kolejne strony nie niosa licznika wiec ten z wejscia w liste ma zostac
  it('doladowanie zostawia licznik z pierwszej strony', () => {
    const next = ticketListReducer(state([ticket('a')], { nextCursor: 'kursor-1', total: 7 }), {
      type: 'loaded',
      page: { items: [ticket('b')], nextCursor: null, total: null },
      append: true,
    })

    expect(next.total).toBe(7)
  })

  it('kolejna strona dokleja sie na koncu', () => {
    const next = ticketListReducer(state([ticket('a')], { nextCursor: 'kursor-1' }), {
      type: 'loaded',
      page: { items: [ticket('b')], nextCursor: null, total: null },
      append: true,
    })

    expect(next.items.map((item) => item.id)).toEqual(['a', 'b'])
    expect(next.nextCursor).toBeNull()
  })

  it('kolejna strona nie powtarza wiersza ktory juz jest na liscie', () => {
    const next = ticketListReducer(state([ticket('a'), ticket('b')]), {
      type: 'loaded',
      page: { items: [ticket('b'), ticket('c')], nextCursor: null, total: null },
      append: true,
    })

    expect(next.items.map((item) => item.id)).toEqual(['a', 'b', 'c'])
  })

  it('zmiana filtra zostawia poprzednie wiersze a zmiana projektu je czysci', () => {
    const previous = state([ticket('a')], { nextCursor: 'kursor-1' })

    expect(ticketListReducer(previous, { type: 'restart', keepItems: true }).items).toHaveLength(1)
    expect(ticketListReducer(previous, { type: 'restart', keepItems: true }).nextCursor).toBeNull()
    expect(ticketListReducer(previous, { type: 'restart', keepItems: false }).items).toHaveLength(0)
  })

  it('blad konczy ladowanie i zostawia komunikat', () => {
    const next = ticketListReducer(state([], { loading: true }), {
      type: 'failed',
      message: 'padlo',
    })

    expect(next.loading).toBe(false)
    expect(next.error).toBe('padlo')
  })
})

describe('zdarzenia kanalu live', () => {
  function live(before: TicketListState, event: TicketEvent, filter = query) {
    return ticketListReducer(before, { type: 'live', event, query: filter })
  }

  it('nowe zgloszenie laduje na gorze listy i podnosi licznik', () => {
    const next = live(state([ticket('a')], { total: 7 }), {
      type: 'created',
      ticket: ticket('nowe'),
    })

    expect(next.items.map((item) => item.id)).toEqual(['nowe', 'a'])
    expect(next.total).toBe(8)
  })

  // bez licznika z backendu nie ma czego podnosic
  it('brak licznika zostaje brakiem licznika', () => {
    const next = live(state([ticket('a')]), { type: 'created', ticket: ticket('nowe') })

    expect(next.total).toBeNull()
  })

  it('nowe zgloszenie nie wchodzi na liste przy innym sortowaniu', () => {
    const before = state([ticket('a')])
    const next = live(
      before,
      { type: 'created', ticket: ticket('nowe') },
      { ...query, sort: 'receivedAt:asc' },
    )

    expect(next).toBe(before)
  })

  it('nowe zgloszenie spoza filtra nie wchodzi na liste', () => {
    const before = state([ticket('a')])
    const filter = { ...query, statuses: ['Resolved' as const] }

    expect(live(before, { type: 'created', ticket: ticket('nowe') }, filter)).toBe(before)
  })

  it('nowe zgloszenie nie wchodzi drugi raz', () => {
    const before = state([ticket('a')])

    expect(live(before, { type: 'created', ticket: ticket('a') })).toBe(before)
  })

  it('zmiana podmienia wiersz w miejscu', () => {
    const next = live(state([ticket('a'), ticket('b')]), {
      type: 'changed',
      ticket: ticket('a', { status: 'Resolved' }),
    })

    expect(next.items.map((item) => item.status)).toEqual(['Resolved', 'New'])
  })

  it('zmiana wypychajaca poza filtr zdejmuje wiersz z listy i obniza licznik', () => {
    const filter = { ...query, statuses: ['New' as const] }
    const next = live(
      state([ticket('a'), ticket('b')], { total: 7 }),
      { type: 'changed', ticket: ticket('a', { status: 'Resolved' }) },
      filter,
    )

    expect(next.items.map((item) => item.id)).toEqual(['b'])
    expect(next.total).toBe(6)
  })

  // podmiana wiersza w miejscu niczego nie dodaje ani nie zabiera
  it('zmiana w miejscu nie rusza licznika', () => {
    const next = live(state([ticket('a')], { total: 7 }), {
      type: 'changed',
      ticket: ticket('a', { status: 'Resolved' }),
    })

    expect(next.total).toBe(7)
  })

  it('zmiana wiersza spoza zaladowanej listy niczego nie rusza', () => {
    const before = state([ticket('a')])

    expect(live(before, { type: 'changed', ticket: ticket('daleki') })).toBe(before)
  })

  it('skasowanie zdejmuje wiersz i obniza licznik a nieznane id nie rusza listy', () => {
    const before = state([ticket('a'), ticket('b')], { total: 7 })
    const next = live(before, { type: 'deleted', ticketId: 'a' })

    expect(next.items.map((item) => item.id)).toEqual(['b'])
    expect(next.total).toBe(6)
    expect(live(before, { type: 'deleted', ticketId: 'obcy' })).toBe(before)
  })
})
