import type { TicketListItem, TicketStatus } from './types'

export const ticketStatuses: TicketStatus[] = ['New', 'InProgress', 'Resolved', 'Rejected', 'Deleted']

export const ticketSorts = [
  'receivedAt:desc',
  'receivedAt:asc',
  'reportedAt:desc',
  'reportedAt:asc',
] as const

export type TicketSort = (typeof ticketSorts)[number]

export const defaultSort: TicketSort = 'receivedAt:desc'
export const defaultLimit = 20

const maxLimit = 100

export interface TicketQuery {
  status: TicketStatus | null
  search: string
  sort: TicketSort
  limit: number
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
    // te same granice co w ProjectTicketsController żeby adres nie kłamał o tym co przyjdzie
    limit: Math.min(parseNumber(params.get('limit'), defaultLimit), maxLimit),
  }
}

// sortowanie nie zmienia tego co pasuje więc nie liczy się jako filtr
export function isFiltered(query: TicketQuery) {
  return query.status !== null || query.search !== ''
}

// wartości domyślne pomijamy bo backend ma dokładnie te same
export function ticketQueryToParams(query: TicketQuery): URLSearchParams {
  const params = new URLSearchParams()

  if (query.status) params.set('status', query.status)
  if (query.search) params.set('search', query.search)
  if (query.sort !== defaultSort) params.set('sort', query.sort)
  if (query.limit !== defaultLimit) params.set('limit', String(query.limit))

  return params
}

// te same reguły co filtr w zapytaniu, żeby zgłoszenie z kanału live nie wpadło na listę,
// na której nie ma prawa się znaleźć
export function matchesQuery(item: TicketListItem, query: TicketQuery) {
  // bez wybranego statusu lista pomija tombstone tak samo jak API
  const statusMatches = query.status ? item.status === query.status : item.status !== 'Deleted'

  if (!statusMatches) return false
  if (query.search === '') return true

  const phrase = query.search.toLowerCase()

  return (
    item.description.toLowerCase().includes(phrase) || item.pageUrl.toLowerCase().includes(phrase)
  )
}
