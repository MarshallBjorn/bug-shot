import { useCallback, useEffect, useReducer, useRef } from 'react'
import { getTickets } from '../api/tickets'
import type { TicketEvent } from '../live/ticketEvents'
import type { TicketQuery } from '../ticketQuery'
import {
  initialTicketListState,
  ticketListReducer,
  type TicketListState,
} from './ticketListState'

export interface Tickets extends TicketListState {
  hasMore: boolean
  loadMore: () => void
  reload: () => void
  apply: (event: TicketEvent) => void
}

export function useTickets(projectId: string, query: TicketQuery): Tickets {
  const [state, dispatch] = useReducer(ticketListReducer, initialTicketListState)

  // odpowiedź zapytania z poprzedniego filtra nie ma prawa dopisać się do nowej listy
  const attempt = useRef(0)
  const inFlight = useRef<AbortController | null>(null)
  const shown = useRef(projectId)

  // strona bez kursora podmienia liste w calosci, wiec event ktory przyszedl
  // w trakcie GET-a trzeba odtworzyc dopiero na swiezych danych
  const pendingLiveEvents = useRef<TicketEvent[]>([])
  const awaitingFreshLoad = useRef(false)

  const fetchPage = useCallback(
    (cursor: string | null) => {
      const started = attempt.current
      const controller = new AbortController()
      inFlight.current = controller

      if (cursor === null) {
        awaitingFreshLoad.current = true
        pendingLiveEvents.current = []
      }

      getTickets(projectId, query, cursor, controller.signal)
        .then((page) => {
          if (started !== attempt.current) return

          if (cursor === null) {
            const toReplay = pendingLiveEvents.current
            pendingLiveEvents.current = []
            awaitingFreshLoad.current = false

            dispatch({ type: 'loaded', page, append: false })
            toReplay.forEach((event) => dispatch({ type: 'live', event, query }))
          } else {
            dispatch({ type: 'loaded', page, append: true })
          }
        })
        .catch((cause: Error) => {
          if (started !== attempt.current || controller.signal.aborted) return

          if (cursor === null) {
            pendingLiveEvents.current = []
            awaitingFreshLoad.current = false
          }

          dispatch({ type: 'failed', message: cause.message })
        })
    },
    [projectId, query],
  )

  const reload = useCallback(() => {
    attempt.current += 1
    inFlight.current?.abort()
    dispatch({ type: 'restart', keepItems: true })
    fetchPage(null)
  }, [fetchPage])

  // zmiana projektu albo filtra zaczyna listę od początku
  useEffect(() => {
    attempt.current += 1
    dispatch({ type: 'restart', keepItems: shown.current === projectId })
    shown.current = projectId
    fetchPage(null)

    return () => inFlight.current?.abort()
  }, [fetchPage, projectId])

  const { nextCursor, loading, loadingMore } = state

  const loadMore = useCallback(() => {
    if (!nextCursor || loading || loadingMore) return

    dispatch({ type: 'loadingMore' })
    fetchPage(nextCursor)
  }, [fetchPage, nextCursor, loading, loadingMore])

  const apply = useCallback(
    (event: TicketEvent) => {
      if (awaitingFreshLoad.current) {
        pendingLiveEvents.current.push(event)
      }

      dispatch({ type: 'live', event, query })
    },
    [query],
  )

  return { ...state, hasMore: state.nextCursor !== null, loadMore, reload, apply }
}
