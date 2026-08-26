import { useEffect, useState } from 'react'
import { getTickets } from '../api/tickets'
import type { PagedResult, TicketListItem } from '../types'

type TicketsState =
  | { status: 'loading'; projectId: string }
  | { status: 'loaded'; projectId: string; result: PagedResult<TicketListItem> }
  | { status: 'error'; projectId: string; message: string }

export function useTickets(projectId: string): TicketsState {
  const [state, setState] = useState<TicketsState>({ status: 'loading', projectId })

  useEffect(() => {
    const controller = new AbortController()

    getTickets(projectId, controller.signal)
      .then((result) => setState({ status: 'loaded', projectId, result }))
      .catch((cause: Error) => {
        if (controller.signal.aborted) return
        setState({ status: 'error', projectId, message: cause.message })
      })

    return () => controller.abort()
  }, [projectId])

  // zaraz po zmianie projektu w trasie stan opisuje jeszcze poprzedni
  return state.projectId === projectId ? state : { status: 'loading', projectId }
}
