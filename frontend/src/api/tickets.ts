import { ticketQueryToParams, type TicketQuery } from '../ticketQuery'
import type {
  PagedResult,
  TicketComment,
  TicketDetails,
  TicketListItem,
  TicketStatus,
} from '../types'
import { apiDelete, apiGet, apiPatch, apiPost } from './client'

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

export function getTicketComments(
  ticketId: string,
  page = 1,
  pageSize = 50,
  signal?: AbortSignal,
) {
  return apiGet<PagedResult<TicketComment>>(
    `/api/v1/tickets/${ticketId}/comments?page=${page}&pageSize=${pageSize}`,
    signal,
  )
}

export function addTicketComment(ticketId: string, author: string, body: string) {
  return apiPost<TicketComment>(`/api/v1/tickets/${ticketId}/comments`, {
    author,
    body,
  })
}

export function deleteTicket(ticketId: string) {
  return apiDelete(`/api/v1/tickets/${ticketId}`)
}

interface TicketStatusResponse {
  id: string
  status: TicketStatus
  rowVersion: string
  updatedAt: string
}

export function updateTicketStatus(
  ticketId: string,
  status: TicketStatus,
  rowVersion: string,
  changedBy: string,
) {
  return apiPatch<TicketStatusResponse>(
    `/api/v1/tickets/${ticketId}/status`,
    {
      status,
      changedBy,
    },
    {
      'If-Match': rowVersion,
    },
  )
}
