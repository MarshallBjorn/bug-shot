import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import TicketListPage from './TicketListPage'
import { useTickets } from '../hooks/useTickets'

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
    total: number
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

vi.mock('../components/Pagination', () => ({
  default: ({
    page,
    pageSize,
    total,
    onPageChange,
  }: {
    page: number
    pageSize: number
    total: number
    onPageChange: (page: number) => void
  }) => (
    <button
      type="button"
      data-testid="pagination"
      onClick={() => onPageChange(page + 1)}
    >
      Pagination {page}/{pageSize}/{total}
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
  overrides: Record<string, unknown> = {},
) {
  return {
    result: {
      items,
      total: items.length,
      page: 1,
      pageSize: 20,
    },
    error: null,
    loading: false,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()

  searchParams.delete('status')
  searchParams.delete('search')
  searchParams.delete('sort')
  searchParams.delete('page')
  searchParams.delete('pageSize')
})

afterEach(() => {
  cleanup()
})

describe('TicketListPage', () => {
  it('pokazuje ladowanie przed otrzymaniem wyniku', () => {
    tickets.mockReturnValue({
      result: null,
      error: null,
      loading: true,
    })

    render(<TicketListPage />)

    expect(screen.getByText('Ładowanie...')).toBeDefined()
    expect(screen.queryByTestId('ticket-table')).toBeNull()
  })

  it('pokazuje blad pobierania', () => {
    tickets.mockReturnValue({
      result: null,
      error: 'Serwer niedostepny',
      loading: false,
    })

    render(<TicketListPage />)

    expect(screen.getByRole('alert').textContent).toContain(
      'Serwer niedostepny',
    )

    expect(screen.queryByTestId('ticket-table')).toBeNull()
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

  it('pokazuje tabele i paginacje dla wynikow', () => {
    tickets.mockReturnValue(
      result([ticket('ticket-1'), ticket('ticket-2')]),
    )

    render(<TicketListPage />)

    expect(screen.getByTestId('ticket-table').textContent).toContain(
      'project-1:2:',
    )

    expect(
      screen.getByTestId('pagination').textContent,
    ).toContain('Pagination 1/20/2')

    fireEvent.click(screen.getByTestId('pagination'))

    expect(setSearchParams).toHaveBeenCalled()

    const updater = setSearchParams.mock.calls[0][0] as (
      previous: URLSearchParams,
    ) => URLSearchParams

    const next = updater(new URLSearchParams())

    expect(next.get('page')).toBe('2')

    expect(setSearchParams.mock.calls[0][1]).toEqual({
      replace: false,
    })
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
      container.querySelector('.is-stale'),
    ).not.toBeNull()
  })

  it('zmiana filtra resetuje strone do pierwszej', () => {
    searchParams.set('page', '4')

    tickets.mockReturnValue(result([ticket('ticket-1')]))

    render(<TicketListPage />)

    fireEvent.click(
      screen.getByRole('button', { name: 'Mock filtr' }),
    )

    expect(setSearchParams).toHaveBeenCalled()

    const updater = setSearchParams.mock.calls[0][0] as (
      previous: URLSearchParams,
    ) => URLSearchParams

    const next = updater(new URLSearchParams('page=4'))

    expect(next.get('status')).toBe('Resolved')
    expect(next.get('page')).toBe(null)
  })
})
