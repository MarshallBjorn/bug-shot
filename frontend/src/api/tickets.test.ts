import { describe, expect, it, vi } from 'vitest'
import { apiDelete, apiGet, apiPatch, apiPost } from './client'
import {
  addTicketComment,
  deleteTicket,
  getTicket,
  getTicketComments,
  getTickets,
  updateTicketStatus,
} from './tickets'

vi.mock('./client', () => ({
  apiDelete: vi.fn(),
  apiGet: vi.fn(),
  apiPatch: vi.fn(),
  apiPost: vi.fn(),
}))

describe('tickets api', () => {
  it('pobiera liste bez query', async () => {
    vi.mocked(apiGet).mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 })

    const query = {
      status: null,
      search: '',
      sort: 'receivedAt:desc' as const,
      page: 1,
      pageSize: 20,
    }

    await getTickets('p1', query)

    expect(apiGet).toHaveBeenCalledWith(
      '/api/v1/projects/p1/tickets',
      undefined,
    )
  })

  it('dodaje query do listy ticketow', async () => {
    vi.mocked(apiGet).mockResolvedValue({ items: [], total: 0, page: 2, pageSize: 50 })

    const query = {
      status: 'Resolved' as const,
      search: 'login bug',
      sort: 'reportedAt:asc' as const,
      page: 2,
      pageSize: 50,
    }

    await getTickets('p1', query)

    expect(apiGet).toHaveBeenCalledWith(
      '/api/v1/projects/p1/tickets?status=Resolved&search=login+bug&sort=reportedAt%3Aasc&page=2&pageSize=50',
      undefined,
    )
  })

  it('przekazuje signal do listy ticketow', async () => {
    const signal = new AbortController().signal
    vi.mocked(apiGet).mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 })

    const query = {
      status: null,
      search: '',
      sort: 'receivedAt:desc' as const,
      page: 1,
      pageSize: 20,
    }

    await getTickets('p1', query, signal)

    expect(apiGet).toHaveBeenCalledWith('/api/v1/projects/p1/tickets', signal)
  })

  it('pobiera szczegoly ticketu', async () => {
    const ticket = { id: 't1' }
    vi.mocked(apiGet).mockResolvedValue(ticket)

    await expect(getTicket('t1')).resolves.toEqual(ticket)
    expect(apiGet).toHaveBeenCalledWith('/api/v1/tickets/t1', undefined)
  })

  it('pobiera komentarze z domyslna paginacja', async () => {
    vi.mocked(apiGet).mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 50 })

    await getTicketComments('t1')

    expect(apiGet).toHaveBeenCalledWith(
      '/api/v1/tickets/t1/comments?page=1&pageSize=50',
      undefined,
    )
  })

  it('pobiera komentarze z zadana paginacja i sygnalem', async () => {
    const signal = new AbortController().signal
    vi.mocked(apiGet).mockResolvedValue({ items: [], total: 1, page: 2, pageSize: 10 })

    await getTicketComments('t1', 2, 10, signal)

    expect(apiGet).toHaveBeenCalledWith(
      '/api/v1/tickets/t1/comments?page=2&pageSize=10',
      signal,
    )
  })

  it('dodaje komentarz', async () => {
    const comment = { id: 'c1' }
    vi.mocked(apiPost).mockResolvedValue(comment)

    await expect(addTicketComment('t1', 'Radek', 'Test')).resolves.toEqual(comment)
    expect(apiPost).toHaveBeenCalledWith('/api/v1/tickets/t1/comments', {
      author: 'Radek',
      body: 'Test',
    })
  })

  it('usuwa ticket', async () => {
    vi.mocked(apiDelete).mockResolvedValue(undefined)

    await deleteTicket('t1')

    expect(apiDelete).toHaveBeenCalledWith('/api/v1/tickets/t1')
  })

  it('zmienia status ticketu i wysyla If-Match', async () => {
    const response = {
      id: 't1',
      status: 'Resolved',
      rowVersion: 'rv-2',
      updatedAt: '2026-09-14T10:00:00Z',
    }

    vi.mocked(apiPatch).mockResolvedValue(response)

    await expect(
      updateTicketStatus('t1', 'Resolved', 'rv-1', 'dashboard'),
    ).resolves.toEqual(response)

    expect(apiPatch).toHaveBeenCalledWith(
      '/api/v1/tickets/t1/status',
      {
        status: 'Resolved',
        changedBy: 'dashboard',
      },
      {
        'If-Match': 'rv-1',
      },
    )
  })
})
