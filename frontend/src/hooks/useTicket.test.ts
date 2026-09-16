import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '../api/client'
import { getTicket } from '../api/tickets'
import type { TicketDetails } from '../types'
import { useTicket } from './useTicket'

vi.mock('../api/tickets', () => ({
  getTicket: vi.fn(),
}))

const ticket = {
  id: 'ticket-1',
  status: 'New',
} as TicketDetails

function createApiError(status: number, message: string) {
  const error = Object.create(ApiError.prototype) as ApiError & {
    status: number
  }

  error.status = status
  error.message = message

  return error
}

describe('useTicket', () => {
  it('startuje w stanie loading', () => {
    vi.mocked(getTicket).mockImplementation(
      () => new Promise(() => undefined),
    )

    const { result: hook } = renderHook(() => useTicket('ticket-1'))

    expect(hook.current.ticket).toBe(null)
    expect(hook.current.missing).toBe(false)
    expect(hook.current.error).toBe(null)
    expect(hook.current.loading).toBe(true)
    expect(typeof hook.current.reload).toBe('function')
  })

  it('zwraca ticket po udanym pobraniu', async () => {
    vi.mocked(getTicket).mockResolvedValue(ticket)

    const { result: hook } = renderHook(() => useTicket('ticket-1'))

    await waitFor(() => {
      expect(hook.current.loading).toBe(false)
    })

    expect(hook.current.ticket).toBe(ticket)
    expect(hook.current.missing).toBe(false)
    expect(hook.current.error).toBe(null)

    expect(getTicket).toHaveBeenCalledWith(
      'ticket-1',
      expect.any(AbortSignal),
    )
  })

  it('traktuje 404 jako brak ticketu', async () => {
    vi.mocked(getTicket).mockRejectedValue(
      createApiError(404, 'Ticket not found'),
    )

    const { result: hook } = renderHook(() => useTicket('ticket-1'))

    await waitFor(() => {
      expect(hook.current.loading).toBe(false)
    })

    expect(hook.current.ticket).toBe(null)
    expect(hook.current.missing).toBe(true)
    expect(hook.current.error).toBe(null)
  })

  it('zwraca blad dla nieudanego pobrania', async () => {
    vi.mocked(getTicket).mockRejectedValue(
      new Error('Nie mozna pobrac ticketu'),
    )

    const { result: hook } = renderHook(() => useTicket('ticket-1'))

    await waitFor(() => {
      expect(hook.current.loading).toBe(false)
    })

    expect(hook.current.ticket).toBe(null)
    expect(hook.current.missing).toBe(false)
    expect(hook.current.error).toBe('Nie mozna pobrac ticketu')
  })

  it('zwraca blad dla ApiError innego niz 404', async () => {
    vi.mocked(getTicket).mockRejectedValue(
      createApiError(500, 'Internal server error'),
    )

    const { result: hook } = renderHook(() => useTicket('ticket-1'))

    await waitFor(() => {
      expect(hook.current.loading).toBe(false)
    })

    expect(hook.current.ticket).toBe(null)
    expect(hook.current.missing).toBe(false)
    expect(hook.current.error).toBe('Internal server error')
  })

  it('reload ponownie pobiera ticket', async () => {
    vi.mocked(getTicket).mockResolvedValue(ticket)

    const { result: hook } = renderHook(() => useTicket('ticket-1'))

    await waitFor(() => {
      expect(hook.current.loading).toBe(false)
    })

    expect(getTicket).toHaveBeenCalledTimes(1)

    hook.current.reload()

    await waitFor(() => {
      expect(getTicket).toHaveBeenCalledTimes(2)
    })

    expect(hook.current.ticket).toBe(ticket)
    expect(hook.current.loading).toBe(false)
  })

  it('nie ustawia bledu po abort', () => {
    vi.mocked(getTicket).mockImplementation(
      (_ticketId, signal) =>
        new Promise<never>((_resolve, reject) => {
          signal?.addEventListener('abort', () => {
            reject(new Error('aborted'))
          })
        }),
    )

    const { result: hook, unmount } = renderHook(
      () => useTicket('ticket-1'),
    )

    expect(hook.current.loading).toBe(true)

    unmount()
  })
})
