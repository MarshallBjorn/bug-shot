import type { TicketListItem } from '../types'

export type TicketEvent =
  | { type: 'created'; ticket: TicketListItem }
  | { type: 'changed'; ticket: TicketListItem }
  | { type: 'deleted'; ticketId: string }
