import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import LoginPage from './LoginPage'
import { ThemeProvider } from '../theme/ThemeProvider'
import { useAuth } from '../auth/AuthContext'
import { setupRequired } from '../auth/session'

const navigateStates = vi.hoisted(() => ({
  state: null as unknown,
  navigate: vi.fn(),
}))

vi.mock('../auth/session', () => ({
  setupRequired: vi.fn(),
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
  useNavigate: () => navigateStates.navigate,
}))

const mockedUseAuth = vi.mocked(useAuth)

function renderLogin() {
  return render(
    <ThemeProvider>
      <LoginPage />
    </ThemeProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  navigateStates.state = null
  vi.mocked(setupRequired).mockResolvedValue(false)
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

    renderLogin()

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

    renderLogin()

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

    renderLogin()

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

    renderLogin()

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

  it('pozwala zmienic motyw przed zalogowaniem', () => {
    mockedUseAuth.mockReturnValue({
      status: 'anonymous',
      user: null,
      logIn: vi.fn(),
      logOut: vi.fn(),
    })

    renderLogin()

    expect(screen.getByRole('button', { name: /^Motyw:/ })).toBeDefined()
  })

  it('instancja bez kont prowadzi do kreatora', async () => {
    vi.mocked(setupRequired).mockResolvedValue(true)

    mockedUseAuth.mockReturnValue({
      status: 'anonymous',
      user: null,
      logIn: vi.fn(),
      logOut: vi.fn(),
    })

    renderLogin()

    await vi.waitFor(() => {
      expect(navigateStates.navigate).toHaveBeenCalledWith('/setup', { replace: true })
    })
  })

  it('instancja z kontem zostaje przy logowaniu', async () => {
    mockedUseAuth.mockReturnValue({
      status: 'anonymous',
      user: null,
      logIn: vi.fn(),
      logOut: vi.fn(),
    })

    renderLogin()

    await vi.waitFor(() => {
      expect(setupRequired).toHaveBeenCalled()
    })

    expect(navigateStates.navigate).not.toHaveBeenCalled()
  })
})
