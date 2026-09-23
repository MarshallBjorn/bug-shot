import { useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { formatResultCount } from '../format'

interface LoadMoreProps {
  loaded: number
  total: number | null
  hasMore: boolean
  busy: boolean
  // po bledzie automat stoi bo ponawialby zapytanie w petli a przycisk zostaje do recznej proby
  paused?: boolean
  onLoadMore: () => void
}

// bez licznika zostaje sama liczba zaladowanych, bo backend podaje total tylko na zadanie
function summary(loaded: number, total: number | null, hasMore: boolean) {
  if (!hasMore) {
    return `Koniec listy, ${formatResultCount(total ?? loaded)}`
  }

  return total === null ? `Pokazano ${formatResultCount(loaded)}` : `Pokazano ${loaded} z ${total}`
}

// kolejna strona schodzi zanim uzytkownik dojedzie do konca a przycisk zostaje dla klawiatury
function LoadMore({ loaded, total, hasMore, busy, paused = false, onLoadMore }: LoadMoreProps) {
  const sentinel = useRef<HTMLElement>(null)
  const auto = hasMore && !busy && !paused

  useEffect(() => {
    const node = sentinel.current

    if (!auto || !node || typeof IntersectionObserver === 'undefined') {
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) onLoadMore()
      },
      { rootMargin: '400px 0px' },
    )

    observer.observe(node)

    return () => observer.disconnect()
  }, [auto, onLoadMore])

  return (
    <nav
      ref={sentinel}
      aria-label="Doładowanie listy"
      className="flex flex-wrap items-center gap-3 pt-3 text-xs text-muted-foreground"
    >
      {hasMore && (
        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={onLoadMore}>
          {busy ? 'Ładowanie...' : 'Załaduj więcej'}
        </Button>
      )}

      <span aria-live="polite">{summary(loaded, total, hasMore)}</span>
    </nav>
  )
}

export default LoadMore
