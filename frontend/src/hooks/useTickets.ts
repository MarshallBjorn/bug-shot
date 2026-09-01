import { useEffect, useState } from 'react'
import { getTickets } from '../api/tickets'
import type { TicketQuery } from '../ticketQuery'
import type { PagedResult, TicketListItem } from '../types'

interface TicketsState {
  result: PagedResult<TicketListItem> | null
  error: string | null
  loading: boolean
}

interface Answer {
  projectId: string
  query: TicketQuery | null
  result: PagedResult<TicketListItem> | null
  error: string | null
}

// puste zapytanie nie zgadza się z żadnym więc pierwszy render wychodzi jako ładowanie
const noAnswer: Answer = { projectId: '', query: null, result: null, error: null }

export function useTickets(projectId: string, query: TicketQuery): TicketsState {
  const [answer, setAnswer] = useState<Answer>(noAnswer)

  useEffect(() => {
    const controller = new AbortController()

    getTickets(projectId, query, controller.signal)
      .then((result) => setAnswer({ projectId, query, result, error: null }))
      .catch((cause: Error) => {
        if (controller.signal.aborted) return
        setAnswer({ projectId, query, result: null, error: cause.message })
      })

    return () => controller.abort()
  }, [projectId, query])

  const loading = answer.projectId !== projectId || answer.query !== query

  return {
    // wyniki poprzedniego filtra zostają na ekranie żeby tabela nie mrugała
    // ale wyniki innego projektu już nie
    result: answer.projectId === projectId ? answer.result : null,
    error: loading ? null : answer.error,
    loading,
  }
}
