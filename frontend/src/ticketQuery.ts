import type { TicketStatus } from './types'

export const ticketStatuses: TicketStatus[] = ['New', 'InProgress', 'Resolved', 'Rejected', 'Deleted']

export const ticketSorts = [
  'receivedAt:desc',
  'receivedAt:asc',
  'reportedAt:desc',
  'reportedAt:asc',
] as const

export type TicketSort = (typeof ticketSorts)[number]

export const defaultSort: TicketSort = 'receivedAt:desc'
export const defaultPageSize = 20

const maxPageSize = 100

export interface TicketQuery {
  status: TicketStatus | null
  search: string
  sort: TicketSort
  page: number
  pageSize: number
}

function parseNumber(value: string | null, fallback: number) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

export function parseTicketQuery(params: URLSearchParams): TicketQuery {
  const status = params.get('status')
  const sort = params.get('sort')

  return {
    status: ticketStatuses.find((candidate) => candidate === status) ?? null,
    search: params.get('search')?.trim() ?? '',
    sort: ticketSorts.find((candidate) => candidate === sort) ?? defaultSort,
    page: parseNumber(params.get('page'), 1),
    // te same granice co w ProjectTicketsController żeby adres nie kłamał o tym co przyjdzie
    pageSize: Math.min(parseNumber(params.get('pageSize'), defaultPageSize), maxPageSize),
  }
}

// wartości domyślne pomijamy bo backend ma dokładnie te same
export function ticketQueryToParams(query: TicketQuery): URLSearchParams {
  const params = new URLSearchParams()

  if (query.status) params.set('status', query.status)
  if (query.search) params.set('search', query.search)
  if (query.sort !== defaultSort) params.set('sort', query.sort)
  if (query.page !== 1) params.set('page', String(query.page))
  if (query.pageSize !== defaultPageSize) params.set('pageSize', String(query.pageSize))

  return params
}
