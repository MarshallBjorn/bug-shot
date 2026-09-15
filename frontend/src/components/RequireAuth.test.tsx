import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import RequireAuth from './RequireAuth'
import { useAuth } from '../auth/AuthContext'

vi.mock('../auth/AuthContext', () => ({
  useAuth: vi.fn(),
}))

vi.mock('react-router', () => ({
  Navigate: ({
    to,
    replace,
    state,
  }: {
    to: string
    replace?: boolean
    state?: unknown
  }) => (
    <div
      data-testid="navigate"
      data-to={to}
      data-replace={String(replace)}
      data-state={JSON.stringify(state)}
    />
  ),
  Outlet: () => <div data-testid="outlet">Outlet</div>,
  useLocation: () => ({
    pathname: '/projects/project-1/tickets',
    search: '?page=2',
  }),
}))

const mockedUseAuth = vi.mocked(useAuth)

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  cleanup()
})

describe('RequireAuth', () => {
  it('pokazuje komunikat podczas sprawdzania sesji', () => {
    mockedUseAuth.mockReturnValue({
      status: 'checking',
      user: null,
      logIn: vi.fn(),
      logOut: vi.fn(),
    })

    render(<RequireAuth />)

    expect(screen.getByText('Sprawdzanie sesji...')).toBeDefined()
    expect(screen.queryByTestId('navigate')).toBeNull()
    expect(screen.queryByTestId('outlet')).toBeNull()
  })

  it('przekierowuje anonimowego uzytkownika do logowania z aktualna trasa', () => {
    mockedUseAuth.mockReturnValue({
      status: 'anonymous',
      user: null,
      logIn: vi.fn(),
      logOut: vi.fn(),
    })

    render(<RequireAuth />)

    const navigation = screen.getByTestId('navigate')

    expect(navigation.getAttribute('data-to')).toBe('/login')
    expect(navigation.getAttribute('data-replace')).toBe('true')
    expect(navigation.getAttribute('data-state')).toContain(
      '/projects/project-1/tickets?page=2',
    )
  })

  it('wpuszcza uwierzytelnionego uzytkownika do outletu', () => {
    mockedUseAuth.mockReturnValue({
      status: 'authenticated',
      user: {
        id: 'u1',
        email: 'user@test.local',
        isAdmin: false,
        isActive: true,
      },
      logIn: vi.fn(),
      logOut: vi.fn(),
    })

    render(<RequireAuth />)

    expect(screen.getByTestId('outlet')).toBeDefined()
    expect(screen.queryByTestId('navigate')).toBeNull()
  })
})
