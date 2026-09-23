import { Inbox, SearchX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { clearedFilters, isFiltered, type TicketQuery } from '../ticketQuery'

interface TicketsEmptyStateProps {
  query: TicketQuery
  onChange: (patch: Partial<TicketQuery>) => void
}

// pusty ekran ma prowadzic do nastepnego kroku a nie tylko stwierdzac ze nic nie ma
function TicketsEmptyState({ query, onChange }: TicketsEmptyStateProps) {
  if (isFiltered(query)) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed bg-card px-6 py-12 text-center">
        <SearchX aria-hidden="true" className="size-6 text-muted-foreground" />
        <p className="text-sm">Żadne zgłoszenie nie pasuje do filtrów.</p>
        <Button type="button" variant="outline" size="sm" onClick={() => onChange(clearedFilters)}>
          Wyczyść filtry
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed bg-card px-6 py-12 text-center">
      <Inbox aria-hidden="true" className="size-6 text-muted-foreground" />
      <p className="text-sm">Ten projekt nie ma jeszcze żadnych zgłoszeń.</p>
      <p className="text-xs text-muted-foreground">
        Pierwsze pojawi się tutaj gdy widget wyśle zgłoszenie.
      </p>
    </div>
  )
}

export default TicketsEmptyState
