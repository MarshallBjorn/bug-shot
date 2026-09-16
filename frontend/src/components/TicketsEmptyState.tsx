import { isFiltered, type TicketQuery } from '../ticketQuery'

interface TicketsEmptyStateProps {
  query: TicketQuery
  onChange: (patch: Partial<TicketQuery>) => void
}

function TicketsEmptyState({ query, onChange }: TicketsEmptyStateProps) {
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
