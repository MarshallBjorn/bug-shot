import { useCallback, useMemo } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import LiveStatus from '../components/LiveStatus'
import LoadMore from '../components/LoadMore'
import TicketFilters from '../components/TicketFilters'
import TicketTable from '../components/TicketTable'
import TicketsEmptyState from '../components/TicketsEmptyState'
import { useTickets } from '../hooks/useTickets'
import { useTicketStream } from '../hooks/useTicketStream'
import { parseTicketQuery, ticketQueryToParams, type TicketQuery } from '../ticketQuery'

function TicketListPage() {
  const { projectId = '' } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()

  const query = useMemo(() => parseTicketQuery(searchParams), [searchParams])
  const tickets = useTickets(projectId, query)

  const live = useTicketStream(projectId, {
    onEvent: tickets.apply,
    onReconnected: tickets.reload,
  })

  const updateQuery = useCallback(
    (patch: Partial<TicketQuery>, replace = false) => {
      setSearchParams(
        (previous) => ticketQueryToParams({ ...parseTicketQuery(previous), ...patch }),
        { replace },
      )
    },
    [setSearchParams],
  )

  const empty = tickets.items.length === 0

  return (
    <>
      <div className="list-heading">
        <h2>Zgłoszenia</h2>
        <div className="list-heading-actions">
          <LiveStatus status={live} />
          <Link to={`/projects/${projectId}/analytics`}>Analityka</Link>
        </div>
      </div>

      <TicketFilters query={query} onChange={updateQuery} />

      {tickets.error && <p role="alert">Nie udało się pobrać zgłoszeń. {tickets.error}</p>}

      {empty && tickets.loading && <p>Ładowanie...</p>}

      {empty && !tickets.loading && !tickets.error && (
        <TicketsEmptyState query={query} onChange={updateQuery} />
      )}

      {!empty && (
        <div className={tickets.loading ? 'is-stale' : undefined}>
          <TicketTable
            projectId={projectId}
            items={tickets.items}
            listSearch={searchParams.toString()}
          />
          <LoadMore
            loaded={tickets.items.length}
            total={tickets.total}
            hasMore={tickets.hasMore}
            busy={tickets.loading || tickets.loadingMore}
            onLoadMore={tickets.loadMore}
          />
        </div>
      )}
    </>
  )
}

export default TicketListPage
