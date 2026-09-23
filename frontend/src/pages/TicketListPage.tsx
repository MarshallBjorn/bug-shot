import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import ActiveFilters from '../components/ActiveFilters'
import LiveStatus from '../components/LiveStatus'
import LoadMore from '../components/LoadMore'
import SaveFilterDialog from '../components/SaveFilterDialog'
import TicketFilters from '../components/TicketFilters'
import TicketTable from '../components/TicketTable'
import TicketsEmptyState from '../components/TicketsEmptyState'
import ShortcutsDialog from '../components/ShortcutsDialog'
import { Skeleton } from '@/components/ui/skeleton'
import { formatResultCount } from '../format'
import { changeTicketStatus } from '../api/tickets'
import { useAuth } from '../auth/AuthContext'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'
import { useTickets } from '../hooks/useTickets'
import { useTicketStream } from '../hooks/useTicketStream'
import { isFiltered, parseTicketQuery, ticketQueryToParams, type TicketQuery } from '../ticketQuery'

function TicketListPage() {
  const { projectId = '' } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [focused, setFocused] = useState(-1)
  const [statusMenuId, setStatusMenuId] = useState<string | null>(null)
  const [helpOpen, setHelpOpen] = useState(false)
  const [statusError, setStatusError] = useState<string | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

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

  // strona wklejona pelnym adresem wraca do paska w postaci z drzewka zeby link i zapisany filtr byly jednakowe
  // reszta parametrow zostaje jak jest bo szukanie przycinaloby spacje w trakcie pisania
  const rawPage = searchParams.get('page')

  useEffect(() => {
    if (rawPage !== null && rawPage !== query.page) {
      updateQuery({ page: query.page }, true)
    }
  }, [rawPage, query.page, updateQuery])

  const empty = tickets.items.length === 0

  const move = useCallback(
    (step: number) => {
      setFocused((previous) => {
        const next = previous + step

        if (next < 0) return 0
        if (next > tickets.items.length - 1) return tickets.items.length - 1

        return next
      })
    },
    [tickets.items.length],
  )

  // autor zmiany idzie z zalogowanego konta a nie ze sztywnej etykiety panelu
  const author = user?.email ?? 'dashboard'

  const changeStatus = useCallback(
    async (ticketId: string, status: (typeof tickets.items)[number]['status']) => {
      setStatusError(null)

      try {
        // wiersz wroci kanalem live, wiec po zapisie nie trzeba przeladowywac listy
        await changeTicketStatus(ticketId, status, author)
      } catch (cause) {
        setStatusError((cause as Error).message)
      }
    },
    [author],
  )

  const shortcuts = useMemo(
    () => [
      { key: 'j', onPress: () => move(1) },
      { key: 'k', onPress: () => move(-1) },
      { key: '/', onPress: () => searchRef.current?.focus() },
      {
        key: 'x',
        onPress: () => {
          const ticket = tickets.items[focused]

          if (ticket) {
            setStatusMenuId(ticket.id)
          }
        },
      },
      { key: '?', onPress: () => setHelpOpen(true) },
      {
        key: 'Enter',
        onPress: () => {
          const ticket = tickets.items[focused]

          if (ticket) {
            navigate(`/projects/${projectId}/tickets/${ticket.id}`, {
              state: { listSearch: searchParams.toString() },
            })
          }
        },
      },
    ],
    [focused, move, navigate, projectId, searchParams, tickets.items],
  )

  useKeyboardShortcuts(shortcuts)

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

      <TicketFilters query={query} onChange={updateQuery} searchRef={searchRef} />

      <ActiveFilters query={query} onChange={updateQuery} />

      {statusError && (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          Nie udało się zmienić statusu. {statusError}
        </p>
      )}

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
                focusedIndex={focused}
                statusMenuId={statusMenuId}
                onStatusMenuChange={setStatusMenuId}
                onPickStatus={(ticket, status) => changeStatus(ticket.id, status)}
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

      <ShortcutsDialog open={helpOpen} onOpenChange={setHelpOpen} />
    </div>
  )
}

export default TicketListPage
