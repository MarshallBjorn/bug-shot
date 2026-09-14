import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { getTickets } from '../api/tickets'
import type { TicketQuery } from '../ticketQuery'
import { useTickets } from './useTickets'

vi.mock('../api/tickets', () => ({
  getTickets: vi.fn(),
}))

const query: TicketQuery = {
  status: null,
  search: '',
  sort: 'receivedAt:desc',
  page: 1,
  pageSize: 20,
}

const result = {
  items: [],
  total: 0,
  page: 1,
  pageSize: 20,
}

describe('useTickets', () => {
  it('startuje w stanie loading', () => {
    vi.mocked(getTickets).mockImplementation(
      () => new Promise(() => undefined),
    )

    const { result: hook } = renderHook(() => useTickets('p1', query))

    expect(hook.current).toEqual({
      result: null,
      error: null,
      loading: true,
    })
  })

  it('zwraca wynik po udanym pobraniu', async () => {
    vi.mocked(getTickets).mockResolvedValue(result)

    const { result: hook } = renderHook(() => useTickets('p1', query))

    await waitFor(() => {
      expect(hook.current.loading).toBe(false)
    })

    expect(hook.current).toEqual({
      result,
      error: null,
      loading: false,
    })

    expect(getTickets).toHaveBeenCalledWith(
      'p1',
      query,
      expect.any(AbortSignal),
    )
  })

  it('zwraca komunikat bledu po nieudanym pobraniu', async () => {
    vi.mocked(getTickets).mockRejectedValue(
      new Error('Nie mozna pobrac ticketow'),
    )

    const { result: hook } = renderHook(() => useTickets('p1', query))

    await waitFor(() => {
      expect(hook.current.loading).toBe(false)
    })

    expect(hook.current).toEqual({
      result: null,
      error: 'Nie mozna pobrac ticketow',
      loading: false,
    })
  })

  it('nie ustawia bledu po abort', () => {
    vi.mocked(getTickets).mockImplementation(
      (_projectId, _query, signal) =>
        new Promise<never>((_resolve, reject) => {
          signal?.addEventListener('abort', () => {
            reject(new Error('aborted'))
          })
        }),
    )

    const { result: hook, unmount } = renderHook(
      () => useTickets('p1', query),
    )

    expect(hook.current.loading).toBe(true)

    unmount()

    expect(hook.current.loading).toBe(true)
    expect(hook.current.error).toBe(null)
  })

  it('podczas zmiany projektu nie pokazuje poprzedniego wyniku', async () => {
    vi.mocked(getTickets).mockResolvedValue(result)

    const { result: hook, rerender } = renderHook(
      ({ projectId }) => useTickets(projectId, query),
      {
        initialProps: { projectId: 'p1' },
      },
    )

    await waitFor(() => {
      expect(hook.current.loading).toBe(false)
    })

    rerender({ projectId: 'p2' })

    expect(hook.current.loading).toBe(true)
    expect(hook.current.result).toBe(null)
    expect(hook.current.error).toBe(null)
  })

  it('podczas zmiany filtra pozostawia poprzedni wynik projektu', async () => {
    vi.mocked(getTickets).mockResolvedValue(result)

    const firstQuery = query

    const secondQuery: TicketQuery = {
      ...query,
      search: 'login',
    }

    const { result: hook, rerender } = renderHook(
      ({ currentQuery }) => useTickets('p1', currentQuery),
      {
        initialProps: {
          currentQuery: firstQuery,
        },
      },
    )

    await waitFor(() => {
      expect(hook.current.loading).toBe(false)
    })

    rerender({
      currentQuery: secondQuery,
    })

    expect(hook.current.loading).toBe(true)
    expect(hook.current.result).toBe(result)
    expect(hook.current.error).toBe(null)
  })
})
