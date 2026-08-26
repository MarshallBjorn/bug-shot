export type TicketStatus = 'New' | 'InProgress' | 'Resolved' | 'Rejected' | 'Deleted'

export interface TicketListItem {
  id: string
  description: string
  pageUrl: string
  status: TicketStatus
  reportedAt: string | null
  receivedAt: string
  updatedAt: string
}

export interface PagedResult<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}
