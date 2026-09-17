import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import TicketStatusMenu from './TicketStatusMenu'

afterEach(() => {
  cleanup()
})

function open(status: Parameters<typeof TicketStatusMenu>[0]['status'], onPick = vi.fn()) {
  render(
    <TicketStatusMenu status={status} onPick={onPick}>
      <button type="button">Zmień</button>
    </TicketStatusMenu>,
  )

  fireEvent.pointerDown(
    screen.getByRole('button', { name: 'Zmień' }),
    { ctrlKey: false, button: 0 },
  )

  return onPick
}

describe('menu statusu', () => {
  it('pokazuje tylko legalne przejscia z obecnego stanu', () => {
    open('New')

    expect(screen.getByRole('menuitem', { name: 'W trakcie' })).toBeDefined()
    expect(screen.getByRole('menuitem', { name: 'Odrzucone' })).toBeDefined()
    expect(screen.queryByRole('menuitem', { name: 'Rozwiązane' })).toBeNull()
  })

  it('stan koncowy wraca tylko do W trakcie', () => {
    open('Resolved')

    expect(screen.getByRole('menuitem', { name: 'W trakcie' })).toBeDefined()
    expect(screen.queryByRole('menuitem', { name: 'Odrzucone' })).toBeNull()
  })

  it('tombstone nie ma przejsc', () => {
    open('Deleted')

    expect(screen.getByText('Brak przejść')).toBeDefined()
    expect(screen.queryAllByRole('menuitem')).toHaveLength(0)
  })

  it('wybor oddaje docelowy status', () => {
    const onPick = open('InProgress')

    fireEvent.click(screen.getByRole('menuitem', { name: 'Rozwiązane' }))

    expect(onPick).toHaveBeenCalledWith('Resolved')
  })
})
