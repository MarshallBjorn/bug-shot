import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import AdminUsersPage from './AdminUsersPage'
import {
  activateUser,
  deactivateUser,
  deleteUser,
  getUsers,
  inviteUser,
  resendInvitation,
  sendPasswordReset,
  setUserAdmin,
  setUserProjects,
} from '../api/users'
import type { UserAccount } from '../types'

vi.mock('../api/users', () => ({
  activateUser: vi.fn(),
  deactivateUser: vi.fn(),
  deleteUser: vi.fn(),
  getUsers: vi.fn(),
  inviteUser: vi.fn(),
  resendInvitation: vi.fn(),
  sendPasswordReset: vi.fn(),
  setUserAdmin: vi.fn(),
  setUserProjects: vi.fn(),
}))

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({
    status: 'authenticated',
    user: { id: 'me', email: 'admin@acme.example', isAdmin: true, isActive: true },
    logIn: vi.fn(),
    logOut: vi.fn(),
  }),
}))

vi.mock('../projects/ProjectsContext', () => ({
  useProjects: () => ({
    projects: [
      { id: 'p1', name: 'Sklep', key: 'shop', createdAt: '2026-09-01', origins: [], role: 'Maintainer' },
      { id: 'p2', name: 'Blog', key: 'blog', createdAt: '2026-09-01', origins: [], role: 'Maintainer' },
    ],
    loading: false,
    reload: vi.fn(),
  }),
}))

vi.mock('../format', () => ({
  formatDateTime: (value: string) => value,
}))

const me: UserAccount = {
  id: 'me',
  email: 'admin@acme.example',
  isAdmin: true,
  state: 'Active',
  createdAt: '2026-09-01T10:00:00Z',
  projects: [],
}

const developer: UserAccount = {
  id: 'dev',
  email: 'dev@acme.example',
  isAdmin: false,
  state: 'Active',
  createdAt: '2026-09-02T10:00:00Z',
  projects: [{ projectId: 'p1', projectName: 'Sklep', role: 'Member' }],
}

const invited: UserAccount = {
  id: 'inv',
  email: 'nowa@acme.example',
  isAdmin: false,
  state: 'Invited',
  createdAt: '2026-09-03T10:00:00Z',
  projects: [],
}

const disabled: UserAccount = {
  id: 'off',
  email: 'byly@acme.example',
  isAdmin: false,
  state: 'Disabled',
  createdAt: '2026-09-04T10:00:00Z',
  projects: [],
}

// jsdom nie ma API wskaznika ani przewijania z ktorych korzysta lista Radixa
// a checkbox Radixa mierzy sie przez ResizeObserver
beforeAll(() => {
  Element.prototype.hasPointerCapture ??= () => false
  Element.prototype.scrollIntoView ??= () => {}
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
})

afterAll(() => {
  vi.unstubAllGlobals()
})

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getUsers).mockResolvedValue([me, developer, invited, disabled])
})

afterEach(() => {
  cleanup()
})

function openActions(email: string) {
  fireEvent.pointerDown(screen.getByRole('button', { name: `Akcje konta ${email}` }), { button: 0, ctrlKey: false })
}

function addProject(name: string) {
  fireEvent.click(screen.getByRole('button', { name: 'Dodaj projekt Wybierz projekt...' }))
  fireEvent.click(screen.getByRole('option', { name }))
}

function pickRole(project: string, role: string) {
  fireEvent.keyDown(screen.getByRole('combobox', { name: `Rola w ${project}` }), { key: 'Enter' })
  fireEvent.keyDown(screen.getByRole('option', { name: role }), { key: 'Enter' })
}

describe('AdminUsersPage', () => {
  it('pokazuje konta ze stanem i dostepem', async () => {
    render(<AdminUsersPage />)

    const row = (await screen.findByText('dev@acme.example')).closest('tr')!

    expect(within(row).getByText('Aktywne')).toBeDefined()
    expect(within(row).getByText('Sklep')).toBeDefined()
    expect(within(row).getByText(/Obsługa zgłoszeń/)).toBeDefined()
    expect(screen.getByText('Administrator, wszystkie projekty')).toBeDefined()
    expect(screen.getByText('Zaproszone')).toBeDefined()
    expect(screen.getByText('(Ty)')).toBeDefined()
  })

  it('pokazuje blad pobierania', async () => {
    vi.mocked(getUsers).mockRejectedValue(new Error('Serwer padł'))

    render(<AdminUsersPage />)

    expect((await screen.findByRole('alert')).textContent).toContain('Serwer padł')
  })

  it('zaprasza osobe z rola w projekcie i potwierdza wysylke', async () => {
    vi.mocked(inviteUser).mockResolvedValue({
      user: { ...invited, id: 'new', email: 'qa@acme.example' },
      emailSent: true,
      link: null,
    })

    render(<AdminUsersPage />)
    await screen.findByText('dev@acme.example')

    fireEvent.click(screen.getByRole('button', { name: 'Zaproś osobę' }))
    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: ' qa@acme.example ' } })
    addProject('Blog')

    // nowy dostep startuje od najmniejszej roli
    expect(screen.getByRole('combobox', { name: 'Rola w Blog' }).textContent).toContain('Tylko odczyt')
    fireEvent.click(screen.getByRole('button', { name: 'Wyślij zaproszenie' }))

    await vi.waitFor(() => {
      expect(inviteUser).toHaveBeenCalledWith('qa@acme.example', false, [{ projectId: 'p2', role: 'Viewer' }])
    })

    expect((await screen.findByRole('status')).textContent).toContain('Zaproszenie wysłano na qa@acme.example')
    expect(within(screen.getByRole('table', { name: 'Konta panelu' })).getByText('qa@acme.example')).toBeDefined()
  })

  it('gdy mail nie wyszedl pokazuje link do skopiowania', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })

    vi.mocked(inviteUser).mockResolvedValue({
      user: { ...invited, id: 'new', email: 'qa@acme.example' },
      emailSent: false,
      link: 'http://localhost:5173/set-password#abc',
    })

    render(<AdminUsersPage />)
    await screen.findByText('dev@acme.example')

    fireEvent.click(screen.getByRole('button', { name: 'Zaproś osobę' }))
    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'qa@acme.example' } })
    fireEvent.click(screen.getByRole('button', { name: 'Wyślij zaproszenie' }))

    const field = (await screen.findByLabelText('Link do przekazania')) as HTMLInputElement

    expect(field.value).toBe('http://localhost:5173/set-password#abc')

    fireEvent.click(screen.getByRole('button', { name: 'Kopiuj' }))

    await vi.waitFor(() => expect(writeText).toHaveBeenCalledWith('http://localhost:5173/set-password#abc'))
    expect(await screen.findByRole('button', { name: 'Skopiowano' })).toBeDefined()

    fireEvent.click(screen.getByRole('button', { name: 'Zamknij komunikat' }))
    expect(screen.queryByLabelText('Link do przekazania')).toBeNull()
  })

  it('blad zaproszenia zostaje w dialogu', async () => {
    vi.mocked(inviteUser).mockRejectedValue(new Error('A user with this email already exists.'))

    render(<AdminUsersPage />)
    await screen.findByText('dev@acme.example')

    fireEvent.click(screen.getByRole('button', { name: 'Zaproś osobę' }))
    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'dev@acme.example' } })
    fireEvent.click(screen.getByRole('button', { name: 'Wyślij zaproszenie' }))

    expect((await screen.findByRole('alert')).textContent).toContain('already exists')
    expect(screen.getByRole('button', { name: 'Wyślij zaproszenie' })).toBeDefined()
  })

  it('zmiana dostepu wysyla tylko to co sie zmienilo', async () => {
    vi.mocked(setUserProjects).mockResolvedValue({
      ...developer,
      projects: [{ projectId: 'p1', projectName: 'Sklep', role: 'Maintainer' }],
    })

    render(<AdminUsersPage />)
    await screen.findByText('dev@acme.example')

    openActions('dev@acme.example')
    fireEvent.click(screen.getByRole('menuitem', { name: 'Zmień dostęp' }))
    pickRole('Sklep', 'Zarządzanie projektem')
    fireEvent.click(screen.getByRole('button', { name: 'Zapisz' }))

    await vi.waitFor(() => {
      expect(setUserProjects).toHaveBeenCalledWith('dev', [{ projectId: 'p1', role: 'Maintainer' }])
    })

    expect(setUserAdmin).not.toHaveBeenCalled()
    expect(await screen.findByText(/Zarządzanie projektem/)).toBeDefined()
  })

  it('nadanie administratora i odebranie projektu', async () => {
    vi.mocked(setUserAdmin).mockResolvedValue({ ...developer, isAdmin: true })
    vi.mocked(setUserProjects).mockResolvedValue({ ...developer, isAdmin: true, projects: [] })

    render(<AdminUsersPage />)
    await screen.findByText('dev@acme.example')

    openActions('dev@acme.example')
    fireEvent.click(screen.getByRole('menuitem', { name: 'Zmień dostęp' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Administrator' }))
    fireEvent.click(screen.getByRole('button', { name: 'Odbierz dostęp do Sklep' }))

    expect(screen.getByText(/Brak dostępu do projektów/)).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'Zapisz' }))

    await vi.waitFor(() => expect(setUserProjects).toHaveBeenCalledWith('dev', []))
    expect(setUserAdmin).toHaveBeenCalledWith('dev', true)
  })

  it('wlasnej roli administratora nie da sie odznaczyc', async () => {
    render(<AdminUsersPage />)
    await screen.findByText('dev@acme.example')

    openActions('admin@acme.example')
    fireEvent.click(screen.getByRole('menuitem', { name: 'Zmień dostęp' }))

    expect((screen.getByRole('checkbox', { name: 'Administrator' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText('Własnej roli administratora nie możesz zmienić.')).toBeDefined()

    fireEvent.click(screen.getByRole('button', { name: 'Anuluj' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('na wlasnym koncie nie ma wylaczenia', async () => {
    render(<AdminUsersPage />)
    await screen.findByText('dev@acme.example')

    openActions('admin@acme.example')

    expect(screen.queryByRole('menuitem', { name: 'Wyłącz konto' })).toBeNull()
    expect(screen.getByRole('menuitem', { name: 'Wyślij link do zmiany hasła' })).toBeDefined()
  })

  it('wylacza konto po potwierdzeniu', async () => {
    vi.mocked(deactivateUser).mockResolvedValue(undefined)

    render(<AdminUsersPage />)
    const row = (await screen.findByText('dev@acme.example')).closest('tr')!

    openActions('dev@acme.example')
    fireEvent.click(screen.getByRole('menuitem', { name: 'Wyłącz konto' }))
    fireEvent.click(screen.getByRole('button', { name: 'Wyłącz konto' }))

    await vi.waitFor(() => expect(deactivateUser).toHaveBeenCalledWith('dev'))
    expect(await within(row).findByText('Wyłączone')).toBeDefined()
  })

  it('wlacza wylaczone konto', async () => {
    vi.mocked(activateUser).mockResolvedValue(undefined)

    render(<AdminUsersPage />)
    const row = (await screen.findByText('byly@acme.example')).closest('tr')!

    openActions('byly@acme.example')
    fireEvent.click(screen.getByRole('menuitem', { name: 'Włącz konto' }))

    await vi.waitFor(() => expect(activateUser).toHaveBeenCalledWith('off'))
    expect(await within(row).findByText('Aktywne')).toBeDefined()
  })

  it('cofa zaproszenie po potwierdzeniu', async () => {
    vi.mocked(deleteUser).mockResolvedValue(undefined)

    render(<AdminUsersPage />)
    await screen.findByText('nowa@acme.example')

    openActions('nowa@acme.example')
    fireEvent.click(screen.getByRole('menuitem', { name: 'Cofnij zaproszenie' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cofnij zaproszenie' }))

    await vi.waitFor(() => expect(deleteUser).toHaveBeenCalledWith('inv'))
    await vi.waitFor(() => expect(screen.queryByText('nowa@acme.example')).toBeNull())
  })

  it('cofniecie zaproszenia chowa komunikat o nim', async () => {
    vi.mocked(resendInvitation).mockResolvedValue({ emailSent: true, link: null })
    vi.mocked(deleteUser).mockResolvedValue(undefined)

    render(<AdminUsersPage />)
    await screen.findByText('nowa@acme.example')

    openActions('nowa@acme.example')
    fireEvent.click(screen.getByRole('menuitem', { name: 'Wyślij zaproszenie ponownie' }))
    expect(await screen.findByRole('status')).toBeDefined()

    openActions('nowa@acme.example')
    fireEvent.click(screen.getByRole('menuitem', { name: 'Cofnij zaproszenie' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cofnij zaproszenie' }))

    await vi.waitFor(() => expect(screen.queryByRole('status')).toBeNull())
  })

  it('wysyla zaproszenie ponownie', async () => {
    vi.mocked(resendInvitation).mockResolvedValue({ emailSent: true, link: null })

    render(<AdminUsersPage />)
    await screen.findByText('nowa@acme.example')

    openActions('nowa@acme.example')
    fireEvent.click(screen.getByRole('menuitem', { name: 'Wyślij zaproszenie ponownie' }))

    expect((await screen.findByRole('status')).textContent).toContain('Zaproszenie wysłano na nowa@acme.example')
  })

  it('wysyla link do zmiany hasla i pokazuje blad akcji', async () => {
    vi.mocked(sendPasswordReset).mockResolvedValueOnce({ emailSent: true, link: null })
    vi.mocked(sendPasswordReset).mockRejectedValueOnce(new Error('Only an active account with a password can reset it.'))

    render(<AdminUsersPage />)
    await screen.findByText('dev@acme.example')

    openActions('dev@acme.example')
    fireEvent.click(screen.getByRole('menuitem', { name: 'Wyślij link do zmiany hasła' }))

    expect((await screen.findByRole('status')).textContent).toContain('Link do zmiany hasła wysłano')

    openActions('dev@acme.example')
    fireEvent.click(screen.getByRole('menuitem', { name: 'Wyślij link do zmiany hasła' }))

    expect((await screen.findByRole('alert')).textContent).toContain('Only an active account')
  })

  it('dodaje wszystkie pozostale projekty z wybrana rola', async () => {
    vi.mocked(inviteUser).mockResolvedValue({ user: { ...invited, id: 'new' }, emailSent: true, link: null })

    render(<AdminUsersPage />)
    await screen.findByText('dev@acme.example')

    fireEvent.click(screen.getByRole('button', { name: 'Zaproś osobę' }))
    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'qa@acme.example' } })

    expect(screen.getByText('0 z 2')).toBeDefined()

    fireEvent.keyDown(screen.getByRole('combobox', { name: 'z rolą' }), { key: 'Enter' })
    fireEvent.keyDown(screen.getByRole('option', { name: 'Obsługa zgłoszeń' }), { key: 'Enter' })
    fireEvent.click(screen.getByRole('button', { name: /Dodaj wszystkie pozostałe \(2\)/ }))

    expect(screen.getByText('2 z 2')).toBeDefined()
    // wszystkie dodane wiec wyszukiwarka znika
    expect(screen.queryByRole('button', { name: 'Dodaj projekt Wybierz projekt...' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Wyślij zaproszenie' }))

    await vi.waitFor(() =>
      expect(inviteUser).toHaveBeenCalledWith('qa@acme.example', false, [
        { projectId: 'p1', role: 'Member' },
        { projectId: 'p2', role: 'Member' },
      ]),
    )
  })
})
