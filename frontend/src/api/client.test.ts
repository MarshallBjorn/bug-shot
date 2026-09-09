import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renewSession, signIn } from '../auth/session'
import { ApiError, apiGet, apiRequest } from './client'

const session = {
  accessToken: 'token-1',
  expiresAt: '2026-09-08T18:00:00+00:00',
  user: { id: 'u1', email: 'admin@bug-shot.test', isAdmin: true, isActive: true },
}

const rotated = { ...session, accessToken: 'token-2' }

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

function authorization(call: unknown[]) {
  return (call[1] as RequestInit).headers as Record<string, string>
}

beforeEach(async () => {
  fetchMock().mockResolvedValue(respond(401))
  await renewSession()

  fetchMock().mockResolvedValue(respond(200, session))
  await signIn('admin@bug-shot.test', 'haslo')
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('zadania do api', () => {
  it('dokladaja token sesji', async () => {
    const fetched = fetchMock().mockResolvedValue(respond(200, { items: [] }))

    await apiGet('/api/v1/tickets')

    expect(authorization(fetched.mock.calls[0]).Authorization).toBe('Bearer token-1')
  })

  it('zwracaja zdeserializowane cialo', async () => {
    fetchMock().mockResolvedValue(respond(200, { total: 3 }))

    await expect(apiGet<{ total: number }>('/api/v1/tickets')).resolves.toEqual({ total: 3 })
  })

  it('blad inny niz 401 idzie dalej z kodem', async () => {
    fetchMock().mockResolvedValue(respond(500))

    const failure = await apiGet('/api/v1/tickets').catch((cause: ApiError) => cause)

    expect(failure).toBeInstanceOf(ApiError)
    expect((failure as ApiError).status).toBe(500)
  })
})

describe('wygasly token', () => {
  it('odnawia sesje i powtarza zadanie nowym tokenem', async () => {
    const fetched = fetchMock()
      .mockResolvedValueOnce(respond(401))
      .mockResolvedValueOnce(respond(200, rotated))
      .mockResolvedValueOnce(respond(200, { total: 1 }))

    await expect(apiGet('/api/v1/tickets')).resolves.toEqual({ total: 1 })

    expect(fetched).toHaveBeenCalledTimes(3)
    expect(fetched.mock.calls[1][0]).toContain('/api/v1/auth/refresh')
    expect(authorization(fetched.mock.calls[2]).Authorization).toBe('Bearer token-2')
  })

  it('nieudane odnowienie konczy sie 401 bez powtorki', async () => {
    const fetched = fetchMock()
      .mockResolvedValueOnce(respond(401))
      .mockResolvedValueOnce(respond(401))

    const failure = await apiGet('/api/v1/tickets').catch((cause: ApiError) => cause)

    expect((failure as ApiError).status).toBe(401)
    expect(fetched).toHaveBeenCalledTimes(2)
  })

  // bez tego 401 na powtorce zapetlilby odnawianie
  it('powtorka konczaca sie 401 nie odnawia sesji drugi raz', async () => {
    const fetched = fetchMock()
      .mockResolvedValueOnce(respond(401))
      .mockResolvedValueOnce(respond(200, rotated))
      .mockResolvedValueOnce(respond(401))

    await expect(apiGet('/api/v1/tickets')).rejects.toBeInstanceOf(ApiError)

    expect(fetched).toHaveBeenCalledTimes(3)
  })

  it('jedno odnowienie obsluguje kilka rownoleglych zadan', async () => {
    const fetched = fetchMock().mockImplementation((url: string) => {
      if (url.includes('/auth/refresh')) {
        return Promise.resolve(respond(200, rotated))
      }

      const header = 'Bearer token-2'
      const called = fetched.mock.calls.at(-1)!

      return Promise.resolve(
        authorization(called).Authorization === header ? respond(200, { ok: true }) : respond(401),
      )
    })

    await Promise.all([apiGet('/api/v1/tickets'), apiGet('/api/v1/projects/1/tickets')])

    const refreshes = fetched.mock.calls.filter(([url]) => (url as string).includes('/auth/refresh'))

    expect(refreshes).toHaveLength(1)
  })
})

describe('surowa odpowiedz', () => {
  it('wraca nietknieta zeby dalo sie z niej wziac plik', async () => {
    fetchMock().mockResolvedValue(
      new Response('png', { status: 200, headers: { 'Content-Type': 'image/png' } }),
    )

    const response = await apiRequest('/api/v1/attachments/1/download')

    expect(response.headers.get('content-type')).toBe('image/png')
    await expect(response.text()).resolves.toBe('png')
  })
})
