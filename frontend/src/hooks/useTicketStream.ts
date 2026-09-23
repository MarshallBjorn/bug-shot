import { useContext, useEffect, useRef } from 'react'
import { ProjectLiveContext, type StreamHandlers, type StreamStatus } from '../live/projectLiveContext'

export type { StreamStatus } from '../live/projectLiveContext'

// poza providerem nie ma połączenia więc widok zostaje przy danych z REST
export function useTicketStream(handlers: StreamHandlers): StreamStatus {
  const live = useContext(ProjectLiveContext)
  const latest = useRef(handlers)

  useEffect(() => {
    latest.current = handlers
  })

  const subscribe = live?.subscribe

  useEffect(() => {
    if (!subscribe) return

    return subscribe({
      onEvent: (event) => latest.current.onEvent(event),
      onReconnected: () => latest.current.onReconnected(),
    })
  }, [subscribe])

  return live?.status ?? 'offline'
}
