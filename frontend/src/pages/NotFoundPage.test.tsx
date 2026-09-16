import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it } from 'vitest'
import NotFoundPage from './NotFoundPage'

afterEach(() => {
  cleanup()
})

describe('NotFoundPage', () => {
  it('pokazuje komunikat i link powrotu', () => {
    render(
      <MemoryRouter>
        <NotFoundPage />
      </MemoryRouter>,
    )

    expect(screen.getByText('Nie ma takiej strony')).toBeDefined()

    const link = screen.getByRole('link', {
      name: 'Wróć na start',
    })

    expect(link.getAttribute('href')).toBe('/')
  })
})
