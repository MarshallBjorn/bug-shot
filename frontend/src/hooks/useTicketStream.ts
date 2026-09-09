import { useEffect, useRef, useState } from 'react'
import { createTicketConnection } from '../live/connection'
import type { TicketEvent } from '../live/ticketEvents'
import type { TicketListItem } from '../types'

export type StreamStatus = 'connecting' | 'live' | 'offline'

interface StreamHandlers {
  onEvent: (event: TicketEvent) => void
  // po zerwaniu połączenia zdarzenia z przerwy przepadają więc lista musi wrócić z serwera
  onReconnected: () => void
}

export function useTicketStream(projectId: string, handlers: StreamHandlers): StreamStatus {
  const [status, setStatus] = useState<StreamStatus>('connecting')
  const latest = useRef(handlers)

  useEffect(() => {
    latest.current = handlers
  })

  useEffect(() => {
    if (!projectId) return

    const connection = createTicketConnection()
    let stopped = false

    const show = (next: StreamStatus) => {
      if (!stopped) setStatus(next)
    }

    connection.on('TicketCreated', (ticket: TicketListItem) =>
      latest.current.onEvent({ type: 'created', ticket }),
    )

    connection.on('TicketChanged', (ticket: TicketListItem) =>
      latest.current.onEvent({ type: 'changed', ticket }),
    )

    connection.on('TicketDeleted', (ticketId: string) =>
      latest.current.onEvent({ type: 'deleted', ticketId }),
    )

    connection.onreconnecting(() => show('connecting'))

    // grupy nie przeżywają zerwanego połączenia więc subskrypcja idzie jeszcze raz
    connection.onreconnected(() => {
      connection
        .invoke('Subscribe', projectId)
        .then(() => {
          show('live')
          latest.current.onReconnected()
        })
        .catch(() => show('offline'))
    })

    connection.onclose(() => show('offline'))

    const started = connection
      .start()
      .then(() => connection.invoke('Subscribe', projectId))
      .then(() => show('live'))
      .catch(() => show('offline'))

    return () => {
      stopped = true

      // zatrzymanie w trakcie negocjacji zostawia błąd w konsoli
      // więc czekamy aż połączenie się ustali i dopiero wtedy je zamykamy
      void started.then(() => connection.stop())
    }
  }, [projectId])

  return status
}
