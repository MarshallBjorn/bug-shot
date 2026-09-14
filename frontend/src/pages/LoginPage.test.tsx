import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import LoginPage from './LoginPage'
import { useAuth } from '../auth/AuthContext'

const navigateStates = vi.hoisted(() => ({
  state: null as unknown,
}))

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
  useLocation: () => ({
    state: navigateStates.state,
  }),
}))

const mockedUseAuth = vi.mocked(useAuth)

beforeEach(() => {
  vi.clearAllMocks()
  navigateStates.state = null
})

afterEach(() => {
  cleanup()
})

describe('LoginPage', () => {
  it('pokazuje sprawdzanie sesji', () => {
    mockedUseAuth.mockReturnValue({
      status: 'checking',
      user: null,
      logIn: vi.fn(),
      logOut: vi.fn(),
    })

    render(<LoginPage />)

    expect(screen.getByText('Sprawdzanie sesji...')).toBeDefined()
  })

  it('przekierowuje zalogowanego uzytkownika na zapamietana trase', () => {
    navigateStates.state = { from: '/projects/p1/tickets?page=2' }

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

    render(<LoginPage />)

    expect(screen.getByTestId('navigate').getAttribute('data-to')).toBe(
      '/projects/p1/tickets?page=2',
    )
  })

  it('loguje uzytkownika', async () => {
    const logIn = vi.fn().mockResolvedValue(undefined)

    mockedUseAuth.mockReturnValue({
      status: 'anonymous',
      user: null,
      logIn,
      logOut: vi.fn(),
    })

    render(<LoginPage />)

    fireEvent.change(screen.getByLabelText('E-mail'), {
      target: { value: 'user@test.local' },
    })

    fireEvent.change(screen.getByLabelText('Hasło'), {
      target: { value: 'secret' },
    })

    fireEvent.submit(
      screen.getByRole('button', { name: 'Zaloguj' }).closest('form')!,
    )

    await vi.waitFor(() => {
      expect(logIn).toHaveBeenCalledWith(
        'user@test.local',
        'secret',
      )
    })
  })

  it('pokazuje blad logowania', async () => {
    const logIn = vi.fn().mockRejectedValue(
      new Error('Nieprawidlowe dane logowania'),
    )

    mockedUseAuth.mockReturnValue({
      status: 'anonymous',
      user: null,
      logIn,
      logOut: vi.fn(),
    })

    render(<LoginPage />)

    fireEvent.change(screen.getByLabelText('E-mail'), {
      target: { value: 'user@test.local' },
    })

    fireEvent.change(screen.getByLabelText('Hasło'), {
      target: { value: 'bad' },
    })

    fireEvent.submit(
      screen.getByRole('button', { name: 'Zaloguj' }).closest('form')!,
    )

    await vi.waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain(
        'Nieprawidlowe dane logowania',
      )
    })
  })
})
