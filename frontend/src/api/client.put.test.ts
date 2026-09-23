import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { apiPut } from './client'
import { accessToken, renewSession } from '../auth/session'

vi.mock('../auth/session', () => ({
  accessToken: vi.fn(() => null),
  renewSession: vi.fn(),
}))

function response(status: number, body?: unknown) {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

beforeEach(() => {
  vi.mocked(accessToken).mockReturnValue(null)
  vi.mocked(renewSession).mockResolvedValue(null)
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('apiPut', () => {
  it('wysyla PUT z JSON body', async () => {
    const fetched = vi.mocked(fetch)
    fetched.mockResolvedValue(response(200, { id: 'c1' }))

    await expect(apiPut<{ id: string }>('/api/test', { enabled: false })).resolves.toEqual({ id: 'c1' })

    const [, init] = fetched.mock.calls[0]
    expect((init as RequestInit).method).toBe('PUT')
    expect((init as RequestInit).body).toBe(JSON.stringify({ enabled: false }))
  })

  it('po 401 odnawia sesje i ponawia PUT', async () => {
    vi.mocked(accessToken)
      .mockReturnValueOnce('token-1')
      .mockReturnValueOnce('token-2')
    vi.mocked(renewSession).mockResolvedValue({
      accessToken: 'token-2',
      expiresAt: '2026-09-16T18:00:00.000Z',
      user: { id: 'u1', email: 'admin@bug-shot.test', isAdmin: true, isActive: true },
    })

    const fetched = vi.mocked(fetch)
    fetched
      .mockResolvedValueOnce(response(401))
      .mockResolvedValueOnce(response(200, { ok: true }))

    await expect(apiPut('/api/test', { enabled: true })).resolves.toEqual({ ok: true })
    expect(fetched).toHaveBeenCalledTimes(2)
    expect(vi.mocked(renewSession)).toHaveBeenCalledTimes(1)

    const [, retryInit] = fetched.mock.calls[1]
    const headers = (retryInit as RequestInit).headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer token-2')
  })
})
