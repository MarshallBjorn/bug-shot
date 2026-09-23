import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ProjectLiveProvider from './ProjectLive'
import { createTicketConnection } from './connection'
import { useLiveRevision } from '../hooks/useLiveRevision'
import { useTicketStream } from '../hooks/useTicketStream'
import type { TicketEvent } from './ticketEvents'

vi.mock('./connection', () => ({
  createTicketConnection: vi.fn(),
}))

type Handler = (...args: unknown[]) => void

function fakeConnection() {
  const handlers = new Map<string, Handler>()

  return {
    handlers,
    on: vi.fn((name: string, handler: Handler) => handlers.set(name, handler)),
    onreconnecting: vi.fn(),
    onreconnected: vi.fn(),
    onclose: vi.fn(),
    start: vi.fn(() => Promise.resolve()),
    invoke: vi.fn(() => Promise.resolve()),
    stop: vi.fn(() => Promise.resolve()),
  }
}

let connection: ReturnType<typeof fakeConnection>

beforeEach(() => {
  connection = fakeConnection()
  vi.mocked(createTicketConnection).mockReturnValue(connection as never)
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

function Listener({ onEvent }: { onEvent: (event: TicketEvent) => void }) {
  useTicketStream({ onEvent, onReconnected: vi.fn() })

  return null
}

function Revision() {
  return <span data-testid="revision">{useLiveRevision(500)}</span>
}

describe('wspolny kanal projektu', () => {
  it('jedno polaczenie rozsyla zdarzenia do wszystkich odbiorcow', () => {
    const first = vi.fn()
    const second = vi.fn()

    render(
      <ProjectLiveProvider projectId="p1">
        <Listener onEvent={first} />
        <Listener onEvent={second} />
      </ProjectLiveProvider>,
    )

    act(() => connection.handlers.get('TicketDeleted')?.('t1'))

    expect(createTicketConnection).toHaveBeenCalledTimes(1)
    expect(first).toHaveBeenCalledWith({ type: 'deleted', ticketId: 't1' })
    expect(second).toHaveBeenCalledWith({ type: 'deleted', ticketId: 't1' })
  })

  it('odbiorca po odmontowaniu nie dostaje zdarzen', () => {
    const onEvent = vi.fn()

    const view = render(
      <ProjectLiveProvider projectId="p1">
        <Listener onEvent={onEvent} />
      </ProjectLiveProvider>,
    )

    view.rerender(<ProjectLiveProvider projectId="p1">{null}</ProjectLiveProvider>)

    act(() => connection.handlers.get('TicketDeleted')?.('t1'))

    expect(onEvent).not.toHaveBeenCalled()
  })

  it('bez projektu nie otwiera polaczenia', () => {
    render(<ProjectLiveProvider projectId="">{null}</ProjectLiveProvider>)

    expect(createTicketConnection).not.toHaveBeenCalled()
  })
})

describe('rewizja z kanalu live', () => {
  it('seria zdarzen daje jedno podbicie', () => {
    vi.useFakeTimers()

    const view = render(
      <ProjectLiveProvider projectId="p1">
        <Revision />
      </ProjectLiveProvider>,
    )

    act(() => {
      connection.handlers.get('TicketDeleted')?.('t1')
      connection.handlers.get('TicketDeleted')?.('t2')
      connection.handlers.get('TicketDeleted')?.('t3')
    })

    expect(view.getByTestId('revision').textContent).toBe('0')

    act(() => vi.advanceTimersByTime(500))

    expect(view.getByTestId('revision').textContent).toBe('1')
  })
})
