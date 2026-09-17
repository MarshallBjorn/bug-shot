import { Button } from '@/components/ui/button'
import { formatResultCount } from '../format'

interface LoadMoreProps {
  loaded: number
  total: number | null
  hasMore: boolean
  busy: boolean
  onLoadMore: () => void
}

// bez licznika zostaje sama liczba zaladowanych, bo backend podaje total tylko na zadanie
function summary(loaded: number, total: number | null, hasMore: boolean) {
  if (!hasMore) {
    return `Koniec listy, ${formatResultCount(total ?? loaded)}`
  }

  return total === null ? `Pokazano ${formatResultCount(loaded)}` : `Pokazano ${loaded} z ${total}`
}

function LoadMore({ loaded, total, hasMore, busy, onLoadMore }: LoadMoreProps) {
  return (
    <nav
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
