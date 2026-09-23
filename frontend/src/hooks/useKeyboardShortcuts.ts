import { useEffect } from 'react'

export interface Shortcut {
  key: string
  onPress: () => void
}

const overlays = '[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]'

// skrot nie moze wystrzelic gdy ktos pisze w polu ani gdy trzyma modyfikator
// bo wtedy nalezy do przegladarki albo do systemu
function ignores(event: KeyboardEvent) {
  if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) {
    return true
  }

  const target = event.target

  if (!(target instanceof HTMLElement)) {
    return false
  }

  // closest lapie tez element w srodku obszaru edytowalnego i dziala tam gdzie nie ma
  // isContentEditable, na przyklad w jsdom pod testami
  return (
    target.isContentEditable ||
    target.closest('[contenteditable="true"]') !== null ||
    // popover dialog i menu maja wlasna klawiature wiec skroty listy tam milcza
    target.closest(overlays) !== null ||
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
  )
}

export function useKeyboardShortcuts(shortcuts: Shortcut[], enabled = true) {
  useEffect(() => {
    if (!enabled) {
      return
    }

    function handle(event: KeyboardEvent) {
      if (ignores(event)) {
        return
      }

      const match = shortcuts.find((shortcut) => shortcut.key === event.key)

      if (!match) {
        return
      }

      event.preventDefault()
      match.onPress()
    }

    document.addEventListener('keydown', handle)

    return () => document.removeEventListener('keydown', handle)
  }, [shortcuts, enabled])
}
