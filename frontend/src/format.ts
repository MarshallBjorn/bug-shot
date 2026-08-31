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

const pluralRules = new Intl.PluralRules('pl-PL')

const resultForms: Record<Intl.LDMLPluralRule, string> = {
  zero: 'wyników',
  one: 'wynik',
  two: 'wyniki',
  few: 'wyniki',
  many: 'wyników',
  other: 'wyników',
}

export function formatStatus(status: TicketStatus) {
  return statusLabels[status] ?? status
}

export function formatResultCount(total: number) {
  return `${total} ${resultForms[pluralRules.select(total)]}`
}

export function formatDateTime(value: string | null) {
  return value ? dateTimeFormat.format(new Date(value)) : '-'
}
