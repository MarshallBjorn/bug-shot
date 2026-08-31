import { useCallback, useMemo } from 'react'
import { useParams, useSearchParams } from 'react-router'
import Pagination from '../components/Pagination'
import TicketFilters from '../components/TicketFilters'
import TicketTable from '../components/TicketTable'
import { useTickets } from '../hooks/useTickets'
import { parseTicketQuery, ticketQueryToParams, type TicketQuery } from '../ticketQuery'

function TicketListPage() {
  const { projectId = '' } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()

  const query = useMemo(() => parseTicketQuery(searchParams), [searchParams])
  const tickets = useTickets(projectId, query)

  const updateQuery = useCallback(
    (patch: Partial<TicketQuery>, replace = false) => {
      setSearchParams((previous) => {
        const next = { ...parseTicketQuery(previous), ...patch }

        // zmiana filtra cofa na pierwszą stronę bo inaczej trafiamy w pustkę poza zakresem
        if (patch.page === undefined) next.page = 1

        return ticketQueryToParams(next)
      }, { replace })
    },
    [setSearchParams],
  )

  return (
    <>
      <h2>Zgłoszenia</h2>

      <TicketFilters query={query} onChange={updateQuery} />

      {tickets.error && <p role="alert">Nie udało się pobrać zgłoszeń. {tickets.error}</p>}

      {!tickets.result && tickets.loading && <p>Ładowanie...</p>}

      {tickets.result && (
        <div className={tickets.loading ? 'is-stale' : undefined}>
          <TicketTable projectId={projectId} items={tickets.result.items} />
          <Pagination
            page={tickets.result.page}
            pageSize={tickets.result.pageSize}
            total={tickets.result.total}
            onPageChange={(page) => updateQuery({ page })}
          />
        </div>
      )}
    </>
  )
}

export default TicketListPage
