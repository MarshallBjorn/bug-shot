import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../api/error'
import { accessToken, renewSession, signIn, signOut, watchSession } from './session'

const session = {
  accessToken: 'token-1',
  expiresAt: '2026-09-08T18:00:00+00:00',
  user: { id: 'u1', email: 'admin@bug-shot.test', isAdmin: true, isActive: true },
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
  // sesja jest stanem modulu wiec kazdy test musi zaczac od pustej
  fetchMock().mockResolvedValue(respond(401))
  await renewSession()
  vi.unstubAllGlobals()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('logowanie', () => {
  it('zapamietuje token po udanym logowaniu', async () => {
    fetchMock().mockResolvedValue(respond(200, session))

    await signIn('admin@bug-shot.test', 'haslo')

    expect(accessToken()).toBe('token-1')
  })

  it('dosyla ciasteczka bo token odswiezajacy siedzi w cookie', async () => {
    const fetched = fetchMock().mockResolvedValue(respond(200, session))

    await signIn('admin@bug-shot.test', 'haslo')

    const [url, init] = fetched.mock.calls[0]
    expect(url).toContain('/api/v1/auth/login')
    expect(init.credentials).toBe('include')
  })

  it('zle dane koncza sie bledem 401 i brakiem tokena', async () => {
    fetchMock().mockResolvedValue(respond(401, { title: 'Invalid email or password.' }))

    const failure = await signIn('admin@bug-shot.test', 'zle').catch((cause: ApiError) => cause)

    expect(failure).toBeInstanceOf(ApiError)
    expect((failure as ApiError).status).toBe(401)
    expect(accessToken()).toBeNull()
  })
})

describe('odnawianie sesji', () => {
  it('rownolegle wywolania ida jednym zadaniem bo token rotuje przy kazdym uzyciu', async () => {
    const fetched = fetchMock().mockResolvedValue(respond(200, session))

    const [first, second, third] = await Promise.all([renewSession(), renewSession(), renewSession()])

    expect(fetched).toHaveBeenCalledTimes(1)
    expect(first).toEqual(second)
    expect(second).toEqual(third)
  })

  it('kolejne odnowienie po zakonczeniu poprzedniego idzie osobnym zadaniem', async () => {
    const fetched = fetchMock().mockResolvedValue(respond(200, session))

    await renewSession()
    await renewSession()

    expect(fetched).toHaveBeenCalledTimes(2)
  })

  it('odmowa czysci sesje zamiast rzucac', async () => {
    fetchMock().mockResolvedValue(respond(200, session))
    await renewSession()

    fetchMock().mockResolvedValue(respond(401))

    await expect(renewSession()).resolves.toBeNull()
    expect(accessToken()).toBeNull()
  })

  it('padnieta siec jest tym samym co brak sesji', async () => {
    fetchMock().mockRejectedValue(new TypeError('Failed to fetch'))

    await expect(renewSession()).resolves.toBeNull()
    expect(accessToken()).toBeNull()
  })
})

describe('wylogowanie', () => {
  it('czysci token nawet gdy zadanie padnie', async () => {
    fetchMock().mockResolvedValue(respond(200, session))
    await signIn('admin@bug-shot.test', 'haslo')

    fetchMock().mockRejectedValue(new TypeError('Failed to fetch'))

    await expect(signOut()).rejects.toBeInstanceOf(TypeError)
    expect(accessToken()).toBeNull()
  })
})

describe('obserwatorzy', () => {
  it('dostaja sesje i null a po odpieciu juz nic', async () => {
    const seen: unknown[] = []
    const unwatch = watchSession((value) => seen.push(value))

    fetchMock().mockResolvedValue(respond(200, session))
    await signIn('admin@bug-shot.test', 'haslo')

    fetchMock().mockResolvedValue(respond(401))
    await renewSession()

    unwatch()
    fetchMock().mockResolvedValue(respond(200, session))
    await signIn('admin@bug-shot.test', 'haslo')

    expect(seen).toHaveLength(2)
    expect(seen[0]).toMatchObject({ accessToken: 'token-1' })
    expect(seen[1]).toBeNull()
  })
})
