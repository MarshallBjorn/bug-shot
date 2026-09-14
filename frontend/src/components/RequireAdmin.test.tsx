import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import RequireAdmin from './RequireAdmin'
import { useAuth } from '../auth/AuthContext'

vi.mock('../auth/AuthContext', () => ({
  useAuth: vi.fn(),
}))

vi.mock('react-router', () => ({
  Navigate: ({
    to,
    replace,
  }: {
    to: string
    replace?: boolean
  }) => (
    <div
      data-testid="navigate"
      data-to={to}
      data-replace={String(replace)}
    />
  ),
  Outlet: () => <div data-testid="outlet">Outlet</div>,
}))

const mockedUseAuth = vi.mocked(useAuth)

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  cleanup()
})

describe('RequireAdmin', () => {
  it('przekierowuje anonimowego uzytkownika', () => {
    mockedUseAuth.mockReturnValue({
      status: 'anonymous',
      user: null,
      logIn: vi.fn(),
      logOut: vi.fn(),
    })

    render(<RequireAdmin />)

    const navigation = screen.getByTestId('navigate')

    expect(navigation.getAttribute('data-to')).toBe('/')
    expect(navigation.getAttribute('data-replace')).toBe('true')
    expect(screen.queryByTestId('outlet')).toBeNull()
  })

  it('przekierowuje zwyklego uzytkownika', () => {
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

    render(<RequireAdmin />)

    expect(screen.getByTestId('navigate').getAttribute('data-to')).toBe('/')
    expect(screen.queryByTestId('outlet')).toBeNull()
  })

  it('wpuszcza administratora do outletu', () => {
    mockedUseAuth.mockReturnValue({
      status: 'authenticated',
      user: {
        id: 'admin-1',
        email: 'admin@test.local',
        isAdmin: true,
        isActive: true,
      },
      logIn: vi.fn(),
      logOut: vi.fn(),
    })

    render(<RequireAdmin />)

    expect(screen.getByTestId('outlet')).toBeDefined()
    expect(screen.queryByTestId('navigate')).toBeNull()
  })
})
