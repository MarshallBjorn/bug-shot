import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import TicketsEmptyState from './TicketsEmptyState'
import { clearedFilters, emptyQuery, type TicketQuery } from '../ticketQuery'

const base: TicketQuery = {
  ...emptyQuery,
  search: '',
  sort: 'receivedAt:desc',
  limit: 20,
}

afterEach(() => {
  cleanup()
})

describe('TicketsEmptyState', () => {
  it('pokazuje komunikat gdy lista jest filtrowana', () => {
    render(
      <TicketsEmptyState
        query={{ ...base, search: 'koszyk' }}
        onChange={vi.fn()}
      />,
    )

    expect(
      screen.getByText('Żadne zgłoszenie nie pasuje do filtrów.'),
    ).toBeDefined()

    expect(
      screen.getByRole('button', { name: 'Wyczyść filtry' }),
    ).toBeDefined()
  })

  it('czysci filtry i zostawia sortowanie', () => {
    const onChange = vi.fn()

    render(
      <TicketsEmptyState
        query={{ ...base, statuses: ['Resolved'], sort: 'reportedAt:asc' }}
        onChange={onChange}
      />,
    )

    fireEvent.click(
      screen.getByRole('button', { name: 'Wyczyść filtry' }),
    )

    expect(onChange).toHaveBeenCalledWith(clearedFilters)
  })

  it('pokazuje pusty projekt bez filtrow', () => {
    render(
      <TicketsEmptyState
        query={base}
        onChange={vi.fn()}
      />,
    )

    expect(
      screen.getByText('Ten projekt nie ma jeszcze żadnych zgłoszeń.'),
    ).toBeDefined()

    expect(
      screen.getByText('Pierwsze pojawi się tutaj gdy widget wyśle zgłoszenie.'),
    ).toBeDefined()
  })
})
