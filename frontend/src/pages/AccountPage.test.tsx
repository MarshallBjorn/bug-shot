import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AccountPage from './AccountPage'
import { changeOwnPassword } from '../api/users'

vi.mock('../api/users', () => ({
  changeOwnPassword: vi.fn(),
}))

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({
    status: 'authenticated',
    user: { id: 'u1', email: 'dev@acme.example', isAdmin: false, isActive: true },
    logIn: vi.fn(),
    logOut: vi.fn(),
  }),
}))

function submit(current: string, password: string, repeated = password) {
  fireEvent.change(screen.getByLabelText('Obecne hasło'), { target: { value: current } })
  fireEvent.change(screen.getByLabelText('Nowe hasło'), { target: { value: password } })
  fireEvent.change(screen.getByLabelText('Powtórz hasło'), { target: { value: repeated } })
  fireEvent.click(screen.getByRole('button', { name: 'Zmień hasło' }))
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  cleanup()
})

describe('AccountPage', () => {
  it('zmienia haslo i czysci formularz', async () => {
    vi.mocked(changeOwnPassword).mockResolvedValue(undefined)

    render(<AccountPage />)

    expect(screen.getByText('dev@acme.example')).toBeDefined()

    submit('stare-haslo', 'zupelnie-nowe-haslo')

    await vi.waitFor(() => expect(changeOwnPassword).toHaveBeenCalledWith('stare-haslo', 'zupelnie-nowe-haslo'))
    expect((await screen.findByRole('status')).textContent).toContain('Pozostałe sesje')
    expect((screen.getByLabelText('Obecne hasło') as HTMLInputElement).value).toBe('')
  })

  it('zle obecne haslo pokazuje blad z API', async () => {
    vi.mocked(changeOwnPassword).mockRejectedValue(new Error('Current password is not valid.'))

    render(<AccountPage />)
    submit('zle-haslo', 'zupelnie-nowe-haslo')

    expect((await screen.findByRole('alert')).textContent).toContain('Current password is not valid.')
  })

  it('niezgodne powtorzenie nie idzie do API', async () => {
    render(<AccountPage />)
    submit('stare-haslo', 'zupelnie-nowe-haslo', 'inne-nowe-haslo')

    expect((await screen.findByRole('alert')).textContent).toContain('nie zgadza')
    expect(changeOwnPassword).not.toHaveBeenCalled()
  })
})
