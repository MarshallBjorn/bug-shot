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
  hasConsoleLog: boolean
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

// kolejnosc jak w API, wyzsza rola zawiera nizsza
export type ProjectRole = 'Viewer' | 'Member' | 'Maintainer'

export interface Project {
  id: string
  name: string
  key: string
  createdAt: string
  origins: ProjectOrigin[]
  // rola zalogowanego konta, administrator ma wszedzie Maintainer
  role: ProjectRole
}

export type UserAccountState = 'Active' | 'Invited' | 'Disabled'

export interface ProjectAccess {
  projectId: string
  role: ProjectRole
}

export interface UserProject extends ProjectAccess {
  projectName: string
}

export interface UserAccount {
  id: string
  email: string
  isAdmin: boolean
  state: UserAccountState
  createdAt: string
  projects: UserProject[]
}

// link wraca tylko gdy mail nie wyszedl i trzeba przekazac go recznie
export interface AccountLinkResult {
  emailSent: boolean
  link: string | null
}

export interface CreatedUser extends AccountLinkResult {
  user: UserAccount
}

export type AccountTokenPurpose = 'Invitation' | 'PasswordReset'

// projectId puste oznacza regule globalna
export interface SanitizationRule {
  id: string
  projectId: string | null
  pattern: string
  replacement: string
  isEnabled: boolean
  createdAt: string
}
export type NotificationChannelType = 'Email' | 'Webhook'

export type NotificationEventType = 'TicketCreated' | 'CommentAdded' | 'StatusChanged'

export interface NotificationChannel {
  id: string
  projectId: string
  type: NotificationChannelType
  isEnabled: boolean
  emailAddress: string | null
  webhookUrl: string | null
  throttleWindowSeconds: number | null
  throttleMaxEvents: number | null
  createdAt: string
}

export interface NotificationTemplate {
  id: string
  projectId: string | null
  eventType: NotificationEventType
  channelType: NotificationChannelType
  subject: string | null
  body: string
  createdAt: string
}

