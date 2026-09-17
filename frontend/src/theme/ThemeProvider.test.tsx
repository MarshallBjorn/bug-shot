import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ThemeProvider } from './ThemeProvider'
import { useTheme } from './ThemeContext'

function Probe() {
  const { theme, toggle } = useTheme()

  return (
    <button type="button" onClick={toggle}>
      {theme}
    </button>
  )
}

beforeEach(() => {
  document.documentElement.removeAttribute('data-theme')
  vi.stubGlobal('matchMedia', () => ({ matches: false }))
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  document.documentElement.removeAttribute('data-theme')
})

it('przelaczanie zmienia atrybut na dokumencie i zapisuje preferencje', () => {
  const setItem = vi.fn()
  vi.stubGlobal('localStorage', { getItem: () => null, setItem } as unknown as Storage)

  render(
    <ThemeProvider>
      <Probe />
    </ThemeProvider>,
  )

  const button = screen.getByRole('button')

  expect(button.textContent).toBe('light')

  fireEvent.click(button)

  expect(button.textContent).toBe('dark')
  expect(document.documentElement.dataset.theme).toBe('dark')
  expect(setItem).toHaveBeenCalledWith('bugshot-theme', 'dark')

  fireEvent.click(button)

  expect(document.documentElement.dataset.theme).toBe('light')
})

it('useTheme poza dostawca konczy sie jasnym bledem', () => {
  const quiet = vi.spyOn(console, 'error').mockImplementation(() => {})

  expect(() => render(<Probe />)).toThrow('useTheme wymaga ThemeProvider')

  quiet.mockRestore()
})
