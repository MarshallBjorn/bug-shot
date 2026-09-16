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

const navigate = vi.fn()
const reload = vi.fn()

const routerState = vi.hoisted(() => ({
  locationState: { listSearch: 'status=New&page=2' } as unknown,
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
  formatStatus: (value: string) => value,
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
  userAgent: 'Mozilla/Test',
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

    expect(screen.getByText('Koszyk gubi produkty')).toBeDefined()
    expect(screen.getByText('Mozilla/Test')).toBeDefined()
    expect(await screen.findByText('Brak komentarzy.')).toBeDefined()
    expect(screen.getByTestId('attachment-gallery')).toBeDefined()
    expect(
      screen.getByRole('button', { name: 'Pobierz log konsoli' }),
    ).toBeDefined()

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

    fireEvent.change(screen.getByLabelText('Autor'), {
      target: { value: 'Radek' },
    })

    fireEvent.change(screen.getByLabelText('Komentarz'), {
      target: { value: 'Nowy komentarz' },
    })

    fireEvent.submit(
      screen.getByRole('button', { name: 'Dodaj komentarz' }).closest('form')!,
    )

    await vi.waitFor(() => {
      expect(mockedAddComment).toHaveBeenCalledWith(
        't1',
        'Radek',
        'Nowy komentarz',
      )
    })

    expect(await screen.findByText('Nowy komentarz')).toBeDefined()
  })

  it('zmienia status i przeładowuje ticket', async () => {
    render(<TicketDetailsPage />)

    fireEvent.change(
      screen.getByRole('combobox'),
      { target: { value: 'Resolved' } },
    )

    await vi.waitFor(() => {
      expect(mockedStatus).toHaveBeenCalledWith(
        't1',
        'Resolved',
        'rv1',
        'dashboard',
      )
      expect(reload).toHaveBeenCalled()
    })
  })

  it('pokazuje toast po konflikcie 409', async () => {
    mockedStatus.mockRejectedValueOnce(
      new ApiError(409, 'Conflict'),
    )

    render(<TicketDetailsPage />)

    fireEvent.change(
      screen.getByRole('combobox'),
      { target: { value: 'Resolved' } },
    )

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

    fireEvent.change(
      screen.getByRole('combobox'),
      { target: { value: 'Resolved' } },
    )

    expect(
      await screen.findByRole('alert'),
    ).toBeDefined()
  })

  it('usuwa ticket po potwierdzeniu i zgodnym ID', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    vi.spyOn(window, 'prompt').mockReturnValue('t1')

    render(<TicketDetailsPage />)

    fireEvent.click(
      screen.getByRole('button', { name: 'Usuń zgłoszenie' }),
    )

    await vi.waitFor(() => {
      expect(mockedDelete).toHaveBeenCalledWith('t1')
      expect(navigate).toHaveBeenCalledWith('/projects/p1/tickets')
    })
  })

  it('nie usuwa ticketu po anulowaniu', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)

    render(<TicketDetailsPage />)

    fireEvent.click(
      screen.getByRole('button', { name: 'Usuń zgłoszenie' }),
    )

    expect(mockedDelete).not.toHaveBeenCalled()
  })
})







