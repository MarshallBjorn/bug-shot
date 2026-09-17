import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import TicketFilters from './TicketFilters'
import { emptyQuery, type TicketQuery } from '../ticketQuery'

const query: TicketQuery = {
  ...emptyQuery,
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
    expect(screen.getByRole('button', { name: /Status/ })).toBeDefined()
    expect(screen.getByRole('button', { name: /Więcej filtrów/ })).toBeDefined()
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

  // status jest wielokrotny wiec zaznaczenie dokłada wartosc a nie podmienia calego filtra
  it('zaznaczenie statusu dokłada go do listy', () => {
    const onChange = vi.fn()

    render(
      <TicketFilters
        query={{ ...query, statuses: ['New'] }}
        onChange={onChange}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /Status/ }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Rozwiązane' }))

    expect(onChange).toHaveBeenCalledWith({ statuses: ['New', 'Resolved'] })
  })

  it('odznaczenie statusu zdejmuje go z listy', () => {
    const onChange = vi.fn()

    render(
      <TicketFilters
        query={{ ...query, statuses: ['New', 'Resolved'] }}
        onChange={onChange}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /Status/ }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Nowe' }))

    expect(onChange).toHaveBeenCalledWith({ statuses: ['Resolved'] })
  })

  it('licznik na przycisku pokazuje ile statusow jest wybranych', () => {
    render(
      <TicketFilters
        query={{ ...query, statuses: ['New', 'Resolved'] }}
        onChange={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: /Status\s*2/ })).toBeDefined()
  })
})
