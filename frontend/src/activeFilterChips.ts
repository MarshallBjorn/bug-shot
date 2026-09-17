import { formatDevice } from './environmentOptions'
import { formatStatus } from './format'
import type { TicketQuery } from './ticketQuery'

export interface FilterChip {
  key: string
  label: string
  clear: Partial<TicketQuery>
}

export function chipsFor(query: TicketQuery): FilterChip[] {
  const chips: FilterChip[] = []

  for (const status of query.statuses) {
    chips.push({
      key: `status-${status}`,
      label: formatStatus(status),
      clear: { statuses: query.statuses.filter((candidate) => candidate !== status) },
    })
  }

  if (query.search) {
    chips.push({ key: 'search', label: `Szukane: ${query.search}`, clear: { search: '' } })
  }

  if (query.page) {
    chips.push({ key: 'page', label: `Strona: ${query.page}`, clear: { page: '' } })
  }

  if (query.browser) {
    chips.push({ key: 'browser', label: query.browser, clear: { browser: '' } })
  }

  if (query.os) {
    chips.push({ key: 'os', label: query.os, clear: { os: '' } })
  }

  if (query.device) {
    chips.push({ key: 'device', label: formatDevice(query.device), clear: { device: '' } })
  }

  if (query.hasScreenshot !== null) {
    chips.push({
      key: 'screenshot',
      label: query.hasScreenshot ? 'Ze zrzutem' : 'Bez zrzutu',
      clear: { hasScreenshot: null },
    })
  }

  if (query.hasComments !== null) {
    chips.push({
      key: 'comments',
      label: query.hasComments ? 'Skomentowane' : 'Bez komentarzy',
      clear: { hasComments: null },
    })
  }

  // jedna data bez drugiej to nadal sensowny zakres wiec kazda granica ma wlasny chip
  if (query.dateFrom) {
    chips.push({ key: 'dateFrom', label: `Od ${query.dateFrom}`, clear: { dateFrom: '' } })
  }

  if (query.dateTo) {
    chips.push({ key: 'dateTo', label: `Do ${query.dateTo}`, clear: { dateTo: '' } })
  }

  return chips
}
