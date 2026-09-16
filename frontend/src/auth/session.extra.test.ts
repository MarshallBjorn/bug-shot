import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { accessToken, renewSession, signIn, signOut } from './session'

const session = {
  accessToken: 'token-1',
  expiresAt: '2026-09-14T18:00:00+00:00',
  user: {
    id: 'u1',
    email: 'admin@bug-shot.test',
    isAdmin: true,
    isActive: true,
  },
}

function response(status: number, body?: unknown) {
  return new Response(
    body === undefined ? null : JSON.stringify(body),
    {
      status,
      headers: { 'Content-Type': 'application/json' },
    },
  )
}

beforeEach(async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(401)))
  await renewSession()
  vi.unstubAllGlobals()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('session extra', () => {
  it('odnawia sesje tylko pojedynczym wywolaniem przy rownoleglym dostepie', async () => {
    const fetched = vi.fn().mockResolvedValue(response(200, session))
    vi.stubGlobal('fetch', fetched)

    const [one, two, three] = await Promise.all([
      renewSession(),
      renewSession(),
      renewSession(),
    ])

    expect(fetched).toHaveBeenCalledTimes(1)
    expect(one).toEqual(two)
    expect(two).toEqual(three)
  })

  it('po kolejnej odnowie po zakonczonym zadaniu wykonuje nowy request', async () => {
    const fetched = vi.fn().mockResolvedValue(response(200, session))
    vi.stubGlobal('fetch', fetched)

    await renewSession()
    await renewSession()

    expect(fetched).toHaveBeenCalledTimes(2)
  })

  it('odnowienie po bledzie sieci zwraca null i czysci token', async () => {
    const fetched = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    vi.stubGlobal('fetch', fetched)

    await expect(renewSession()).resolves.toBeNull()
    expect(accessToken()).toBeNull()
  })

  it('wylogowanie czysci token', async () => {
    const fetched = vi.fn()
      .mockResolvedValueOnce(response(200, session))
      .mockResolvedValueOnce(response(204))

    vi.stubGlobal('fetch', fetched)

    await signIn('admin@bug-shot.test', 'haslo')
    expect(accessToken()).toBe('token-1')

    await signOut()

    expect(accessToken()).toBeNull()
  })
})
