import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  acceptAccountLink,
  accessToken,
  completeSetup,
  inspectAccountLink,
  renewSession,
  setupRequired,
} from './session'

const session = {
  accessToken: 'token-z-linku',
  expiresAt: '2026-09-23T18:00:00+00:00',
  user: { id: 'u2', email: 'nowa@bug-shot.test', isAdmin: false, isActive: true },
}

function respond(status: number, body?: unknown) {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function fetchMock() {
  const mock = vi.fn()
  vi.stubGlobal('fetch', mock)
  return mock
}

beforeEach(async () => {
  fetchMock().mockResolvedValue(respond(401))
  await renewSession()
  vi.unstubAllGlobals()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('kreator pierwszego konta', () => {
  it('czyta czy instancja czeka na pierwsze konto', async () => {
    fetchMock().mockResolvedValue(respond(200, { required: true }))

    await expect(setupRequired()).resolves.toBe(true)
  })

  it('bez odpowiedzi API zostaje zwykle logowanie', async () => {
    fetchMock().mockRejectedValue(new TypeError('Failed to fetch'))

    await expect(setupRequired()).resolves.toBe(false)
  })

  it('zalozenie konta otwiera sesje', async () => {
    const fetched = fetchMock().mockResolvedValue(respond(200, session))

    await completeSetup('token', 'admin@bug-shot.test', 'dlugie-haslo-admina')

    expect(accessToken()).toBe('token-z-linku')
    expect(fetched.mock.calls[0][0]).toContain('/api/v1/auth/setup')
    expect(fetched.mock.calls[0][1]).toMatchObject({ credentials: 'include' })
  })

  it('odmowa niesie status i tytul z ProblemDetails', async () => {
    fetchMock().mockResolvedValue(respond(403, { title: 'Setup token is not valid.' }))

    await expect(completeSetup('zly', 'a@b.test', 'dlugie-haslo-admina')).rejects.toMatchObject({
      status: 403,
      message: 'Setup token is not valid.',
    })
  })
})

describe('link z maila', () => {
  it('sprawdza link przed pokazaniem formularza', async () => {
    fetchMock().mockResolvedValue(respond(200, { email: 'nowa@bug-shot.test', purpose: 'Invitation' }))

    await expect(inspectAccountLink('abc')).resolves.toEqual({
      email: 'nowa@bug-shot.test',
      purpose: 'Invitation',
    })
  })

  it('nieznany zuzyty albo wygasly link daje null', async () => {
    fetchMock().mockResolvedValue(respond(404, { title: 'This link is not valid anymore.' }))

    await expect(inspectAccountLink('abc')).resolves.toBeNull()
  })

  it('inny blad sprawdzenia leci dalej', async () => {
    fetchMock().mockResolvedValue(respond(500))

    await expect(inspectAccountLink('abc')).rejects.toMatchObject({ status: 500 })
  })

  it('ustawienie hasla otwiera sesje', async () => {
    fetchMock().mockResolvedValue(respond(200, session))

    await acceptAccountLink('abc', 'dlugie-nowe-haslo')

    expect(accessToken()).toBe('token-z-linku')
  })

  it('blad walidacji hasla wraca tekstem pola', async () => {
    fetchMock().mockResolvedValue(
      respond(400, { title: 'One or more validation errors occurred.', errors: { Password: ['Too short.'] } }),
    )

    await expect(acceptAccountLink('abc', 'krotkie')).rejects.toMatchObject({ message: 'Too short.' })
  })
})
