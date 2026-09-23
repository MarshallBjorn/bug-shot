import React from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import TicketDetailsPage from './TicketDetailsPage'
import { useTicket } from '../hooks/useTicket'
import {
  addTicketComment,
  deleteTicket,
  getTicketComments,
  updateTicketStatus,
} from '../api/tickets'
import { ApiError } from '../api/client'
import { ProjectLiveContext, type StreamHandlers } from '../live/projectLiveContext'
import type { TicketStatus } from '../types'

const navigate = vi.fn()
const reload = vi.fn()

const routerState = vi.hoisted(() => ({
  locationState: { listSearch: 'status=New&page=2' } as unknown,
}))

const access = vi.hoisted(() => ({ role: 'Member' as string | null }))

vi.mock('../projects/ProjectsContext', () => ({
  useProjectRole: () => access.role,
}))

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({
    status: 'authenticated',
    user: { id: 'u1', email: 'bartek@bug-shot.local', isAdmin: true, isActive: true },
    logIn: vi.fn(),
    logOut: vi.fn(),
  }),
}))

vi.mock('../hooks/useAttachmentText', () => ({
  useAttachmentText: () => ({ text: null, error: null, loading: false }),
}))

vi.mock('../hooks/useAttachment', () => ({
  useAttachment: () => ({ url: 'blob:x', failed: false }),
}))

vi.mock('../hooks/useTicket', () => ({
  useTicket: vi.fn(),
}))

vi.mock('../api/tickets', () => ({
  addTicketComment: vi.fn(),
  deleteTicket: vi.fn(),
  getTicketComments: vi.fn(),
  updateTicketStatus: vi.fn(),
}))

vi.mock('../api/client', () => ({
  ApiError: class ApiError extends Error {
    status: number

    constructor(status: number, message = '') {
      super(message)
      this.status = status
    }
  },
}))



vi.mock('../format', () => ({
  formatDateTime: (value: string | null) => value ?? '-',
  formatRelativeTime: (value: string | null) => value ?? '-',
  formatStatus: (value: string) => value,
  formatAttachmentKind: (value: string) => value,
  formatFileSize: (value: number) => `${value} B`,
}))

vi.mock('react-router', () => ({
  Link: ({
    to,
    children,
  }: {
    to: unknown
    children: React.ReactNode
  }) => (
    <a
      href={
        typeof to === 'string'
          ? to
          : String(
              (to as { pathname: string; search?: string }).pathname +
              ((to as { search?: string }).search ?? ''),
            )
      }
    >
      {children}
    </a>
  ),
  useLocation: () => ({
    state: routerState.locationState,
  }),
  useNavigate: () => navigate,
  useParams: () => ({
    projectId: 'p1',
    ticketId: 't1',
  }),
}))

vi.mock('../components/AttachmentGallery', () => ({
  default: () => <div data-testid="attachment-gallery">Attachments</div>,
}))

vi.mock('../components/AttachmentDownload', () => ({
  default: ({
    label,
  }: {
    attachment: unknown
    label: string
  }) => <button type="button">{label}</button>,
}))

const mockedUseTicket = vi.mocked(useTicket)
const mockedComments = vi.mocked(getTicketComments)
const mockedAddComment = vi.mocked(addTicketComment)
const mockedStatus = vi.mocked(updateTicketStatus)
const mockedDelete = vi.mocked(deleteTicket)

const ticket = {
  id: 't1',
  projectId: 'p1',
  projectKey: 'ACME',
  description: 'Koszyk gubi produkty',
  pageUrl: 'https://acme.example/cart',
  page: 'acme.example/cart',
  userAgent: 'Mozilla/Test',
  environment: {
    browserName: 'Chrome',
    osName: 'Windows',
    deviceType: 'desktop',
    viewportWidth: 1536,
    viewportHeight: 730,
    devicePixelRatio: 1.25,
    language: 'pl-PL',
    timeZone: 'Europe/Warsaw',
  },
  allowedStatuses: ['InProgress', 'Rejected'] as TicketStatus[],
  status: 'New' as const,
  reportedAt: '2026-09-14T10:00:00Z',
  receivedAt: '2026-09-14T10:01:00Z',
  createdAt: '2026-09-14T10:00:00Z',
  updatedAt: '2026-09-14T10:01:00Z',
  rowVersion: 'rv1',
  attachments: [
    {
      id: 'a1',
      kind: 'Screenshot' as const,
      fileName: 'screen.png',
      contentType: 'image/png',
      sizeBytes: 10,
    },
  ],
  consoleLog: {
    id: 'a2',
    kind: 'ConsoleLog' as const,
    fileName: 'console.txt',
    contentType: 'text/plain',
    sizeBytes: 20,
  },
  commentCount: 0,
  statusHistory: [],
}

const comment = {
  id: 'c1',
  author: 'Radek',
  body: 'Sprawdziłem.',
  createdAt: '2026-09-14T10:02:00Z',
}

beforeEach(() => {
  vi.clearAllMocks()
  access.role = 'Member'
  routerState.locationState = {
    listSearch: 'status=New&page=2',
  }

  mockedUseTicket.mockReturnValue({
    ticket,
    missing: false,
    error: null,
    loading: false,
    reload,
  })

  mockedComments.mockResolvedValue({
    items: [],
    total: 0,
    page: 1,
    pageSize: 50,
  })

  mockedAddComment.mockResolvedValue(comment)
  mockedStatus.mockResolvedValue({
    id: 't1',
    status: 'Resolved',
    rowVersion: 'rv2',
    updatedAt: '2026-09-14T10:03:00Z',
  })

  mockedDelete.mockResolvedValue(undefined)
})

afterEach(() => {
  cleanup()
})

describe('TicketDetailsPage', () => {
  it('pokazuje ladowanie', () => {
    mockedUseTicket.mockReturnValue({
      ticket: null,
      missing: false,
      error: null,
      loading: true,
      reload,
    })

    render(<TicketDetailsPage />)

    expect(screen.getByText('Ładowanie...')).toBeDefined()
  })

  it('pokazuje brak ticketu', () => {
    mockedUseTicket.mockReturnValue({
      ticket: null,
      missing: true,
      error: null,
      loading: false,
      reload,
    })

    render(<TicketDetailsPage />)

    expect(screen.getByText('Nie ma takiego zgłoszenia')).toBeDefined()
    expect(screen.getByRole('link', { name: 'Wróć do listy' })).toBeDefined()
  })

  it('pokazuje blad pobierania', () => {
    mockedUseTicket.mockReturnValue({
      ticket: null,
      missing: false,
      error: 'Serwer niedostępny',
      loading: false,
      reload,
    })

    render(<TicketDetailsPage />)

    expect(screen.getByRole('alert').textContent).toContain(
      'Serwer niedostępny',
    )
  })

  it('pokazuje szczegoly i laduje komentarze', async () => {
    render(<TicketDetailsPage />)

    expect(screen.getByRole('heading', { name: 'Koszyk gubi produkty' })).toBeDefined()
    expect(screen.getByText('Mozilla/Test')).toBeDefined()
    expect(
      await screen.findByText('Nic się jeszcze nie stało z tym zgłoszeniem.'),
    ).toBeDefined()
    expect(screen.getByTestId('attachment-gallery')).toBeDefined()

    await vi.waitFor(() => {
      expect(mockedComments).toHaveBeenCalledWith(
        't1',
        1,
        50,
        expect.any(AbortSignal),
      )
    })
  })

  it('dodaje komentarz', async () => {
    render(<TicketDetailsPage />)

    // autor nie jest wpisywany, idzie z zalogowanego konta
    fireEvent.change(screen.getByLabelText('Komentarz jako bartek@bug-shot.local'), {
      target: { value: 'Nowy komentarz' },
    })

    fireEvent.submit(
      screen.getByRole('button', { name: 'Dodaj komentarz' }).closest('form')!,
    )

    await vi.waitFor(() => {
      expect(mockedAddComment).toHaveBeenCalledWith(
        't1',
        'bartek@bug-shot.local',
        'Nowy komentarz',
      )
    })

    expect(await screen.findByText('Nowy komentarz')).toBeDefined()
  })

  it('zmienia status i przeładowuje ticket', async () => {
    render(<TicketDetailsPage />)

    fireEvent.click(screen.getByRole('button', { name: 'InProgress' }))

    await vi.waitFor(() => {
      expect(mockedStatus).toHaveBeenCalledWith(
        't1',
        'InProgress',
        'rv1',
        'bartek@bug-shot.local',
      )
      expect(reload).toHaveBeenCalled()
    })
  })

  it('pokazuje toast po konflikcie 409', async () => {
    mockedStatus.mockRejectedValueOnce(
      new ApiError(409, 'Conflict'),
    )

    render(<TicketDetailsPage />)

    fireEvent.click(screen.getByRole('button', { name: 'InProgress' }))

    expect(
      await screen.findByRole('status'),
    ).toBeDefined()

    expect(reload).toHaveBeenCalled()
  })

  it('pokazuje blad zmiany statusu', async () => {
    mockedStatus.mockRejectedValueOnce(
      new ApiError(500, 'Nie udało się zmienić statusu'),
    )

    render(<TicketDetailsPage />)

    fireEvent.click(screen.getByRole('button', { name: 'InProgress' }))

    expect(
      await screen.findByRole('alert'),
    ).toBeDefined()
  })

  it('usuwa ticket po potwierdzeniu i zgodnym ID', async () => {
    render(<TicketDetailsPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Usuń zgłoszenie' }))

    fireEvent.change(
      screen.getByLabelText('Przepisz identyfikator zgłoszenia, aby potwierdzić'),
      { target: { value: 't1' } },
    )

    fireEvent.click(screen.getByRole('button', { name: 'Usuń na zawsze' }))

    await vi.waitFor(() => {
      expect(mockedDelete).toHaveBeenCalledWith('t1')
      expect(navigate).toHaveBeenCalledWith('/projects/p1/tickets')
    })
  })

  // niezgodny identyfikator nie moze przepuscic kasowania
  it('nie usuwa ticketu przy niezgodnym identyfikatorze', () => {
    render(<TicketDetailsPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Usuń zgłoszenie' }))

    fireEvent.change(
      screen.getByLabelText('Przepisz identyfikator zgłoszenia, aby potwierdzić'),
      { target: { value: 'nie-to-id' } },
    )

    expect(screen.getByRole('button', { name: 'Usuń na zawsze' })).toHaveProperty('disabled', true)
    expect(mockedDelete).not.toHaveBeenCalled()
  })

  it('anulowanie zamyka dialog bez kasowania', () => {
    render(<TicketDetailsPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Usuń zgłoszenie' }))
    fireEvent.click(screen.getByRole('button', { name: 'Anuluj' }))

    expect(mockedDelete).not.toHaveBeenCalled()
  })

  // AC mowi o rozsuwanej szpalcie, wiec zwijanie jest czescia kontraktu widoku
  it('szpalta szczegolow zwija sie i wraca', () => {
    render(<TicketDetailsPage />)

    const toggle = screen.getByRole('button', { name: 'Zwiń szczegóły' })

    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByRole('region', { name: 'Status' })).toBeDefined()

    fireEvent.click(toggle)

    const back = screen.getByRole('button', { name: 'Rozwiń szczegóły' })

    expect(back.getAttribute('aria-expanded')).toBe('false')

    fireEvent.click(back)

    expect(screen.getByRole('button', { name: 'Zwiń szczegóły' })).toBeDefined()
  })
})

describe('kanal live na detalu', () => {
  function renderLive() {
    const subscribed: StreamHandlers[] = []

    render(
      <ProjectLiveContext.Provider
        value={{
          status: 'live',
          subscribe: (handlers) => {
            subscribed.push(handlers)
            return () => {}
          },
        }}
      >
        <TicketDetailsPage />
      </ProjectLiveContext.Provider>,
    )

    return subscribed[0]
  }

  it('zmiana tego zgloszenia przeladowuje detal', () => {
    const live = renderLive()

    live.onEvent({ type: 'changed', ticket: { ...ticket, id: 't1' } as never })
    live.onEvent({ type: 'deleted', ticketId: 't1' })

    expect(reload).toHaveBeenCalledTimes(2)
  })

  it('zdarzenia innych zgloszen nie ruszaja detalu', () => {
    const live = renderLive()

    live.onEvent({ type: 'changed', ticket: { ...ticket, id: 't2' } as never })
    live.onEvent({ type: 'created', ticket: { ...ticket, id: 't3' } as never })
    live.onEvent({ type: 'deleted', ticketId: 't4' })

    expect(reload).not.toHaveBeenCalled()
  })

  it('podglad bez roli member nie komentuje nie zmienia statusu i nie kasuje', async () => {
    access.role = 'Viewer'

    render(<TicketDetailsPage />)

    expect(
      await screen.findByText('Nic się jeszcze nie stało z tym zgłoszeniem.'),
    ).toBeDefined()
    expect(screen.queryByRole('button', { name: 'Dodaj komentarz' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'InProgress' })).toBeNull()
    expect(screen.queryByRole('region', { name: 'Kasowanie' })).toBeNull()
  })

  it('akcje czekaja az wiadomo jaka role ma konto', () => {
    access.role = null

    render(<TicketDetailsPage />)

    expect(screen.queryByRole('button', { name: 'Dodaj komentarz' })).toBeNull()
  })
})
