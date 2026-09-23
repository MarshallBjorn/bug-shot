import { createContext } from 'react'
import type { TicketEvent } from './ticketEvents'

export type StreamStatus = 'connecting' | 'live' | 'offline'

export interface StreamHandlers {
  onEvent: (event: TicketEvent) => void
  // po zerwaniu połączenia zdarzenia z przerwy przepadają więc odbiorca musi wrócić do serwera
  onReconnected: () => void
}

export interface ProjectLive {
  status: StreamStatus
  subscribe: (handlers: StreamHandlers) => () => void
}

export const ProjectLiveContext = createContext<ProjectLive | null>(null)
