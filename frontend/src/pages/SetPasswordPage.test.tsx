import React from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import SetPasswordPage from './SetPasswordPage'
import { acceptAccountLink, inspectAccountLink } from '../auth/session'
import { ThemeProvider } from '../theme/ThemeProvider'

const router = vi.hoisted(() => ({ hash: '#token-z-maila', navigate: vi.fn() }))

vi.mock('../auth/session', () => ({
  acceptAccountLink: vi.fn(),
  inspectAccountLink: vi.fn(),
}))

vi.mock('react-router', () => ({
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => <a href={to}>{children}</a>,
  useLocation: () => ({ hash: router.hash }),
  useNavigate: () => router.navigate,
}))

function renderPage() {
  return render(
    <ThemeProvider>
      <SetPasswordPage />
    </ThemeProvider>,
  )
}

function fill(password: string, repeated = password) {
  fireEvent.change(screen.getByLabelText('Nowe hasło'), { target: { value: password } })
  fireEvent.change(screen.getByLabelText('Powtórz hasło'), { target: { value: repeated } })
}

beforeEach(() => {
  vi.clearAllMocks()
  router.hash = '#token-z-maila'
  window.history.replaceState(null, '', '/set-password#token-z-maila')
  vi.mocked(inspectAccountLink).mockResolvedValue({ email: 'nowa@acme.example', purpose: 'Invitation' })
})

afterEach(() => {
  cleanup()
})

describe('SetPasswordPage', () => {
  it('zaproszenie ustawia haslo i wpuszcza do panelu', async () => {
    vi.mocked(acceptAccountLink).mockResolvedValue({} as never)

    renderPage()

    expect(await screen.findByRole('heading', { name: 'Witaj w Bug-shot' })).toBeDefined()
    expect(screen.getByText('nowa@acme.example')).toBeDefined()
    expect(inspectAccountLink).toHaveBeenCalledWith('token-z-maila')

    fill('wlasne-dlugie-haslo')
    fireEvent.click(screen.getByRole('button', { name: 'Ustaw hasło i wejdź' }))

    await vi.waitFor(() => expect(acceptAccountLink).toHaveBeenCalledWith('token-z-maila', 'wlasne-dlugie-haslo'))
    expect(router.navigate).toHaveBeenCalledWith('/', { replace: true })
  })

  it('token znika z paska adresu', async () => {
    renderPage()

    await screen.findByRole('heading', { name: 'Witaj w Bug-shot' })

    expect(window.location.hash).toBe('')
  })

  it('reset hasla ma wlasny tytul', async () => {
    vi.mocked(inspectAccountLink).mockResolvedValue({ email: 'dev@acme.example', purpose: 'PasswordReset' })

    renderPage()

    expect(await screen.findByRole('heading', { name: 'Ustaw nowe hasło' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Zmień hasło' })).toBeDefined()
  })

  it('niezgodne hasla nie ida do API', async () => {
    renderPage()
    await screen.findByRole('heading', { name: 'Witaj w Bug-shot' })

    fill('wlasne-dlugie-haslo', 'inne-dlugie-haslo')
    fireEvent.click(screen.getByRole('button', { name: 'Ustaw hasło i wejdź' }))

    expect((await screen.findByRole('alert')).textContent).toContain('nie zgadza')
    expect(acceptAccountLink).not.toHaveBeenCalled()
  })

  it('odmowa API zostaje na formularzu', async () => {
    vi.mocked(acceptAccountLink).mockRejectedValue(new Error('This link is not valid anymore.'))

    renderPage()
    await screen.findByRole('heading', { name: 'Witaj w Bug-shot' })

    fill('wlasne-dlugie-haslo')
    fireEvent.click(screen.getByRole('button', { name: 'Ustaw hasło i wejdź' }))

    expect((await screen.findByRole('alert')).textContent).toContain('not valid')
    expect(router.navigate).not.toHaveBeenCalled()
  })

  it('zuzyty albo wygasly link odsyla do logowania', async () => {
    vi.mocked(inspectAccountLink).mockResolvedValue(null)

    renderPage()

    expect(await screen.findByRole('heading', { name: 'Link nie działa' })).toBeDefined()
    expect(screen.getByRole('link', { name: 'Przejdź do logowania' }).getAttribute('href')).toBe('/login')
  })

  it('adres bez tokena nie pyta API', async () => {
    router.hash = ''

    renderPage()

    expect(await screen.findByRole('heading', { name: 'Link nie działa' })).toBeDefined()
    expect(inspectAccountLink).not.toHaveBeenCalled()
  })

  it('blad sprawdzenia pokazuje powod', async () => {
    vi.mocked(inspectAccountLink).mockRejectedValue(new Error('Kod odpowiedzi 500'))

    renderPage()

    expect(await screen.findByText(/Nie udało się sprawdzić linku. Kod odpowiedzi 500/)).toBeDefined()
  })
})
