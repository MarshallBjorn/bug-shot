import { MemoryRouter } from 'react-router'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import TicketTable from './TicketTable'
import type { TicketListItem } from '../types'

function ticket(
  patch: Partial<TicketListItem> = {},
): TicketListItem {
  return {
    id: 'ticket-1',
    description: 'Koszyk gubi produkty',
    pageUrl: 'https://acme.example/cart',
    page: 'acme.example/cart',
    browserName: 'Chrome',
    osName: 'Windows',
    deviceType: 'desktop',
    status: 'New',
    reportedAt: null,
    receivedAt: '2026-09-14T10:00:00+00:00',
    updatedAt: '2026-09-14T10:00:00+00:00',
    commentCount: 0,
    hasScreenshot: false,
    hasConsoleLog: false,
    ...patch,
  }
}

function renderTable(items: TicketListItem[]) {
  return render(
    <MemoryRouter>
      <TicketTable
        projectId="project-1"
        items={items}
        listSearch="search=koszyk"
      />
    </MemoryRouter>,
  )
}

describe('TicketTable', () => {
  it('renderuje naglowki i wiersz ticketu', () => {
    renderTable([ticket()])

    expect(screen.getByRole('table')).toBeDefined()
    expect(screen.getByRole('columnheader', { name: 'Opis' })).toBeDefined()
    expect(screen.getByRole('columnheader', { name: 'Adres strony' })).toBeDefined()
    expect(screen.getByRole('columnheader', { name: 'Status' })).toBeDefined()
    expect(screen.getByRole('columnheader', { name: 'Zgłoszono' })).toBeDefined()
    expect(screen.getByRole('link', { name: 'Koszyk gubi produkty' })).toBeDefined()
    expect(screen.getByText('Nowe')).toBeDefined()
  })

  it('pokazuje znaczniki zrzutu i logu konsoli tylko gdy sa', () => {
    renderTable([
      ticket({ id: '1', description: 'Z oboma', hasScreenshot: true, hasConsoleLog: true }),
      ticket({ id: '2', description: 'Bez niczego' }),
    ])

    expect(screen.getAllByText('Ma zrzut ekranu')).toHaveLength(1)
    expect(screen.getAllByText('Ma log konsoli')).toHaveLength(1)
  })

  it('renderuje wiele ticketow', () => {
    renderTable([
      ticket({ id: '1', description: 'Pierwszy' }),
      ticket({ id: '2', description: 'Drugi', status: 'Resolved' }),
    ])

    expect(screen.getByRole('link', { name: 'Pierwszy' })).toBeDefined()
    expect(screen.getByRole('link', { name: 'Drugi' })).toBeDefined()
    expect(screen.getByText('Rozwiązane')).toBeDefined()
  })
})
