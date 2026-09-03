import { useEffect, useRef, useState } from 'react'
import { formatStatus } from '../format'
import { ticketSorts, ticketStatuses, type TicketQuery, type TicketSort } from '../ticketQuery'
import type { TicketStatus } from '../types'

const sortLabels: Record<TicketSort, string> = {
  'receivedAt:desc': 'Przyjęte, od najnowszych',
  'receivedAt:asc': 'Przyjęte, od najstarszych',
  'reportedAt:desc': 'Zgłoszone, od najnowszych',
  'reportedAt:asc': 'Zgłoszone, od najstarszych',
}

interface TicketFiltersProps {
  query: TicketQuery
  onChange: (patch: Partial<TicketQuery>, replace?: boolean) => void
}

function TicketFilters({ query, onChange }: TicketFiltersProps) {
  const [search, setSearch] = useState(query.search)
  const pushed = useRef(query.search)

  // adres może zmienić się poza polem na przykład przy czyszczeniu filtrów
  useEffect(() => {
    if (query.search === pushed.current) return
    pushed.current = query.search
    setSearch(query.search)
  }, [query.search])

  // pole nadąża za pisaniem a adres dostaje zmianę dopiero po chwili bezczynności
  useEffect(() => {
    if (search === pushed.current) return

    const timer = setTimeout(() => {
      pushed.current = search
      onChange({ search }, true)
    }, 300)

    return () => clearTimeout(timer)
  }, [search, onChange])

  return (
    <form className="ticket-filters" role="search" onSubmit={(event) => event.preventDefault()}>
      <label>
        <span>Szukaj</span>
        <input
          type="search"
          value={search}
          placeholder="Opis albo adres strony"
          onChange={(event) => setSearch(event.target.value)}
        />
      </label>

      <label>
        <span>Status</span>
        <select
          value={query.status ?? ''}
          onChange={(event) =>
            onChange({ status: (event.target.value || null) as TicketStatus | null })
          }
        >
          <option value="">Wszystkie</option>
          {ticketStatuses.map((status) => (
            <option key={status} value={status}>
              {formatStatus(status)}
            </option>
          ))}
        </select>
      </label>

      <label>
        <span>Sortowanie</span>
        <select
          value={query.sort}
          onChange={(event) => onChange({ sort: event.target.value as TicketSort })}
        >
          {ticketSorts.map((sort) => (
            <option key={sort} value={sort}>
              {sortLabels[sort]}
            </option>
          ))}
        </select>
      </label>
    </form>
  )
}

export default TicketFilters
