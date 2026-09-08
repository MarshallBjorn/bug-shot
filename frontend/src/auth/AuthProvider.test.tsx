import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from './AuthContext'
import { AuthProvider } from './AuthProvider'

function session(accessToken: string, minutesLeft: number) {
  return {
    accessToken,
    expiresAt: new Date(Date.now() + minutesLeft * 60_000).toISOString(),
    user: { id: 'u1', email: 'admin@bug-shot.test', isAdmin: true, isActive: true },
  }
}

function respond(status: number, body?: unknown) {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
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

describe('odtwarzanie sesji przy starcie', () => {
  it('konczy sie zalogowaniem gdy cookie z refreshem jeszcze zyje', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respond(200, session('token-1', 15))))

    show()

    await waitFor(() => expect(screen.getByText('authenticated:admin@bug-shot.test')).toBeDefined())
  })

  it('konczy sie brakiem sesji gdy cookie nie ma', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respond(401)))

    show()

    await waitFor(() => expect(screen.getByText('anonymous:nikt')).toBeDefined())
  })

  // panel nie moze mignac ekranem logowania zanim sprawdzi cookie
  it('zanim odpowie serwer stan jest sprawdzaniem a nie brakiem sesji', async () => {
    let answer: (value: Response) => void = () => {}
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise<Response>((done) => (answer = done))))

    show()

    expect(screen.getByText('checking:nikt')).toBeDefined()

    await act(async () => answer(respond(401)))

    expect(screen.getByText('anonymous:nikt')).toBeDefined()
  })
})

describe('ciche odnawianie', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  it('odnawia token minute przed wygasnieciem', async () => {
    const fetched = vi.fn().mockResolvedValue(respond(200, session('token-1', 15)))
    vi.stubGlobal('fetch', fetched)

    show()

    await waitFor(() => expect(screen.getByText('authenticated:admin@bug-shot.test')).toBeDefined())
    expect(fetched).toHaveBeenCalledTimes(1)

    // czternascie minut to kwadrans bez minuty zapasu
    await act(async () => {
      await vi.advanceTimersByTimeAsync(14 * 60_000)
    })

    expect(fetched).toHaveBeenCalledTimes(2)
    expect(fetched.mock.calls[1][0]).toContain('/api/v1/auth/refresh')
  })

  it('nie odnawia zanim minie zaplanowany czas', async () => {
    const fetched = vi.fn().mockResolvedValue(respond(200, session('token-1', 15)))
    vi.stubGlobal('fetch', fetched)

    show()

    await waitFor(() => expect(screen.getByText('authenticated:admin@bug-shot.test')).toBeDefined())

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10 * 60_000)
    })

    expect(fetched).toHaveBeenCalledTimes(1)
  })

  // token juz prawie wygasly nie moze zaplanowac odnowienia w przeszlosci i zapetlic sie
  it('token tuz przed wygasnieciem odnawia sie z minimalnym odstepem', async () => {
    const fetched = vi.fn().mockResolvedValue(respond(200, session('token-1', 0.2)))
    vi.stubGlobal('fetch', fetched)

    show()

    await waitFor(() => expect(screen.getByText('authenticated:admin@bug-shot.test')).toBeDefined())

    await act(async () => {
      await vi.advanceTimersByTimeAsync(4_000)
    })

    expect(fetched).toHaveBeenCalledTimes(1)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000)
    })

    expect(fetched).toHaveBeenCalledTimes(2)
  })

  it('po utracie sesji nie planuje kolejnych odnowien', async () => {
    const fetched = vi.fn().mockResolvedValue(respond(401))
    vi.stubGlobal('fetch', fetched)

    show()

    await waitFor(() => expect(screen.getByText('anonymous:nikt')).toBeDefined())

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30 * 60_000)
    })

    expect(fetched).toHaveBeenCalledTimes(1)
  })
})
