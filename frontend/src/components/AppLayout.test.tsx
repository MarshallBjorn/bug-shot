import React from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AppLayout from './AppLayout'
import { ThemeProvider } from '../theme/ThemeProvider'
import { useAuth } from '../auth/AuthContext'
import { getProjects } from '../api/projects'

const navigate = vi.fn()
const logOut = vi.fn()
let params: { projectId?: string } = { projectId: 'p1' }
let match: string | null = null

vi.mock('../auth/AuthContext', () => ({
  useAuth: vi.fn(),
}))

// prawdziwy kanal live probuje laczyc sie z API i jego logi przychodza juz po zamknieciu srodowiska testu
vi.mock('../live/ProjectLive', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('../api/projects', () => ({
  getProjects: vi.fn(),
}))

vi.mock('./SidebarProject', () => ({
  default: () => <div data-testid="sidebar-project" />,
}))

vi.mock('react-router', () => ({
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => (
    <a href={to}>{children}</a>
  ),
  NavLink: ({
    to,
    children,
    onClick,
  }: {
    to: string
    children: React.ReactNode
    onClick?: () => void
  }) => (
    <a href={to} onClick={onClick}>
      {children}
    </a>
  ),
  Outlet: () => <div data-testid="outlet">Outlet</div>,
  useMatch: (pattern: string) => (pattern === match ? {} : null),
  useNavigate: () => navigate,
  useParams: () => params,
}))

const mockedUseAuth = vi.mocked(useAuth)

function renderLayout() {
  return render(
    <ThemeProvider>
      <AppLayout />
    </ThemeProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  params = { projectId: 'p1' }
  match = null
  logOut.mockResolvedValue(undefined)
  vi.mocked(getProjects).mockResolvedValue([])
})

afterEach(() => {
  cleanup()
})

describe('AppLayout', () => {
  it('pokazuje uzytkownika i linki administracyjne dla admina', () => {
    mockedUseAuth.mockReturnValue({
      status: 'authenticated',
      user: {
        id: 'admin',
        email: 'admin@test.local',
        isAdmin: true,
        isActive: true,
      },
      logIn: vi.fn(),
      logOut,
    })

    renderLayout()

    expect(screen.getByText('Bug-shot')).toBeDefined()
    expect(screen.getByText('admin@test.local')).toBeDefined()
    expect(screen.getByRole('link', { name: 'Zarządzanie projektami' })).toBeDefined()
    expect(screen.getByRole('link', { name: 'Sanityzacja' })).toBeDefined()
    expect(screen.getByTestId('outlet')).toBeDefined()
  })

  it('ukrywa linki administracyjne dla zwyklego uzytkownika', () => {
    mockedUseAuth.mockReturnValue({
      status: 'authenticated',
      user: {
        id: 'user',
        email: 'user@test.local',
        isAdmin: false,
        isActive: true,
      },
      logIn: vi.fn(),
      logOut,
    })

    renderLayout()

    expect(screen.getByText('user@test.local')).toBeDefined()
    expect(screen.queryByRole('link', { name: 'Zarządzanie projektami' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Sanityzacja' })).toBeNull()
  })

  // zwykly uzytkownik na liscie projektow nie ma w nawigacji ani jednej pozycji
  it('nie stawia pustej belki bocznej', () => {
    params = {}
    mockedUseAuth.mockReturnValue({
      status: 'authenticated',
      user: {
        id: 'user',
        email: 'user@test.local',
        isAdmin: false,
        isActive: true,
      },
      logIn: vi.fn(),
      logOut,
    })

    renderLayout()

    expect(screen.queryByRole('navigation', { name: 'Nawigacja panelu' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Otwórz nawigację' })).toBeNull()
    expect(screen.getByTestId('outlet')).toBeDefined()
  })

  it('zostawia belke gdy jest co w niej pokazac', () => {
    params = {}
    mockedUseAuth.mockReturnValue({
      status: 'authenticated',
      user: {
        id: 'admin',
        email: 'admin@test.local',
        isAdmin: true,
        isActive: true,
      },
      logIn: vi.fn(),
      logOut,
    })

    renderLayout()

    expect(screen.getByRole('button', { name: 'Otwórz nawigację' })).toBeDefined()
  })

  it('wylogowuje i przechodzi do logowania', async () => {
    mockedUseAuth.mockReturnValue({
      status: 'authenticated',
      user: {
        id: 'user',
        email: 'user@test.local',
        isAdmin: false,
        isActive: true,
      },
      logIn: vi.fn(),
      logOut,
    })

    renderLayout()

    fireEvent.click(screen.getByRole('button', { name: 'Wyloguj' }))

    await vi.waitFor(() => {
      expect(logOut).toHaveBeenCalledTimes(1)
      expect(navigate).toHaveBeenCalledWith('/login', { replace: true })
    })
  })

  it('na liscie zgloszen pokazuje przycisk ze skrotami klawiszowymi', () => {
    mockedUseAuth.mockReturnValue({
      status: 'authenticated',
      user: { id: 'user', email: 'user@test.local', isAdmin: false, isActive: true },
      logIn: vi.fn(),
      logOut,
    })
    match = '/projects/:projectId/tickets'

    renderLayout()

    fireEvent.click(screen.getByRole('button', { name: 'Skróty klawiszowe' }))

    expect(screen.getByRole('dialog', { name: 'Skróty klawiszowe' })).toBeDefined()
  })

  it('poza lista zgloszen nie pokazuje przycisku ze skrotami', () => {
    mockedUseAuth.mockReturnValue({
      status: 'authenticated',
      user: { id: 'user', email: 'user@test.local', isAdmin: false, isActive: true },
      logIn: vi.fn(),
      logOut,
    })

    renderLayout()

    expect(screen.queryByRole('button', { name: 'Skróty klawiszowe' })).toBeNull()
  })

  it('maintainer projektu widzi ustawienia projektow bez kont i sanityzacji', async () => {
    params = {}
    vi.mocked(getProjects).mockResolvedValue([
      { id: 'p1', name: 'Sklep', key: 'shop', createdAt: '2026-09-01', origins: [], role: 'Maintainer' },
    ])
    mockedUseAuth.mockReturnValue({
      status: 'authenticated',
      user: { id: 'user', email: 'user@test.local', isAdmin: false, isActive: true },
      logIn: vi.fn(),
      logOut,
    })

    renderLayout()

    expect(await screen.findByRole('link', { name: 'Zarządzanie projektami' })).toBeDefined()
    expect(screen.queryByRole('link', { name: 'Konta' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Sanityzacja' })).toBeNull()
  })

  it('adres konta prowadzi do ustawien konta', () => {
    mockedUseAuth.mockReturnValue({
      status: 'authenticated',
      user: { id: 'user', email: 'user@test.local', isAdmin: false, isActive: true },
      logIn: vi.fn(),
      logOut,
    })

    renderLayout()

    expect(screen.getByRole('link', { name: 'user@test.local' }).getAttribute('href')).toBe('/account')
  })
})
