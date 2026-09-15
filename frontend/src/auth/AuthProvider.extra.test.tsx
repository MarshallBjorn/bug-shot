import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from './AuthContext'
import { AuthProvider } from './AuthProvider'

function session(accessToken: string, minutesLeft: number) {
  return {
    accessToken,
    expiresAt: new Date(Date.now() + minutesLeft * 60_000).toISOString(),
    user: {
      id: 'u1',
      email: 'admin@bug-shot.test',
      isAdmin: true,
      isActive: true,
    },
  }
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

function Probe() {
  const { status, user } = useAuth()

  return <p>{`${status}:${user?.email ?? 'nikt'}`}</p>
}

function show() {
  return render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  )
}

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('AuthProvider extra', () => {
  it('startuje od stanu checking', async () => {
    let resolve: (value: Response) => void = () => {}

    vi.stubGlobal(
      'fetch',
      vi.fn().mockReturnValue(
        new Promise<Response>((done) => {
          resolve = done
        }),
      ),
    )

    show()

    expect(screen.getByText('checking:nikt')).toBeDefined()

    await act(async () => {
      resolve(response(401))
    })

    await waitFor(() => {
      expect(screen.getByText('anonymous:nikt')).toBeDefined()
    })
  })

  it('przywraca aktywna sesje po starcie', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        response(200, session('token-restore', 15)),
      ),
    )

    show()

    await waitFor(() => {
      expect(
        screen.getByText('authenticated:admin@bug-shot.test'),
      ).toBeDefined()
    })
  })

  it('traci autoryzacje po nieudanym odnowieniu', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })

    const fetched = vi
      .fn()
      .mockResolvedValueOnce(response(200, session('token-1', 15)))
      .mockResolvedValueOnce(response(401))

    vi.stubGlobal('fetch', fetched)

    show()

    await waitFor(() => {
      expect(
        screen.getByText('authenticated:admin@bug-shot.test'),
      ).toBeDefined()
    })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(14 * 60_000)
    })

    expect(fetched).toHaveBeenCalledTimes(2)

    await waitFor(() => {
      expect(screen.getByText('anonymous:nikt')).toBeDefined()
    })
  })
})
