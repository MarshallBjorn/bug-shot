import { isFiltered, type TicketQuery } from '../ticketQuery'

interface TicketsEmptyStateProps {
  query: TicketQuery
  total: number
  onChange: (patch: Partial<TicketQuery>) => void
}

function TicketsEmptyState({ query, total, onChange }: TicketsEmptyStateProps) {
  // coś pasuje ale nie na tej stronie, zwykle po wklejeniu linku z wyższym numerem
  if (total > 0) {
    return (
      <div className="empty-state">
        <p>Strona {query.page} nie ma już wyników.</p>
        <button type="button" onClick={() => onChange({ page: 1 })}>
          Wróć na pierwszą stronę
        </button>
      </div>
    )
  }

  if (isFiltered(query)) {
    return (
      <div className="empty-state">
        <p>Żadne zgłoszenie nie pasuje do filtrów.</p>
        <button type="button" onClick={() => onChange({ status: null, search: '' })}>
          Wyczyść filtry
        </button>
      </div>
    )
  }

  return (
    <div className="empty-state">
      <p>Ten projekt nie ma jeszcze żadnych zgłoszeń.</p>
      <p>Pierwsze pojawi się tutaj gdy widget wyśle zgłoszenie.</p>
    </div>
  )
}

export default TicketsEmptyState
