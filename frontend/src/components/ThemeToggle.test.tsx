import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import ThemeToggle from './ThemeToggle'
import { ThemeProvider } from '../theme/ThemeProvider'

beforeEach(() => {
  document.documentElement.removeAttribute('data-theme')
  vi.stubGlobal('matchMedia', () => ({ matches: false }))
  vi.stubGlobal('localStorage', { getItem: () => null, setItem: vi.fn() } as unknown as Storage)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

// etykieta mowi co przycisk zrobi a nie w jakim motywie jesteśmy
it('etykieta zapowiada docelowy motyw', () => {
  render(
    <ThemeProvider>
      <ThemeToggle />
    </ThemeProvider>,
  )

  const button = screen.getByRole('button', { name: 'Włącz motyw ciemny' })

  fireEvent.click(button)

  expect(screen.getByRole('button', { name: 'Włącz motyw jasny' })).toBeDefined()
})
