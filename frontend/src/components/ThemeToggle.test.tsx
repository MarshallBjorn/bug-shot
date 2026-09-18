import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import ThemeToggle from './ThemeToggle'
import { ThemeProvider } from '../theme/ThemeProvider'

beforeEach(() => {
  document.documentElement.removeAttribute('data-theme')
  vi.stubGlobal('matchMedia', () => ({ matches: false }))
  vi.stubGlobal('localStorage', { getItem: () => null, setItem: vi.fn() } as unknown as Storage)
})

// Radix otwiera menu na pointerDown a nie na click
function openMenu() {
  fireEvent.pointerDown(screen.getByRole('button', { name: /^Motyw: / }), {
    ctrlKey: false,
    button: 0,
  })
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  document.documentElement.removeAttribute('data-theme')
})

// etykieta niesie wybrany tryb, bo przycisk otwiera liste zamiast przelaczac jedna rzecz
it('etykieta pokazuje wybrany tryb', () => {
  render(
    <ThemeProvider>
      <ThemeToggle />
    </ThemeProvider>,
  )

  expect(screen.getByRole('button', { name: 'Motyw: Systemowy' })).toBeDefined()
})

it('wybor z listy zmienia motyw dokumentu', () => {
  render(
    <ThemeProvider>
      <ThemeToggle />
    </ThemeProvider>,
  )

  openMenu()
  fireEvent.click(screen.getByRole('menuitemradio', { name: 'Ciemny' }))

  expect(document.documentElement.dataset.theme).toBe('dark')
  expect(screen.getByRole('button', { name: 'Motyw: Ciemny' })).toBeDefined()
})

it('lista podaje trzy tryby', () => {
  render(
    <ThemeProvider>
      <ThemeToggle />
    </ThemeProvider>,
  )

  openMenu()

  expect(screen.getAllByRole('menuitemradio').map((item) => item.textContent)).toEqual([
    'Jasny',
    'Ciemny',
    'Systemowy',
  ])
})
