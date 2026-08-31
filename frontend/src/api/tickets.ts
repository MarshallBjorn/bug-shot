import { ticketQueryToParams, type TicketQuery } from '../ticketQuery'
import type { PagedResult, TicketListItem } from '../types'
import { apiGet } from './client'

export function getTickets(projectId: string, query: TicketQuery, signal?: AbortSignal) {
  const params = ticketQueryToParams(query).toString()
  const suffix = params ? `?${params}` : ''

  return apiGet<PagedResult<TicketListItem>>(
    `/api/v1/projects/${projectId}/tickets${suffix}`,
    signal,
  )
}
