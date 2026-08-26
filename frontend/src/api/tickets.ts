import type { PagedResult, TicketListItem } from '../types'
import { apiGet } from './client'

export function getTickets(projectId: string, signal?: AbortSignal) {
  return apiGet<PagedResult<TicketListItem>>(`/api/v1/projects/${projectId}/tickets`, signal)
}
