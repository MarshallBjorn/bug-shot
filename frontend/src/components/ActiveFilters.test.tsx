import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ActiveFilters from './ActiveFilters'
import { chipsFor } from '../activeFilterChips'
import { clearedFilters, emptyQuery } from '../ticketQuery'

afterEach(() => {
  cleanup()
})

describe('chipy aktywnych filtrow', () => {
  it('bez filtra nie renderuje niczego', () => {
    const { container } = render(<ActiveFilters query={emptyQuery} onChange={vi.fn()} />)

    expect(container.firstChild).toBeNull()
  })

  it('kazdy status ma wlasny chip', () => {
    const chips = chipsFor({ ...emptyQuery, statuses: ['New', 'Resolved'] })

    expect(chips.map((chip) => chip.label)).toEqual(['Nowe', 'Rozwiązane'])
  })

  it('zdjecie statusu zostawia pozostale', () => {
    const onChange = vi.fn()

    render(
      <ActiveFilters
        query={{ ...emptyQuery, statuses: ['New', 'Resolved'] }}
        onChange={onChange}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Zdejmij filtr Nowe' }))

    expect(onChange).toHaveBeenCalledWith({ statuses: ['Resolved'] })
  })

  it('pokazuje chip dla kazdego wymiaru', () => {
    const chips = chipsFor({
      ...emptyQuery,
      search: 'koszyk',
      page: 'acme.example/cart',
      browser: 'Chrome',
      os: 'Windows',
      device: 'mobile',
      hasScreenshot: true,
      hasComments: false,
      dateFrom: '2026-09-01',
      dateTo: '2026-09-10',
    })

    expect(chips.map((chip) => chip.label)).toEqual([
      'Szukane: koszyk',
      'Strona: acme.example/cart',
      'Chrome',
      'Windows',
      'Telefon',
      'Ze zrzutem',
      'Bez komentarzy',
      'Od 2026-09-01',
      'Do 2026-09-10',
    ])
  })

  it('odwrocone flagi maja wlasne etykiety', () => {
    const chips = chipsFor({ ...emptyQuery, hasScreenshot: false, hasComments: true })

    expect(chips.map((chip) => chip.label)).toEqual(['Bez zrzutu', 'Skomentowane'])
  })

  it('czyszczenie zdejmuje wszystkie filtry naraz', () => {
    const onChange = vi.fn()

    render(<ActiveFilters query={{ ...emptyQuery, search: 'koszyk' }} onChange={onChange} />)

    fireEvent.click(screen.getByRole('button', { name: 'Wyczyść filtry' }))

    expect(onChange).toHaveBeenCalledWith(clearedFilters)
  })
})
