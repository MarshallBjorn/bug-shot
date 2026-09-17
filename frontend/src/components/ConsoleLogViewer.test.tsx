import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ConsoleLogViewer from './ConsoleLogViewer'

const log = [
  '[2026-07-09T11:42:14.623Z] ERROR window.onerror: Uncaught ReferenceError: dataLayer is not defined | stack=at analytics.js:12:5',
  '[2026-07-09T11:42:21.623Z] WARN console.warn: Brak ceny w odpowiedzi /api/cart',
  '[2026-07-09T11:42:28.623Z] INFO console.log: widok gotowy',
].join('\n')

afterEach(() => {
  cleanup()
})

describe('viewer logu konsoli', () => {
  it('pokazuje wszystkie wpisy z licznikami per poziom', () => {
    render(<ConsoleLogViewer text={log} />)

    expect(screen.getByText('3 wpisów')).toBeDefined()
    expect(screen.getByRole('button', { name: /ERROR/ }).textContent).toContain('1')
    expect(screen.getByRole('button', { name: /DEBUG/ }).textContent).toContain('0')
  })

  it('nieznany format mowi o tym wprost', () => {
    render(<ConsoleLogViewer text="cokolwiek bez naglowka" />)

    expect(screen.getByText(/Log konsoli jest pusty albo ma nieznany format/)).toBeDefined()
  })

  it('chip poziomu zaweza liste', () => {
    render(<ConsoleLogViewer text={log} />)

    fireEvent.click(screen.getByRole('button', { name: /ERROR/ }))

    expect(screen.getByText('1 z 3 wpisów')).toBeDefined()
    expect(screen.queryByText('widok gotowy')).toBeNull()
  })

  it('drugi klik zdejmuje chip', () => {
    render(<ConsoleLogViewer text={log} />)

    const chip = screen.getByRole('button', { name: /WARN/ })

    fireEvent.click(chip)
    expect(chip.getAttribute('aria-pressed')).toBe('true')

    fireEvent.click(chip)
    expect(chip.getAttribute('aria-pressed')).toBe('false')
    expect(screen.getByText('3 wpisów')).toBeDefined()
  })

  // deep link z bloku logu na detalu wchodzi przefiltrowany
  it('poziom z wejscia jest od razu wlaczony', () => {
    render(<ConsoleLogViewer text={log} initialLevel="ERROR" />)

    expect(screen.getByRole('button', { name: /ERROR/ }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByText('1 z 3 wpisów')).toBeDefined()
  })

  it('szukanie idzie po tresci', () => {
    render(<ConsoleLogViewer text={log} />)

    fireEvent.change(screen.getByRole('searchbox', { name: 'Szukaj w logu' }), {
      target: { value: 'dataLayer' },
    })

    expect(screen.getByText('1 z 3 wpisów')).toBeDefined()
  })

  it('brak trafien mowi o tym zamiast zostawiac pusto', () => {
    render(<ConsoleLogViewer text={log} />)

    fireEvent.change(screen.getByRole('searchbox', { name: 'Szukaj w logu' }), {
      target: { value: 'nie ma tego' },
    })

    expect(screen.getByText('Żaden wpis nie pasuje do filtrów.')).toBeDefined()
  })

  it('filtr zrodla wystawia tylko zrodla z logu', () => {
    render(<ConsoleLogViewer text={log} />)

    const select = screen.getByRole('combobox', { name: 'Źródło' })

    fireEvent.change(select, { target: { value: 'console.warn' } })

    expect(screen.getByText('1 z 3 wpisów')).toBeDefined()
  })

  it('ramka stosu wychodzi osobno od tresci', () => {
    render(<ConsoleLogViewer text={log} />)

    expect(screen.getByText('at analytics.js:12:5')).toBeDefined()
  })

  it('przelacznik zawijania zmienia stan', () => {
    render(<ConsoleLogViewer text={log} />)

    const toggle = screen.getByRole('button', { name: 'Zawijaj' })

    expect(toggle.getAttribute('aria-pressed')).toBe('true')

    fireEvent.click(toggle)

    expect(toggle.getAttribute('aria-pressed')).toBe('false')
  })

  it('kopiowanie oddaje widoczne wpisy do schowka', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })

    render(<ConsoleLogViewer text={log} />)

    fireEvent.click(screen.getByRole('button', { name: 'Kopiuj' }))

    await vi.waitFor(() => expect(writeText).toHaveBeenCalledTimes(1))
    expect(writeText.mock.calls[0][0]).toContain('widok gotowy')

    vi.unstubAllGlobals()
  })

  it('brak zgody na schowek nie wywraca widoku', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('NotAllowedError'))
    vi.stubGlobal('navigator', { clipboard: { writeText } })

    render(<ConsoleLogViewer text={log} />)

    fireEvent.click(screen.getByRole('button', { name: 'Kopiuj' }))

    await vi.waitFor(() => expect(writeText).toHaveBeenCalled())
    expect(screen.getByText('3 wpisów')).toBeDefined()

    vi.unstubAllGlobals()
  })

  it('JSON w tresci wychodzi sformatowany i pokolorowany', () => {
    render(
      <ConsoleLogViewer text='[2026-09-17T10:00:00.000Z] ERROR console.error: {"name":"TypeError","line":12}' />,
    )

    expect(screen.getByText('"name"')).toBeDefined()
    expect(screen.getByText('"TypeError"')).toBeDefined()
    expect(screen.getByText('12')).toBeDefined()
  })

  it('przyciecie przez widget jest zaznaczone', () => {
    render(
      <ConsoleLogViewer text="[2026-09-17T10:00:00.000Z] INFO console.log: dlugo [truncated]" />,
    )

    expect(screen.getByText(/Wpis został przycięty przez widget/)).toBeDefined()
  })
})
