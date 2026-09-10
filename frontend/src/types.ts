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

export interface TicketComment {
  id: string
  author: string
  body: string
  createdAt: string
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

export interface ProjectOrigin {
  id: string
  origin: string
}

export interface Project {
  id: string
  name: string
  key: string
  createdAt: string
  origins: ProjectOrigin[]
}

// projectId puste oznacza regule globalna
export interface SanitizationRule {
  id: string
  projectId: string | null
  pattern: string
  replacement: string
  isEnabled: boolean
  createdAt: string
}
