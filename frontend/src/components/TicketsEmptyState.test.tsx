import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import TicketsEmptyState from './TicketsEmptyState'
import type { TicketQuery } from '../ticketQuery'

const base: TicketQuery = {
  status: null,
  search: '',
  sort: 'receivedAt:desc',
  page: 1,
  pageSize: 20,
}

describe('TicketsEmptyState', () => {
  it('pokazuje komunikat gdy lista jest filtrowana', () => {
    render(
      <TicketsEmptyState
        query={{ ...base, search: 'koszyk' }}
        total={0}
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

  it('pozwala wrocic do pierwszej strony gdy zostaly wyniki poza biezaca strona', () => {
    const onChange = vi.fn()

    render(
      <TicketsEmptyState
        query={{ ...base, page: 3 }}
        total={45}
        onChange={onChange}
      />,
    )

    expect(
      screen.getByText('Strona 3 nie ma już wyników.'),
    ).toBeDefined()

    fireEvent.click(
      screen.getByRole('button', { name: 'Wróć na pierwszą stronę' }),
    )

    expect(onChange).toHaveBeenCalledWith({ page: 1 })
  })

  it('pokazuje pusty projekt bez filtrow', () => {
    render(
      <TicketsEmptyState
        query={base}
        total={0}
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
