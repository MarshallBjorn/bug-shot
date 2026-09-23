import type { TicketStatus } from './types'

// odwzorowanie mapy z Tickets/TicketStatusTransitions.cs
// backend i tak wymusza regule i odrzuca przejscie poza mapa, wiec tutaj jest tylko podpowiedz dla UI
// szczegoly zgloszenia wola allowedStatuses z API, bo tam liczy sie stan na serwerze
const allowed: Record<TicketStatus, TicketStatus[]> = {
  New: ['InProgress', 'Rejected'],
  InProgress: ['Resolved', 'Rejected'],
  Resolved: ['InProgress'],
  Rejected: ['InProgress'],
  Deleted: [],
}

export function allowedStatusesFrom(status: TicketStatus): TicketStatus[] {
  return allowed[status] ?? []
}
