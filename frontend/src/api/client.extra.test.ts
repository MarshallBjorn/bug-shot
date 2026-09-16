import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiDelete, apiGet, apiPatch, apiPost, apiRequest } from './client'
import { accessToken, renewSession } from '../auth/session'

vi.mock('../auth/session', () => ({
  accessToken: vi.fn(() => null),
  renewSession: vi.fn(),
}))

function response(status: number, body?: unknown) {
  return new Response(
    body === undefined ? null : JSON.stringify(body),
    {
      status,
      headers: { 'Content-Type': 'application/json' },
    },
  )
}

beforeEach(() => {
  vi.restoreAllMocks()
  vi.mocked(accessToken).mockReturnValue(null)
  vi.mocked(renewSession).mockResolvedValue(null)
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('api client extra', () => {
  it('wysyla GET bez tokenu', async () => {
    const fetched = vi.mocked(fetch)
    fetched.mockResolvedValue(response(200, { ok: true }))

    await apiGet('/api/test')

    expect(fetched).toHaveBeenCalledTimes(1)

    const [url, init] = fetched.mock.calls[0]

    expect(String(url)).toContain('/api/test')
    expect((init as RequestInit).headers).toEqual({
      Accept: 'application/json',
    })
  })

  it('dokleja bearer token do GET', async () => {
    vi.mocked(accessToken).mockReturnValue('token-1')

    const fetched = vi.mocked(fetch)
    fetched.mockResolvedValue(response(200, { ok: true }))

    await apiGet('/api/test')

    const [, init] = fetched.mock.calls[0]
    const headers = (init as RequestInit).headers as Record<string, string>

    expect(headers.Authorization).toBe('Bearer token-1')
  })

  it('POST serializuje body i zwraca JSON', async () => {
    const fetched = vi.mocked(fetch)
    fetched.mockResolvedValue(response(200, { id: '1' }))

    const result = await apiPost<{ id: string }>('/api/test', {
      name: 'Radek',
    })

    expect(result).toEqual({ id: '1' })

    const [, init] = fetched.mock.calls[0]

    expect((init as RequestInit).method).toBe('POST')
    expect((init as RequestInit).body).toBe(JSON.stringify({ name: 'Radek' }))
  })

  it('PATCH przekazuje dodatkowe naglowki', async () => {
    const fetched = vi.mocked(fetch)
    fetched.mockResolvedValue(response(200, { ok: true }))

    await apiPatch('/api/test', { status: 'Resolved' }, {
      'If-Match': 'row-1',
    })

    const [, init] = fetched.mock.calls[0]
    const headers = (init as RequestInit).headers as Record<string, string>

    expect((init as RequestInit).method).toBe('PATCH')
    expect(headers['If-Match']).toBe('row-1')
  })

  it('DELETE obsluguje 204 bez parsowania JSON', async () => {
    const fetched = vi.mocked(fetch)
    fetched.mockResolvedValue(response(204))

    await expect(apiDelete('/api/test')).resolves.toBeUndefined()
  })

  it('rzuca ApiError dla odpowiedzi spoza 2xx', async () => {
    const fetched = vi.mocked(fetch)
    fetched.mockResolvedValue(response(409))

    await expect(apiPost('/api/test', {})).rejects.toMatchObject({
      status: 409,
    })
  })

  it('po 401 odnawia sesje i ponawia mutacje', async () => {
    vi.mocked(accessToken)
      .mockReturnValueOnce('token-1')
      .mockReturnValueOnce('token-2')

    vi.mocked(renewSession).mockResolvedValue({
      accessToken: 'token-2',
      expiresAt: '2026-09-14T18:00:00.000Z',
      user: {
        id: 'u1',
        email: 'admin@bug-shot.test',
        isAdmin: true,
        isActive: true,
      },
    })

    const fetched = vi.mocked(fetch)

    fetched
      .mockResolvedValueOnce(response(401))
      .mockResolvedValueOnce(response(200, { ok: true }))

    await apiPatch('/api/test', { status: 'Resolved' })

    expect(fetched).toHaveBeenCalledTimes(2)
    expect(renewSession).toHaveBeenCalledTimes(1)

    const [, retryInit] = fetched.mock.calls[1]
    const headers = (retryInit as RequestInit).headers as Record<string, string>

    expect(headers.Authorization).toBe('Bearer token-2')
  })

  it('apiRequest zwraca surowa odpowiedz', async () => {
    const fetched = vi.mocked(fetch)

    fetched.mockResolvedValue(
      new Response('png', {
        status: 200,
        headers: { 'Content-Type': 'image/png' },
      }),
    )

    const result = await apiRequest('/api/v1/attachments/1/download')

    expect(result.headers.get('content-type')).toBe('image/png')
    await expect(result.text()).resolves.toBe('png')
  })
})
