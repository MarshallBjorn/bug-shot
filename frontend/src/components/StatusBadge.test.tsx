import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import StatusBadge from './StatusBadge'
import { ticketStatuses } from '../ticketQuery'

afterEach(() => {
  cleanup()
})

it('kazdy status ma polska etykiete i wlasny ton', () => {
  const { container } = render(
    <>
      {ticketStatuses.map((status) => (
        <StatusBadge key={status} status={status} />
      ))}
    </>,
  )

  expect(screen.getByText('Nowe')).toBeDefined()
  expect(screen.getByText('Usunięte')).toBeDefined()

  const tones = new Set(
    Array.from(container.querySelectorAll('span')).map((node) => node.className),
  )

  expect(tones.size).toBe(ticketStatuses.length)
})
