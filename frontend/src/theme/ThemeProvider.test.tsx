import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ThemeProvider } from './ThemeProvider'
import { useTheme } from './ThemeContext'

function Probe() {
  const { mode, theme, setMode } = useTheme()

  return (
    <>
      <span data-testid="stan">{`${mode}/${theme}`}</span>
      <button type="button" onClick={() => setMode('dark')}>
        ciemny
      </button>
      <button type="button" onClick={() => setMode('system')}>
        systemowy
      </button>
    </>
  )
}

// atrapa zapytania medialnego z mozliwoscia zmiany odpowiedzi w trakcie testu
function stubMatchMedia(dark: boolean) {
  const listeners = new Set<(event: MediaQueryListEvent) => void>()
  const query = {
    matches: dark,
    addEventListener: (_: string, listener: (event: MediaQueryListEvent) => void) =>
      listeners.add(listener),
    removeEventListener: (_: string, listener: (event: MediaQueryListEvent) => void) =>
      listeners.delete(listener),
  }

  vi.stubGlobal('matchMedia', () => query)

  return (next: boolean) => {
    query.matches = next
    listeners.forEach((listener) => listener({ matches: next } as MediaQueryListEvent))
  }
}

beforeEach(() => {
  document.documentElement.removeAttribute('data-theme')
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  document.documentElement.removeAttribute('data-theme')
})

it('bez zapisanej preferencji idzie za systemem i zmienia sie razem z nim', () => {
  const setSystemDark = stubMatchMedia(false)
  vi.stubGlobal('localStorage', { getItem: () => null, setItem: vi.fn() } as unknown as Storage)

  render(
    <ThemeProvider>
      <Probe />
    </ThemeProvider>,
  )

  expect(screen.getByTestId('stan').textContent).toBe('system/light')
  expect(document.documentElement.dataset.theme).toBe('light')

  act(() => setSystemDark(true))

  expect(screen.getByTestId('stan').textContent).toBe('system/dark')
  expect(document.documentElement.dataset.theme).toBe('dark')
})

it('jawny wybor zapisuje sie i przestaje sluchac systemu', () => {
  const setSystemDark = stubMatchMedia(false)
  const setItem = vi.fn()
  vi.stubGlobal('localStorage', { getItem: () => null, setItem } as unknown as Storage)

  render(
    <ThemeProvider>
      <Probe />
    </ThemeProvider>,
  )

  fireEvent.click(screen.getByRole('button', { name: 'ciemny' }))

  expect(setItem).toHaveBeenCalledWith('bugshot-theme', 'dark')
  expect(document.documentElement.dataset.theme).toBe('dark')

  act(() => setSystemDark(true))
  act(() => setSystemDark(false))

  expect(document.documentElement.dataset.theme).toBe('dark')
})

it('powrot na tryb systemowy oddaje decyzje systemowi', () => {
  stubMatchMedia(true)
  vi.stubGlobal('localStorage', { getItem: () => 'light', setItem: vi.fn() } as unknown as Storage)

  render(
    <ThemeProvider>
      <Probe />
    </ThemeProvider>,
  )

  expect(document.documentElement.dataset.theme).toBe('light')

  fireEvent.click(screen.getByRole('button', { name: 'systemowy' }))

  expect(screen.getByTestId('stan').textContent).toBe('system/dark')
  expect(document.documentElement.dataset.theme).toBe('dark')
})

it('useTheme poza dostawca konczy sie jasnym bledem', () => {
  const quiet = vi.spyOn(console, 'error').mockImplementation(() => {})

  expect(() => render(<Probe />)).toThrow('useTheme wymaga ThemeProvider')

  quiet.mockRestore()
})
