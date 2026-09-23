import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import CommentForm from './CommentForm'
import TicketEnvironment from './TicketEnvironment'
import TicketStatusControl from './TicketStatusControl'
import TicketTimeline from './TicketTimeline'
import type { TicketClientEnvironment } from '../types'

afterEach(() => {
  cleanup()
})

describe('kontrolka statusu', () => {
  it('pokazuje przycisk dla kazdego dozwolonego przejscia', () => {
    render(
      <TicketStatusControl
        status="New"
        allowed={['InProgress', 'Rejected']}
        busy={false}
        onChange={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: 'W trakcie' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Odrzucone' })).toBeDefined()
    expect(screen.queryByRole('button', { name: 'Rozwiązane' })).toBeNull()
  })

  it('klik oddaje docelowy status', () => {
    const onChange = vi.fn()

    render(
      <TicketStatusControl status="New" allowed={['InProgress']} busy={false} onChange={onChange} />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'W trakcie' }))

    expect(onChange).toHaveBeenCalledWith('InProgress')
  })

  it('w trakcie zapisu przyciski sa nieaktywne', () => {
    render(<TicketStatusControl status="New" allowed={['InProgress']} busy onChange={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'W trakcie' })).toHaveProperty('disabled', true)
  })

  it('tombstone tlumaczy dlaczego nie ma przejsc', () => {
    render(<TicketStatusControl status="Deleted" allowed={[]} busy={false} onChange={vi.fn()} />)

    expect(screen.getByText('Skasowane zgłoszenie nie zmienia już statusu.')).toBeDefined()
  })
})

describe('blok srodowiska', () => {
  const full: TicketClientEnvironment = {
    browserName: 'Chrome',
    osName: 'Windows',
    deviceType: 'mobile',
    viewportWidth: 412,
    viewportHeight: 839,
    devicePixelRatio: 2.625,
    language: 'pl-PL',
    timeZone: 'Europe/Warsaw',
  }

  it('pokazuje rozpoznane dane razem z viewportem', () => {
    render(<TicketEnvironment environment={full} userAgent="Mozilla/5.0" />)

    expect(screen.getByText('Chrome')).toBeDefined()
    expect(screen.getByText('Telefon')).toBeDefined()
    expect(screen.getByText('412 na 839, dpr 2.625')).toBeDefined()
    expect(screen.getByText('Europe/Warsaw')).toBeDefined()
  })

  // kasowanie zeruje te pola wiec blok nie moze pokazywac pustych wierszy
  it('puste pola sa pomijane', () => {
    render(
      <TicketEnvironment
        environment={{
          browserName: '',
          osName: '',
          deviceType: '',
          viewportWidth: null,
          viewportHeight: null,
          devicePixelRatio: null,
          language: null,
          timeZone: null,
        }}
        userAgent=""
      />,
    )

    expect(screen.queryByText('Przeglądarka')).toBeNull()
    expect(screen.queryByText('Viewport')).toBeNull()
    expect(screen.queryByText('User agent')).toBeNull()
  })

  it('viewport bez wymiarow nie wchodzi', () => {
    render(
      <TicketEnvironment
        environment={{ ...full, viewportWidth: null, viewportHeight: null }}
        userAgent="Mozilla/5.0"
      />,
    )

    expect(screen.queryByText('Viewport')).toBeNull()
  })
})

describe('scalona historia', () => {
  const change = {
    fromStatus: 'New' as const,
    toStatus: 'InProgress' as const,
    changedBy: 'bartek',
    changedAt: '2026-09-17T10:05:00Z',
  }

  const comment = {
    id: 'c1',
    author: 'radek',
    body: 'sprawdzam',
    createdAt: '2026-09-17T10:00:00Z',
  }

  it('komentarze i zmiany statusu ida jednym strumieniem', () => {
    render(<TicketTimeline statusHistory={[change]} comments={[comment]} loading={false} />)

    const items = screen.getByRole('list', { name: 'Historia zgłoszenia' }).children

    expect(items).toHaveLength(2)
    expect(items[0].textContent).toContain('sprawdzam')
    expect(items[1].textContent).toContain('zmienił status')
  })

  it('zmiana statusu mowi kto i skad dokad', () => {
    render(<TicketTimeline statusHistory={[change]} comments={[]} loading={false} />)

    expect(screen.getByText(/bartek/)).toBeDefined()
    expect(screen.getByText(/z Nowe na W trakcie/)).toBeDefined()
  })

  it('pusta historia zaprasza zamiast milczec', () => {
    render(<TicketTimeline statusHistory={[]} comments={[]} loading={false} />)

    expect(screen.getByText('Nic się jeszcze nie stało z tym zgłoszeniem.')).toBeDefined()
  })

  it('w trakcie ladowania pokazuje postep', () => {
    render(<TicketTimeline statusHistory={[]} comments={[]} loading />)

    expect(screen.getByText('Ładowanie historii...')).toBeDefined()
  })
})

describe('formularz komentarza', () => {
  it('etykieta mowi kim podpisze sie komentarz', () => {
    render(<CommentForm author="bartek@bug-shot.local" busy={false} onSubmit={vi.fn()} />)

    expect(screen.getByLabelText('Komentarz jako bartek@bug-shot.local')).toBeDefined()
  })

  it('pusta tresc nie wysyla niczego', () => {
    const onSubmit = vi.fn()

    render(<CommentForm author="bartek" busy={false} onSubmit={onSubmit} />)

    fireEvent.change(screen.getByLabelText(/Komentarz jako/), { target: { value: '   ' } })
    fireEvent.submit(screen.getByRole('button', { name: 'Dodaj komentarz' }).closest('form')!)

    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('wysyla tresc bez spacji z brzegow i czysci pole', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)

    render(<CommentForm author="bartek" busy={false} onSubmit={onSubmit} />)

    const field = screen.getByLabelText(/Komentarz jako/)

    fireEvent.change(field, { target: { value: '  tresc  ' } })
    fireEvent.submit(screen.getByRole('button', { name: 'Dodaj komentarz' }).closest('form')!)

    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledWith('tresc'))
    await vi.waitFor(() => expect(field).toHaveProperty('value', ''))
  })
})
