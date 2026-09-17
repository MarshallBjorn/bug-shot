import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { TicketEvent } from '../live/ticketEvents'
import { defaultLimit, type TicketQuery, emptyQuery } from '../ticketQuery'
import type { CursorPage, TicketListItem } from '../types'
import { useTickets } from './useTickets'

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

function page(
  ids: string[],
  nextCursor: string | null,
  total: number | null = null,
): CursorPage<TicketListItem> {
  return { items: ids.map((id) => ticket(id)), nextCursor, total }
}

function respond(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

const zdarzenie: TicketEvent = { type: 'created', ticket: ticket('nowe') }
const zmiana: TicketEvent = { type: 'changed', ticket: ticket('a', { status: 'Resolved' }) }

function Probe({ projectId = 'p1', filter = query }: { projectId?: string; filter?: TicketQuery }) {
  const tickets = useTickets(projectId, filter)

  return (
    <div>
      <p>{tickets.loading ? 'ladowanie' : 'gotowe'}</p>
      <p>{tickets.items.map((item) => item.id).join(',') || 'pusto'}</p>
      <p>{tickets.items.map((item) => `${item.id}:${item.status}`).join(',') || 'brak statusow'}</p>
      <p>{tickets.hasMore ? 'jest wiecej' : 'koniec'}</p>
      <button type="button" onClick={tickets.loadMore}>
        wiecej
      </button>
      <button type="button" onClick={() => tickets.apply(zdarzenie)}>
        event
      </button>
      <button type="button" onClick={() => tickets.apply(zmiana)}>
        zmiana
      </button>
      <button type="button" onClick={tickets.reload}>
        odswiez
      </button>
    </div>
  )
}

function addresses(mock: ReturnType<typeof vi.fn>) {
  return mock.mock.calls.map((call) => String(call[0]))
}

let fetched: ReturnType<typeof vi.fn>

beforeEach(() => {
  fetched = vi.fn()
  vi.stubGlobal('fetch', fetched)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('lista zgloszen na kursorze', () => {
  it('pierwsza strona idzie bez kursora', async () => {
    fetched.mockResolvedValue(respond(page(['a', 'b'], null)))

    render(<Probe />)

    await waitFor(() => expect(screen.getByText('a,b')).toBeDefined())

    expect(addresses(fetched)).toEqual([
      'http://localhost:8080/api/v1/projects/p1/tickets?withTotal=true',
    ])
    expect(screen.getByText('koniec')).toBeDefined()
  })

  it('doladowanie dokleja kolejna strone z kursorem', async () => {
    fetched
      .mockResolvedValueOnce(respond(page(['a', 'b'], 'kursor-1')))
      .mockResolvedValueOnce(respond(page(['c'], null)))

    render(<Probe />)

    await waitFor(() => expect(screen.getByText('jest wiecej')).toBeDefined())

    screen.getByRole('button', { name: 'wiecej' }).click()

    await waitFor(() => expect(screen.getByText('a,b,c')).toBeDefined())

    // licznik liczy sie tylko przy wejsciu w liste wiec doladowanie o niego nie prosi
    expect(addresses(fetched)[1]).toBe(
      'http://localhost:8080/api/v1/projects/p1/tickets?cursor=kursor-1',
    )
    expect(screen.getByText('koniec')).toBeDefined()
  })

  // przycisk bez kursora nie ma czego doladowac
  it('doladowanie na koncu listy nie wysyla zadania', async () => {
    fetched.mockResolvedValue(respond(page(['a'], null)))

    render(<Probe />)

    await waitFor(() => expect(screen.getByText('koniec')).toBeDefined())

    screen.getByRole('button', { name: 'wiecej' }).click()

    expect(fetched).toHaveBeenCalledTimes(1)
  })

  it('zmiana filtra zaczyna liste od poczatku i zostawia wiersze na ekranie', async () => {
    fetched
      .mockResolvedValueOnce(respond(page(['a'], 'kursor-1')))
      .mockResolvedValueOnce(respond(page(['b'], null)))

    const view = render(<Probe />)

    await waitFor(() => expect(screen.getByText('a')).toBeDefined())

    view.rerender(<Probe filter={{ ...query, statuses: ['Resolved'] }} />)

    // stara lista zostaje dopoki nie przyjdzie nowa
    expect(screen.getByText('a')).toBeDefined()
    expect(screen.getByText('ladowanie')).toBeDefined()

    await waitFor(() => expect(screen.getByText('b')).toBeDefined())

    expect(addresses(fetched)[1]).toBe(
      'http://localhost:8080/api/v1/projects/p1/tickets?status=Resolved&withTotal=true',
    )
  })

  it('zmiana projektu czysci liste', async () => {
    fetched
      .mockResolvedValueOnce(respond(page(['a'], null)))
      .mockResolvedValueOnce(respond(page(['z'], null)))

    const view = render(<Probe />)

    await waitFor(() => expect(screen.getByText('a')).toBeDefined())

    view.rerender(<Probe projectId="p2" />)

    expect(screen.getByText('pusto')).toBeDefined()

    await waitFor(() => expect(screen.getByText('z')).toBeDefined())
  })

  it('blad zapytania konczy ladowanie', async () => {
    fetched.mockResolvedValue(new Response(null, { status: 500 }))

    render(<Probe />)

    await waitFor(() => expect(screen.getByText('gotowe')).toBeDefined())
    expect(screen.getByText('pusto')).toBeDefined()
  })

  it('odpowiedz na poprzedni filtr nie dopisuje sie do nowej listy', async () => {
    const spozniona = respond(page(['stare'], null))
    let wypusc: () => void = () => {}

    fetched
      .mockImplementationOnce(
        () => new Promise((resolve) => {
          wypusc = () => resolve(spozniona)
        }),
      )
      .mockResolvedValueOnce(respond(page(['nowe'], null)))

    const view = render(<Probe />)

    view.rerender(<Probe filter={{ ...query, search: 'koszyk' }} />)

    await waitFor(() => expect(screen.getByText('nowe')).toBeDefined())

    wypusc()

    await waitFor(() => expect(screen.getByText('nowe')).toBeDefined())
    expect(screen.queryByText('stare')).toBeNull()
  })

  it('event ktory przyszedl w trakcie pierwszego ladowania nie ginie pod odpowiedzia GET-a', async () => {
    let wypusc: () => void = () => {}

    fetched.mockImplementationOnce(
      () => new Promise((resolve) => {
        wypusc = () => resolve(respond(page(['a'], null)))
      }),
    )

    render(<Probe />)

    await waitFor(() => expect(fetched).toHaveBeenCalledTimes(1))

    // event SignalR przychodzi zanim GET zdazyl wrocic
    screen.getByRole('button', { name: 'event' }).click()

    wypusc()

    await waitFor(() => expect(screen.getByText('nowe,a')).toBeDefined())
  })

  it('event ktory przyszedl w trakcie odswiezania nie ginie pod odpowiedzia GET-a', async () => {
    let wypusc: () => void = () => {}

    fetched.mockResolvedValueOnce(respond(page(['a'], null)))
    fetched.mockImplementationOnce(
      () => new Promise((resolve) => {
        wypusc = () => resolve(respond(page(['a'], null)))
      }),
    )

    render(<Probe />)

    await waitFor(() => expect(screen.getByText('a')).toBeDefined())

    screen.getByRole('button', { name: 'odswiez' }).click()

    await waitFor(() => expect(fetched).toHaveBeenCalledTimes(2))

    // zmiana statusu przychodzi kanalem live w trakcie odswiezania listy
    screen.getByRole('button', { name: 'zmiana' }).click()

    wypusc()

    await waitFor(() => expect(screen.getByText('a:Resolved')).toBeDefined())
  })
})
