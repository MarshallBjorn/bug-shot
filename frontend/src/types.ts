export type TicketStatus = 'New' | 'InProgress' | 'Resolved' | 'Rejected' | 'Deleted'

export interface TicketListItem {
  id: string
  description: string
  pageUrl: string
  // page to adres znormalizowany po ktorym idzie grupowanie a pageUrl zostaje do pokazania
  page: string
  browserName: string
  osName: string
  deviceType: string
  status: TicketStatus
  reportedAt: string | null
  receivedAt: string
  updatedAt: string
  commentCount: number
  hasScreenshot: boolean
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

export interface TicketClientEnvironment {
  browserName: string
  osName: string
  deviceType: string
  viewportWidth: number | null
  viewportHeight: number | null
  devicePixelRatio: number | null
  language: string | null
  timeZone: string | null
}

export interface TicketDetails {
  id: string
  projectId: string
  projectKey: string
  description: string
  pageUrl: string
  page: string
  userAgent: string
  environment: TicketClientEnvironment
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
  // mapa przejsc przylozona do stanu na serwerze, wiec panel nie zgaduje czym moze ruszyc
  allowedStatuses: TicketStatus[]
}

export interface TicketComment {
  id: string
  author: string
  body: string
  createdAt: string
}

export interface ProjectPageCount {
  page: string
  total: number
  new: number
  inProgress: number
  resolved: number
  rejected: number
}

export interface PagedResult<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
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
