import { useEffect, useState } from 'react'
import { ApiError } from '../api/client'
import { getTicket } from '../api/tickets'
import type { TicketDetails } from '../types'

interface TicketState {
  ticket: TicketDetails | null
  missing: boolean
  error: string | null
  loading: boolean
  reload: () => void
}

interface Answer {
  ticketId: string
  ticket: TicketDetails | null
  missing: boolean
  error: string | null
}

// pusty identyfikator nie zgadza się z żadnym więc pierwszy render wychodzi jako ładowanie
const noAnswer: Answer = { ticketId: '', ticket: null, missing: false, error: null }

export function useTicket(ticketId: string): TicketState {
  const [answer, setAnswer] = useState<Answer>(noAnswer)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()

    getTicket(ticketId, controller.signal)
      .then((ticket) => setAnswer({ ticketId, ticket, missing: false, error: null }))
      .catch((cause: Error) => {
        if (controller.signal.aborted) return

        // skasowany albo zmyślony identyfikator to nie jest awaria tylko brak zasobu
        const missing = cause instanceof ApiError && cause.status === 404

        setAnswer({
          ticketId,
          ticket: null,
          missing,
          error: missing ? null : cause.message,
        })
      })

    return () => controller.abort()
  }, [ticketId, reloadKey])

  const loading = answer.ticketId !== ticketId

  return {
    ticket: loading ? null : answer.ticket,
    missing: loading ? false : answer.missing,
    error: loading ? null : answer.error,
    loading,
    reload: () => setReloadKey((value) => value + 1),
  }
}
