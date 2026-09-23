import { describe, expect, it, vi } from 'vitest'
import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from './client'
import {
  activateUser,
  changeOwnPassword,
  deactivateUser,
  deleteUser,
  getUsers,
  inviteUser,
  resendInvitation,
  sendPasswordReset,
  setUserAdmin,
  setUserProjects,
} from './users'

vi.mock('./client', () => ({
  apiDelete: vi.fn(),
  apiGet: vi.fn(),
  apiPatch: vi.fn(),
  apiPost: vi.fn(),
  apiPut: vi.fn(),
}))

describe('users api', () => {
  it('pobiera konta', async () => {
    vi.mocked(apiGet).mockResolvedValue([])

    await getUsers()

    expect(apiGet).toHaveBeenCalledWith('/api/v1/users', undefined)
  })

  it('zaprasza bez hasla z lista projektow', async () => {
    await inviteUser('nowa@acme.example', false, [{ projectId: 'p1', role: 'Viewer' }])

    expect(apiPost).toHaveBeenCalledWith('/api/v1/users', {
      email: 'nowa@acme.example',
      isAdmin: false,
      projects: [{ projectId: 'p1', role: 'Viewer' }],
    })
  })

  it('zmienia role administratora i projekty osobnymi zadaniami', async () => {
    await setUserAdmin('u1', true)
    await setUserProjects('u1', [{ projectId: 'p1', role: 'Member' }])

    expect(apiPatch).toHaveBeenCalledWith('/api/v1/users/u1', { isAdmin: true })
    expect(apiPut).toHaveBeenCalledWith('/api/v1/users/u1/projects', [{ projectId: 'p1', role: 'Member' }])
  })

  it('wlacza wylacza i usuwa konto', async () => {
    await deactivateUser('u1')
    await activateUser('u1')
    await deleteUser('u1')

    expect(apiPatch).toHaveBeenCalledWith('/api/v1/users/u1/deactivate', undefined)
    expect(apiPatch).toHaveBeenCalledWith('/api/v1/users/u1/activate', undefined)
    expect(apiDelete).toHaveBeenCalledWith('/api/v1/users/u1')
  })

  it('wysyla zaproszenie ponownie i link do zmiany hasla', async () => {
    await resendInvitation('u1')
    await sendPasswordReset('u1')

    expect(apiPost).toHaveBeenCalledWith('/api/v1/users/u1/invitation', undefined)
    expect(apiPost).toHaveBeenCalledWith('/api/v1/users/u1/reset-password', undefined)
  })

  it('zmienia wlasne haslo', async () => {
    await changeOwnPassword('stare-haslo', 'nowe-dlugie-haslo')

    expect(apiPost).toHaveBeenCalledWith('/api/v1/auth/password', {
      currentPassword: 'stare-haslo',
      newPassword: 'nowe-dlugie-haslo',
    })
  })
})
