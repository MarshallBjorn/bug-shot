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
  uri: string
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
  consoleLogUri: string | null
  commentCount: number
  statusHistory: TicketStatusChange[]
}

export interface PagedResult<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

export interface AuthenticatedUser {
  id: string
  email: string
  isAdmin: boolean
  isActive: boolean
}
