import React from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import SetupPage from './SetupPage'
import { ApiError } from '../api/error'
import { useAuth } from '../auth/AuthContext'
import { completeSetup, setupRequired } from '../auth/session'
import { ThemeProvider } from '../theme/ThemeProvider'

const navigate = vi.hoisted(() => vi.fn())

vi.mock('../auth/AuthContext', () => ({
  useAuth: vi.fn(),
}))

vi.mock('../auth/session', () => ({
  completeSetup: vi.fn(),
  setupRequired: vi.fn(),
}))

vi.mock('react-router', () => ({
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => <a href={to}>{children}</a>,
  Navigate: ({ to }: { to: string }) => <div data-testid="navigate" data-to={to} />,
  useNavigate: () => navigate,
}))

function renderPage() {
  return render(
    <ThemeProvider>
      <SetupPage />
    </ThemeProvider>,
  )
}

async function fillForm() {
  fireEvent.change(await screen.findByLabelText('Token z logu API'), { target: { value: ' token-z-logu ' } })
  fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'admin@acme.example' } })
  fireEvent.change(screen.getByLabelText('Nowe hasło'), { target: { value: 'dlugie-haslo-admina' } })
  fireEvent.change(screen.getByLabelText('Powtórz hasło'), { target: { value: 'dlugie-haslo-admina' } })
  fireEvent.click(screen.getByRole('button', { name: 'Załóż konto' }))
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(useAuth).mockReturnValue({ status: 'anonymous', user: null, logIn: vi.fn(), logOut: vi.fn() })
  vi.mocked(setupRequired).mockResolvedValue(true)
})

afterEach(() => {
  cleanup()
})

describe('SetupPage', () => {
  it('zaklada pierwsze konto i wpuszcza do panelu', async () => {
    vi.mocked(completeSetup).mockResolvedValue({} as never)

    renderPage()
    await fillForm()

    await vi.waitFor(() =>
      expect(completeSetup).toHaveBeenCalledWith('token-z-logu', 'admin@acme.example', 'dlugie-haslo-admina'),
    )
    expect(navigate).toHaveBeenCalledWith('/', { replace: true })
  })

  it('zly token tlumaczy skad wziac dobry', async () => {
    vi.mocked(completeSetup).mockRejectedValue(new ApiError(403, 'Setup token is not valid.'))

    renderPage()
    await fillForm()

    expect((await screen.findByRole('alert')).textContent).toContain('Skopiuj go jeszcze raz z logu API')
  })

  it('istniejace konto odsyla do logowania', async () => {
    vi.mocked(completeSetup).mockRejectedValue(new ApiError(409, 'Setup is already done.'))

    renderPage()
    await fillForm()

    expect((await screen.findByRole('alert')).textContent).toContain('Pierwsze konto już istnieje')
  })

  it('inny blad pokazuje komunikat API', async () => {
    vi.mocked(completeSetup).mockRejectedValue(new Error('Password must be at least 12 characters long.'))

    renderPage()
    await fillForm()

    expect((await screen.findByRole('alert')).textContent).toContain('at least 12')
  })

  it('za krotkie haslo nie idzie do API', async () => {
    renderPage()

    fireEvent.change(await screen.findByLabelText('Token z logu API'), { target: { value: 'token' } })
    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'admin@acme.example' } })
    fireEvent.change(screen.getByLabelText('Nowe hasło'), { target: { value: 'krotkie' } })
    fireEvent.change(screen.getByLabelText('Powtórz hasło'), { target: { value: 'krotkie' } })
    fireEvent.submit(screen.getByRole('button', { name: 'Załóż konto' }).closest('form')!)

    expect((await screen.findByRole('alert')).textContent).toContain('co najmniej 12')
    expect(completeSetup).not.toHaveBeenCalled()
  })

  it('skonfigurowana instancja odsyla do logowania', async () => {
    vi.mocked(setupRequired).mockResolvedValue(false)

    renderPage()

    expect(await screen.findByRole('heading', { name: 'Instancja jest już skonfigurowana' })).toBeDefined()
    expect(screen.getByRole('link', { name: 'Przejdź do logowania' }).getAttribute('href')).toBe('/login')
  })

  it('zalogowany wraca do panelu', () => {
    vi.mocked(useAuth).mockReturnValue({
      status: 'authenticated',
      user: { id: 'u1', email: 'a@b.test', isAdmin: true, isActive: true },
      logIn: vi.fn(),
      logOut: vi.fn(),
    })

    renderPage()

    expect(screen.getByTestId('navigate').getAttribute('data-to')).toBe('/')
  })
})
