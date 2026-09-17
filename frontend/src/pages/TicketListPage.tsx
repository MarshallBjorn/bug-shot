import { useCallback, useMemo } from 'react'
import { useParams, useSearchParams } from 'react-router'
import ActiveFilters from '../components/ActiveFilters'
import LiveStatus from '../components/LiveStatus'
import LoadMore from '../components/LoadMore'
import SaveFilterDialog from '../components/SaveFilterDialog'
import TicketFilters from '../components/TicketFilters'
import TicketTable from '../components/TicketTable'
import TicketsEmptyState from '../components/TicketsEmptyState'
import { Skeleton } from '@/components/ui/skeleton'
import { formatResultCount } from '../format'
import { useTickets } from '../hooks/useTickets'
import { useTicketStream } from '../hooks/useTicketStream'
import { isFiltered, parseTicketQuery, ticketQueryToParams, type TicketQuery } from '../ticketQuery'

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
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-semibold tracking-tight">Zgłoszenia</h2>
        <LiveStatus status={live} />
        <div className="ml-auto">
          {isFiltered(query) && (
            <SaveFilterDialog projectId={projectId} search={searchParams.toString()} />
          )}
        </div>
      </div>

      <TicketFilters query={query} onChange={updateQuery} />

      <ActiveFilters query={query} onChange={updateQuery} />

      {tickets.error && (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          Nie udało się pobrać zgłoszeń. {tickets.error}
        </p>
      )}

      {empty && tickets.loading && (
        <div className="space-y-2" aria-busy="true">
          <span className="sr-only">Ładowanie zgłoszeń</span>
          {[0, 1, 2, 3, 4].map((row) => (
            <Skeleton key={row} className="h-11 w-full" />
          ))}
        </div>
      )}

      {empty && !tickets.loading && !tickets.error && (
        <TicketsEmptyState query={query} onChange={updateQuery} />
      )}

      {!empty && (
        <div aria-busy={tickets.loading} className={tickets.loading ? 'opacity-60' : undefined}>
          {tickets.total !== null && (
            <p className="mb-2 text-xs text-muted-foreground">
              {formatResultCount(tickets.total)}
            </p>
          )}

          <div className="overflow-hidden rounded-lg border bg-card">
            <div className="overflow-x-auto">
              <TicketTable
                projectId={projectId}
                items={tickets.items}
                listSearch={searchParams.toString()}
              />
            </div>
          </div>

          <LoadMore
            loaded={tickets.items.length}
            total={tickets.total}
            hasMore={tickets.hasMore}
            busy={tickets.loading || tickets.loadingMore}
            onLoadMore={tickets.loadMore}
          />
        </div>
      )}
    </div>
  )
}

export default TicketListPage
