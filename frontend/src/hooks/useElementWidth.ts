import { useEffect, useRef, useState } from 'react'

// wykres rysuje sie w prawdziwych pikselach a nie przez skalowanie viewBox
// inaczej na telefonie razem z rysunkiem skurczylyby sie tez etykiety
export function useElementWidth(fallback = 640) {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(fallback)

  useEffect(() => {
    const node = ref.current

    if (!node) {
      return
    }

    // jsdom i starsze przegladarki nie maja ResizeObserver wiec zostaje szerokosc zastepcza
    if (typeof ResizeObserver !== 'function') {
      return
    }

    const observer = new ResizeObserver((entries) => {
      const measured = entries[0]?.contentRect.width ?? 0

      if (measured > 0) {
        setWidth(measured)
      }
    })

    observer.observe(node)

    return () => observer.disconnect()
  }, [])

  return { ref, width }
}
