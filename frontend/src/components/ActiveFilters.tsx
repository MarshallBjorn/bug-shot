import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { chipsFor } from '../activeFilterChips'
import { clearedFilters, isFiltered, type TicketQuery } from '../ticketQuery'

interface ActiveFiltersProps {
  query: TicketQuery
  onChange: (patch: Partial<TicketQuery>) => void
}

function ActiveFilters({ query, onChange }: ActiveFiltersProps) {
  if (!isFiltered(query)) {
    return null
  }

  const chips = chipsFor(query)

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="sr-only">Aktywne filtry</span>
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          onClick={() => onChange(chip.clear)}
          aria-label={`Zdejmij filtr ${chip.label}`}
          className="inline-flex items-center gap-1 rounded-full border bg-card py-0.5 pr-1.5 pl-2.5 text-xs text-card-foreground transition-colors hover:bg-accent"
        >
          {chip.label}
          <X aria-hidden="true" className="size-3 text-muted-foreground" />
        </button>
      ))}

      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-6 px-2 text-xs"
        onClick={() => onChange(clearedFilters)}
      >
        Wyczyść filtry
      </Button>
    </div>
  )
}

export default ActiveFilters
