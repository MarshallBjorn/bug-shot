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
  statuses: TicketStatus[]
  search: string
  // adres znormalizowany, ten sam ktory oddaje GET /projects/{id}/pages
  page: string
  browser: string
  os: string
  device: string
  hasScreenshot: boolean | null
  hasComments: boolean | null
  // daty kalendarzowe w strefie uzytkownika, w adresie jako YYYY-MM-DD
  dateFrom: string
  dateTo: string
  sort: TicketSort
  limit: number
}

export const emptyQuery: TicketQuery = {
  statuses: [],
  search: '',
  page: '',
  browser: '',
  os: '',
  device: '',
  hasScreenshot: null,
  hasComments: null,
  dateFrom: '',
  dateTo: '',
  sort: defaultSort,
  limit: defaultLimit,
}

// czyszczenie zdejmuje filtry ale zostawia sortowanie i rozmiar strony bo to nie filtry
export const clearedFilters: Partial<TicketQuery> = {
  statuses: [],
  search: '',
  page: '',
  browser: '',
  os: '',
  device: '',
  hasScreenshot: null,
  hasComments: null,
  dateFrom: '',
  dateTo: '',
}

function parseNumber(value: string | null, fallback: number) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

function parseStatuses(value: string | null): TicketStatus[] {
  if (!value) return []

  const parsed = value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => ticketStatuses.find((candidate) => candidate === part))
    .filter((status): status is TicketStatus => status !== undefined)

  return [...new Set(parsed)]
}

function parseFlag(value: string | null): boolean | null {
  if (value === 'true') return true
  if (value === 'false') return false
  return null
}

const datePattern = /^\d{4}-\d{2}-\d{2}$/

function parseDate(value: string | null): string {
  const trimmed = value?.trim() ?? ''

  return datePattern.test(trimmed) && !Number.isNaN(Date.parse(trimmed)) ? trimmed : ''
}

export function parseTicketQuery(params: URLSearchParams): TicketQuery {
  const sort = params.get('sort')

  const dateFrom = parseDate(params.get('dateFrom'))
  const dateTo = parseDate(params.get('dateTo'))

  // odwrocony zakres nie ma zadnych trafien a backend odrzuca go bledem, wiec adres go nie przenosi
  const rangeValid = dateFrom === '' || dateTo === '' || dateFrom <= dateTo

  return {
    statuses: parseStatuses(params.get('status')),
    search: params.get('search')?.trim() ?? '',
    page: params.get('page')?.trim() ?? '',
    browser: params.get('browser')?.trim() ?? '',
    os: params.get('os')?.trim() ?? '',
    device: params.get('device')?.trim() ?? '',
    hasScreenshot: parseFlag(params.get('hasScreenshot')),
    hasComments: parseFlag(params.get('hasComments')),
    dateFrom: rangeValid ? dateFrom : '',
    dateTo: rangeValid ? dateTo : '',
    sort: ticketSorts.find((candidate) => candidate === sort) ?? defaultSort,
    // te same granice co w ProjectTicketsController zeby adres nie klamal o tym co przyjdzie
    limit: Math.min(parseNumber(params.get('limit'), defaultLimit), maxLimit),
  }
}

// sortowanie nie zmienia tego co pasuje wiec nie liczy sie jako filtr
export function isFiltered(query: TicketQuery) {
  return (
    query.statuses.length > 0 ||
    query.search !== '' ||
    query.page !== '' ||
    query.browser !== '' ||
    query.os !== '' ||
    query.device !== '' ||
    query.hasScreenshot !== null ||
    query.hasComments !== null ||
    query.dateFrom !== '' ||
    query.dateTo !== ''
  )
}

// wartosci domyslne pomijamy bo backend ma dokladnie te same
function writeShared(query: TicketQuery, params: URLSearchParams) {
  if (query.statuses.length > 0) params.set('status', query.statuses.join(','))
  if (query.search) params.set('search', query.search)
  if (query.page) params.set('page', query.page)
  if (query.browser) params.set('browser', query.browser)
  if (query.os) params.set('os', query.os)
  if (query.device) params.set('device', query.device)
  if (query.hasScreenshot !== null) params.set('hasScreenshot', String(query.hasScreenshot))
  if (query.hasComments !== null) params.set('hasComments', String(query.hasComments))
  if (query.sort !== defaultSort) params.set('sort', query.sort)
  if (query.limit !== defaultLimit) params.set('limit', String(query.limit))
}

export function ticketQueryToParams(query: TicketQuery): URLSearchParams {
  const params = new URLSearchParams()

  writeShared(query, params)

  if (query.dateFrom) params.set('dateFrom', query.dateFrom)
  if (query.dateTo) params.set('dateTo', query.dateTo)

  return params
}

function dayStart(date: string) {
  const [year, month, day] = date.split('-').map(Number)

  return new Date(year, month - 1, day)
}

// API liczy zakres na instantach a dzien kalendarzowy zna tylko przegladarka
// granica z prawej idzie na polnoc nastepnego dnia bo uzytkownik wybierajac date chce ja miec w wyniku
export function ticketQueryToApiParams(query: TicketQuery): URLSearchParams {
  const params = new URLSearchParams()

  writeShared(query, params)

  if (query.dateFrom) params.set('dateFrom', dayStart(query.dateFrom).toISOString())

  if (query.dateTo) {
    const end = dayStart(query.dateTo)
    end.setDate(end.getDate() + 1)
    params.set('dateTo', end.toISOString())
  }

  return params
}

function sameText(value: string, expected: string) {
  return value.toLowerCase() === expected.toLowerCase()
}

// te same reguly co filtr w zapytaniu, zeby zgloszenie z kanalu live nie wpadlo na liste,
// na ktorej nie ma prawa sie znalezc
export function matchesQuery(item: TicketListItem, query: TicketQuery) {
  // bez wybranego statusu lista pomija tombstone tak samo jak API
  const statusMatches =
    query.statuses.length > 0
      ? query.statuses.includes(item.status)
      : item.status !== 'Deleted'

  if (!statusMatches) return false

  if (query.page !== '' && item.page !== query.page) return false
  if (query.browser !== '' && !sameText(item.browserName, query.browser)) return false
  if (query.os !== '' && !sameText(item.osName, query.os)) return false
  if (query.device !== '' && !sameText(item.deviceType, query.device)) return false

  if (query.hasScreenshot !== null && item.hasScreenshot !== query.hasScreenshot) return false
  if (query.hasComments !== null && item.commentCount > 0 !== query.hasComments) return false

  if (query.dateFrom !== '' && new Date(item.receivedAt) < dayStart(query.dateFrom)) return false

  if (query.dateTo !== '') {
    const end = dayStart(query.dateTo)
    end.setDate(end.getDate() + 1)

    if (new Date(item.receivedAt) >= end) return false
  }

  if (query.search === '') return true

  const phrase = query.search.toLowerCase()

  return (
    item.description.toLowerCase().includes(phrase) || item.pageUrl.toLowerCase().includes(phrase)
  )
}
