import { formatResultCount } from '../format'

interface LoadMoreProps {
  loaded: number
  total: number | null
  hasMore: boolean
  busy: boolean
  onLoadMore: () => void
}

// bez licznika zostaje sama liczba załadowanych, bo backend podaje total tylko na żądanie
function summary(loaded: number, total: number | null, hasMore: boolean) {
  if (!hasMore) {
    return `Koniec listy, ${formatResultCount(total ?? loaded)}`
  }

  return total === null ? `Pokazano ${formatResultCount(loaded)}` : `Pokazano ${loaded} z ${total}`
}

function LoadMore({ loaded, total, hasMore, busy, onLoadMore }: LoadMoreProps) {
  return (
    <nav className="load-more" aria-label="Doładowanie listy">
      {hasMore && (
        <button type="button" disabled={busy} onClick={onLoadMore}>
          {busy ? 'Ładowanie...' : 'Załaduj więcej'}
        </button>
      )}

      <span aria-live="polite">{summary(loaded, total, hasMore)}</span>
    </nav>
  )
}

export default LoadMore
