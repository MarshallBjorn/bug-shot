import { useEffect, useRef, useState } from 'react'
import { useTicketStream } from './useTicketStream'

// licznik rośnie po każdym zdarzeniu z kanału live więc widok z własnym GET wie kiedy go powtórzyć
// seria zgłoszeń w krótkim odstępie daje jedno przeładowanie zamiast kilku
export function useLiveRevision(delay = 500): number {
  const [revision, setRevision] = useState(0)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const bump = () => {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setRevision((value) => value + 1), delay)
  }

  useTicketStream({ onEvent: bump, onReconnected: bump })

  return revision
}
