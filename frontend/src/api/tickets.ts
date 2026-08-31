import { ticketQueryToParams, type TicketQuery } from '../ticketQuery'
import type { PagedResult, TicketDetails, TicketListItem } from '../types'
import { apiGet } from './client'

export function getTickets(projectId: string, query: TicketQuery, signal?: AbortSignal) {
  const params = ticketQueryToParams(query).toString()
  const suffix = params ? `?${params}` : ''

  return apiGet<PagedResult<TicketListItem>>(
    `/api/v1/projects/${projectId}/tickets${suffix}`,
    signal,
  )
}

// szczegóły nie siedzą pod projektem tylko pod samym ticketem
export function getTicket(ticketId: string, signal?: AbortSignal) {
  return apiGet<TicketDetails>(`/api/v1/tickets/${ticketId}`, signal)
}
