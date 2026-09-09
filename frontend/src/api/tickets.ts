import { ticketQueryToParams, type TicketQuery } from '../ticketQuery'
import type { CursorPage, TicketDetails, TicketListItem } from '../types'
import { apiGet } from './client'

export function getTickets(
  projectId: string,
  query: TicketQuery,
  cursor: string | null,
  signal?: AbortSignal,
) {
  const params = ticketQueryToParams(query)

  if (cursor) {
    params.set('cursor', cursor)
  } else {
    // licznik liczy sie tylko przy wejściu w listę, doładowanie nie ma go po co ruszać
    params.set('withTotal', 'true')
  }

  const suffix = params.toString()

  return apiGet<CursorPage<TicketListItem>>(
    `/api/v1/projects/${projectId}/tickets${suffix ? `?${suffix}` : ''}`,
    signal,
  )
}

// szczegóły nie siedzą pod projektem tylko pod samym ticketem
export function getTicket(ticketId: string, signal?: AbortSignal) {
  return apiGet<TicketDetails>(`/api/v1/tickets/${ticketId}`, signal)
}
