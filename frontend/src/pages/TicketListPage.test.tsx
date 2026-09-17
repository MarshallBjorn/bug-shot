import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import TicketListPage from './TicketListPage'
import { useTickets, type Tickets } from '../hooks/useTickets'
import { useTicketStream } from '../hooks/useTicketStream'

const { setSearchParams, searchParams } = vi.hoisted(() => ({
  setSearchParams: vi.fn(),
  searchParams: new URLSearchParams(),
}))

vi.mock('react-router', () => ({
  Link: ({
    to,
    children,
  }: {
    to: string
    children: React.ReactNode
  }) => <a href={to}>{children}</a>,
  useParams: () => ({ projectId: 'project-1' }),
  useSearchParams: () => [searchParams, setSearchParams],
}))

vi.mock('../hooks/useTickets', () => ({
  useTickets: vi.fn(),
}))

vi.mock('../hooks/useTicketStream', () => ({
  useTicketStream: vi.fn(() => 'live'),
}))

vi.mock('../components/TicketFilters', () => ({
  default: ({
    onChange,
  }: {
    query: unknown
    onChange: (patch: Record<string, unknown>, replace?: boolean) => void
  }) => (
    <button
      type="button"
      onClick={() => onChange({ status: 'Resolved' })}
    >
      Mock filtr
    </button>
  ),
}))

vi.mock('../components/TicketTable', () => ({
  default: ({
    projectId,
    items,
    listSearch,
  }: {
    projectId: string
    items: Array<{ id: string }>
    listSearch: string
  }) => (
    <div data-testid="ticket-table">
      {projectId}:{items.length}:{listSearch}
    </div>
  ),
}))

vi.mock('../components/TicketsEmptyState', () => ({
  default: ({
    onChange,
  }: {
    query: unknown
    onChange: (patch: Record<string, unknown>) => void
  }) => (
    <button
      type="button"
      onClick={() => onChange({ search: '' })}
    >
      Mock pusty stan
    </button>
  ),
}))

vi.mock('../components/LoadMore', () => ({
  default: ({
    loaded,
    total,
    hasMore,
    busy,
    onLoadMore,
  }: {
    loaded: number
    total: number | null
    hasMore: boolean
    busy: boolean
    onLoadMore: () => void
  }) => (
    <button
      type="button"
      data-testid="load-more"
      onClick={onLoadMore}
    >
      LoadMore {loaded}/{String(total)}/{String(hasMore)}/{String(busy)}
    </button>
  ),
}))

const tickets = vi.mocked(useTickets)

function ticket(id: string) {
  return {
    id,
    description: `Ticket ${id}`,
    pageUrl: 'https://example.test',
    status: 'New' as const,
    reportedAt: null,
    receivedAt: '2026-09-14T10:00:00+00:00',
    updatedAt: '2026-09-14T10:00:00+00:00',
  }
}

function result(
  items = [ticket('ticket-1')],
  overrides: Partial<Tickets> = {},
): Tickets {
  return {
    items,
    nextCursor: null,
    total: items.length,
    loading: false,
    loadingMore: false,
    error: null,
    hasMore: false,
    loadMore: vi.fn(),
    reload: vi.fn(),
    apply: vi.fn(),
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()

  searchParams.delete('status')
  searchParams.delete('search')
  searchParams.delete('sort')
  searchParams.delete('limit')
})

afterEach(() => {
  cleanup()
})

describe('TicketListPage', () => {
  it('pokazuje ladowanie przed otrzymaniem wyniku', () => {
    tickets.mockReturnValue(result([], { total: null, loading: true }))

    render(<TicketListPage />)

    expect(screen.getByText('Ładowanie...')).toBeDefined()
    expect(screen.queryByTestId('ticket-table')).toBeNull()
  })

  it('pokazuje blad pobierania', () => {
    tickets.mockReturnValue(
      result([], { total: null, error: 'Serwer niedostepny' }),
    )

    render(<TicketListPage />)

    expect(screen.getByRole('alert').textContent).toContain(
      'Serwer niedostepny',
    )

    expect(screen.queryByTestId('ticket-table')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Mock pusty stan' })).toBeNull()
  })

  it('pokazuje pusty stan gdy wynik nie zawiera ticketow', () => {
    tickets.mockReturnValue(result([]))

    render(<TicketListPage />)

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Mock pusty stan',
      }),
    )

    expect(setSearchParams).toHaveBeenCalled()

    const updater = setSearchParams.mock.calls[0][0] as (
      previous: URLSearchParams,
    ) => URLSearchParams

    const next = updater(new URLSearchParams('search=stary'))

    expect(next.get('search')).toBe(null)

    expect(setSearchParams.mock.calls[0][1]).toEqual({
      replace: false,
    })
  })

  it('pokazuje tabele i doladowanie dla wynikow', () => {
    const loadMore = vi.fn()

    tickets.mockReturnValue(
      result([ticket('ticket-1'), ticket('ticket-2')], {
        nextCursor: 'kursor-1',
        total: 45,
        hasMore: true,
        loadMore,
      }),
    )

    render(<TicketListPage />)

    expect(screen.getByTestId('ticket-table').textContent).toContain(
      'project-1:2:',
    )

    expect(
      screen.getByTestId('load-more').textContent,
    ).toContain('LoadMore 2/45/true/false')

    fireEvent.click(screen.getByTestId('load-more'))

    expect(loadMore).toHaveBeenCalledTimes(1)
    expect(setSearchParams).not.toHaveBeenCalled()
  })

  it('blokuje doladowanie w trakcie pobierania kolejnej strony', () => {
    tickets.mockReturnValue(
      result([ticket('ticket-1')], { hasMore: true, loadingMore: true }),
    )

    render(<TicketListPage />)

    expect(
      screen.getByTestId('load-more').textContent,
    ).toContain('LoadMore 1/1/true/true')
  })

  it('podpina kanal live pod liste', () => {
    const state = result()

    tickets.mockReturnValue(state)

    render(<TicketListPage />)

    expect(useTicketStream).toHaveBeenCalledWith('project-1', {
      onEvent: state.apply,
      onReconnected: state.reload,
    })

    expect(screen.getByRole('status').textContent).toBe('Kanał live aktywny')
  })

  it('prowadzi do analityki projektu', () => {
    tickets.mockReturnValue(result())

    render(<TicketListPage />)

    expect(
      screen.getByRole('link', { name: 'Analityka' }).getAttribute('href'),
    ).toBe('/projects/project-1/analytics')
  })

  it('oznacza tabele jako stale podczas odswiezania wyniku', () => {
    tickets.mockReturnValue(
      result(
        [ticket('ticket-1')],
        {
          loading: true,
        },
      ),
    )

    const { container } = render(<TicketListPage />)

    expect(
      container.querySelector('[aria-busy="true"]'),
    ).not.toBeNull()
  })

  it('zmiana filtra zachowuje pozostale parametry adresu', () => {
    tickets.mockReturnValue(result([ticket('ticket-1')]))

    render(<TicketListPage />)

    fireEvent.click(
      screen.getByRole('button', { name: 'Mock filtr' }),
    )

    expect(setSearchParams).toHaveBeenCalled()

    const updater = setSearchParams.mock.calls[0][0] as (
      previous: URLSearchParams,
    ) => URLSearchParams

    const next = updater(new URLSearchParams('search=koszyk&limit=50'))

    expect(next.get('status')).toBe('Resolved')
    expect(next.get('search')).toBe('koszyk')
    expect(next.get('limit')).toBe('50')
  })
})
