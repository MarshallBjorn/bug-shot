import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useKeyboardShortcuts, type Shortcut } from './useKeyboardShortcuts'

function Probe({ shortcuts, enabled }: { shortcuts: Shortcut[]; enabled?: boolean }) {
  useKeyboardShortcuts(shortcuts, enabled)

  return (
    <>
      <input aria-label="pole" />
      <textarea aria-label="obszar" />
      <select aria-label="lista">
        <option>a</option>
      </select>
      <div aria-label="edytowalny" contentEditable="true" suppressContentEditableWarning />
      <div role="dialog" aria-label="popover" tabIndex={-1}>
        <span>tresc</span>
      </div>
      <div role="menu" aria-label="menu" tabIndex={-1} />
    </>
  )
}

function press(key: string, target?: Element, extra: Partial<KeyboardEventInit> = {}) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...extra })

  ;(target ?? document.body).dispatchEvent(event)

  return event
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('skroty klawiszowe', () => {
  it('wolaja akcje dla swojego klawisza', () => {
    const onPress = vi.fn()

    render(<Probe shortcuts={[{ key: 'j', onPress }]} />)

    press('j')

    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it('nieznany klawisz nic nie robi i nie blokuje przegladarki', () => {
    const onPress = vi.fn()

    render(<Probe shortcuts={[{ key: 'j', onPress }]} />)

    const event = press('q')

    expect(onPress).not.toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(false)
  })

  it('obsluzony klawisz nie idzie dalej do przegladarki', () => {
    render(<Probe shortcuts={[{ key: '/', onPress: vi.fn() }]} />)

    expect(press('/').defaultPrevented).toBe(true)
  })

  // pisanie w polu nie moze wywolywac skrotow, inaczej / w szukaniu bylo by nie do wpisania
  it('milczy gdy focus jest w polu tekstowym', () => {
    const onPress = vi.fn()

    const view = render(<Probe shortcuts={[{ key: 'x', onPress }]} />)

    for (const label of ['pole', 'obszar', 'lista', 'edytowalny']) {
      press('x', view.getByLabelText(label))
    }

    expect(onPress).not.toHaveBeenCalled()
  })

  it('milczy w popoverze dialogu i menu bo maja wlasna klawiature', () => {
    const onPress = vi.fn()

    const view = render(<Probe shortcuts={[{ key: '/', onPress }]} />)

    press('/', view.getByLabelText('popover'))
    press('/', view.getByText('tresc'))
    press('/', view.getByLabelText('menu'))

    expect(onPress).not.toHaveBeenCalled()
  })

  it('milczy gdy klawisz obsluzyl juz ktos inny', () => {
    const onPress = vi.fn()

    render(<Probe shortcuts={[{ key: 'Enter', onPress }]} />)

    const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
    event.preventDefault()
    document.body.dispatchEvent(event)

    expect(onPress).not.toHaveBeenCalled()
  })

  it('milczy przy modyfikatorach bo skrot nalezy wtedy do systemu', () => {
    const onPress = vi.fn()

    render(<Probe shortcuts={[{ key: 'k', onPress }]} />)

    press('k', undefined, { metaKey: true })
    press('k', undefined, { ctrlKey: true })
    press('k', undefined, { altKey: true })

    expect(onPress).not.toHaveBeenCalled()
  })

  it('wylaczone skroty nie sluchaja wcale', () => {
    const onPress = vi.fn()

    render(<Probe shortcuts={[{ key: 'j', onPress }]} enabled={false} />)

    press('j')

    expect(onPress).not.toHaveBeenCalled()
  })

  it('odmontowanie zdejmuje nasluch', () => {
    const onPress = vi.fn()

    const view = render(<Probe shortcuts={[{ key: 'j', onPress }]} />)
    view.unmount()

    press('j')

    expect(onPress).not.toHaveBeenCalled()
  })
})
