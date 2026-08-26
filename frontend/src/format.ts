import type { TicketStatus } from './types'

const statusLabels: Record<TicketStatus, string> = {
  New: 'Nowe',
  InProgress: 'W trakcie',
  Resolved: 'Rozwiązane',
  Rejected: 'Odrzucone',
  Deleted: 'Usunięte',
}

const dateTimeFormat = new Intl.DateTimeFormat('pl-PL', {
  dateStyle: 'short',
  timeStyle: 'short',
})

export function formatStatus(status: TicketStatus) {
  return statusLabels[status] ?? status
}

export function formatDateTime(value: string | null) {
  return value ? dateTimeFormat.format(new Date(value)) : '-'
}
