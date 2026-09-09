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

export type AttachmentKind = 'Screenshot' | 'UserUpload' | 'ConsoleLog'

export interface TicketAttachment {
  id: string
  kind: AttachmentKind
  fileName: string
  contentType: string
  sizeBytes: number
}

export interface TicketStatusChange {
  fromStatus: TicketStatus
  toStatus: TicketStatus
  changedBy: string
  changedAt: string
}

export interface TicketDetails {
  id: string
  projectId: string
  projectKey: string
  description: string
  pageUrl: string
  userAgent: string
  status: TicketStatus
  reportedAt: string | null
  receivedAt: string
  createdAt: string
  updatedAt: string
  rowVersion: string
  attachments: TicketAttachment[]
  consoleLog: TicketAttachment | null
  commentCount: number
  statusHistory: TicketStatusChange[]
}

// puste nextCursor oznacza koniec listy
// total przychodzi tylko przy pierwszej stronie i tylko gdy panel o niego poprosi
export interface CursorPage<T> {
  items: T[]
  nextCursor: string | null
  total: number | null
}

export interface AuthenticatedUser {
  id: string
  email: string
  isAdmin: boolean
  isActive: boolean
}
