import type { AttachmentKind, TicketStatus } from './types'

const attachmentKindLabels: Record<AttachmentKind, string> = {
  Screenshot: 'Zrzut ekranu',
  UserUpload: 'Plik użytkownika',
  ConsoleLog: 'Log konsoli',
}

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

export function formatAttachmentKind(kind: AttachmentKind) {
  return attachmentKindLabels[kind] ?? kind
}

export function formatResultCount(total: number) {
  return `${total} ${resultForms[pluralRules.select(total)]}`
}

// jednostki dwójkowe bo takie same limity opisuje docs/api.md
export function formatFileSize(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`
  }

  const kib = bytes / 1024

  return kib < 1024 ? `${kib.toFixed(1)} KiB` : `${(kib / 1024).toFixed(1)} MiB`
}

export function formatDateTime(value: string | null) {
  return value ? dateTimeFormat.format(new Date(value)) : '-'
}

const relativeFormat = new Intl.RelativeTimeFormat('pl-PL', { numeric: 'auto' })

const relativeSteps: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ['second', 60],
  ['minute', 60],
  ['hour', 24],
  ['day', 7],
  ['week', 4.35],
  ['month', 12],
]

// lista pokazuje czas skrocony a dokladny zostaje w tytule, bo przy skanowaniu liczy sie rzad wielkosci
export function formatRelativeTime(value: string | null, now: Date = new Date()) {
  if (!value) {
    return '-'
  }

  const stamp = new Date(value)

  if (Number.isNaN(stamp.getTime())) {
    return '-'
  }

  let amount = (stamp.getTime() - now.getTime()) / 1000

  for (const [unit, span] of relativeSteps) {
    if (Math.abs(amount) < span) {
      return relativeFormat.format(Math.round(amount), unit)
    }

    amount /= span
  }

  return relativeFormat.format(Math.round(amount), 'year')
}
