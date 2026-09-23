import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { createTicketConnection } from './connection'
import {
  ProjectLiveContext,
  type ProjectLive,
  type StreamHandlers,
  type StreamStatus,
} from './projectLiveContext'
import type { TicketEvent } from './ticketEvents'
import type { TicketListItem } from '../types'

// jedno połączenie na projekt dzielone przez listę panel boczny i detal
function ProjectLiveProvider({ projectId, children }: { projectId: string; children: ReactNode }) {
  const [status, setStatus] = useState<StreamStatus>('connecting')
  const listeners = useRef(new Set<StreamHandlers>())

  useEffect(() => {
    if (!projectId) return

    const connection = createTicketConnection()
    let stopped = false

    const show = (next: StreamStatus) => {
      if (!stopped) setStatus(next)
    }

    const emit = (event: TicketEvent) => {
      for (const handlers of listeners.current) handlers.onEvent(event)
    }

    connection.on('TicketCreated', (ticket: TicketListItem) => emit({ type: 'created', ticket }))
    connection.on('TicketChanged', (ticket: TicketListItem) => emit({ type: 'changed', ticket }))
    connection.on('TicketDeleted', (ticketId: string) => emit({ type: 'deleted', ticketId }))

    connection.onreconnecting(() => show('connecting'))

    // grupy nie przeżywają zerwanego połączenia więc subskrypcja idzie jeszcze raz
    connection.onreconnected(() => {
      connection
        .invoke('Subscribe', projectId)
        .then(() => {
          show('live')
          for (const handlers of listeners.current) handlers.onReconnected()
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
      setStatus('connecting')

      // zatrzymanie w trakcie negocjacji zostawia błąd w konsoli
      // więc czekamy aż połączenie się ustali i dopiero wtedy je zamykamy
      void started.then(() => connection.stop())
    }
  }, [projectId])

  // stała referencja bo odbiorcy zapisują się w efekcie i nie powinni tego robić przy każdej zmianie statusu
  const subscribe = useCallback((handlers: StreamHandlers) => {
    listeners.current.add(handlers)

    return () => {
      listeners.current.delete(handlers)
    }
  }, [])

  const value = useMemo<ProjectLive>(() => ({ status, subscribe }), [status, subscribe])

  return <ProjectLiveContext.Provider value={value}>{children}</ProjectLiveContext.Provider>
}

export default ProjectLiveProvider
