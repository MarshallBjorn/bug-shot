import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import TicketFilters from './TicketFilters'
import type { TicketQuery } from '../ticketQuery'

const query: TicketQuery = {
  status: null,
  search: '',
  sort: 'receivedAt:desc',
  limit: 20,
}

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('TicketFilters', () => {
  it('renderuje kontrolki filtrow', () => {
    render(
      <TicketFilters
        query={query}
        onChange={vi.fn()}
      />,
    )

    expect(screen.getByRole('searchbox', { name: 'Szukaj' })).toBeDefined()
    expect(screen.getByRole('combobox', { name: 'Status' })).toBeDefined()
    expect(screen.getByRole('combobox', { name: 'Sortowanie' })).toBeDefined()
  })

  it('wysyla zmiane wyszukiwania po debounce', () => {
    vi.useFakeTimers()

    const onChange = vi.fn()

    render(
      <TicketFilters
        query={query}
        onChange={onChange}
      />,
    )

    const input = screen.getByRole('searchbox', { name: 'Szukaj' })

    fireEvent.change(input, {
      target: { value: 'koszyk' },
    })

    expect(onChange).not.toHaveBeenCalled()

    vi.advanceTimersByTime(299)
    expect(onChange).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)

    expect(onChange).toHaveBeenCalledWith(
      { search: 'koszyk' },
      true,
    )
  })

  it('wysyla zmiane statusu', () => {
    const onChange = vi.fn()

    render(
      <TicketFilters
        query={query}
        onChange={onChange}
      />,
    )

    fireEvent.change(
      screen.getByRole('combobox', { name: 'Status' }),
      {
        target: { value: 'Resolved' },
      },
    )

    expect(onChange).toHaveBeenCalledWith({
      status: 'Resolved',
    })
  })
})
