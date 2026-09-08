import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renewSession, signIn } from '../auth/session'
import { useAttachment } from './useAttachment'

const session = {
  accessToken: 'token-1',
  expiresAt: '2026-09-08T18:00:00+00:00',
  user: { id: 'u1', email: 'admin@bug-shot.test', isAdmin: true, isActive: true },
}

const created = vi.fn(() => 'blob:zrzut')
const revoked = vi.fn()

function Probe({ attachmentId = 'a1' }: { attachmentId?: string }) {
  const { url, failed } = useAttachment(attachmentId)

  return <p>{failed ? 'blad' : (url ?? 'pobieranie')}</p>
}

beforeEach(async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 401 })))
  await renewSession()

  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
    new Response(JSON.stringify(session), { status: 200, headers: { 'Content-Type': 'application/json' } }),
  ))
  await signIn('admin@bug-shot.test', 'haslo')

  created.mockClear()
  revoked.mockClear()

  // jsdom nie ma adresow blob wiec podstawiamy je zeby dalo sie sprawdzic sprzatanie
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: created, revokeObjectURL: revoked }))
})

afterEach(() => {
  // bez globals vitest nie wpina automatycznego sprzatania z testing library
  cleanup()
  vi.unstubAllGlobals()
})

describe('pobieranie zalacznika', () => {
  it('pokazuje adres bloba po pobraniu pliku', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('png', { status: 200 })))

    render(<Probe />)

    expect(screen.getByText('pobieranie')).toBeDefined()
    await waitFor(() => expect(screen.getByText('blob:zrzut')).toBeDefined())
  })

  it('wysyla zadanie na endpoint pobierania z tokenem', async () => {
    const fetched = vi.fn().mockResolvedValue(new Response('png', { status: 200 }))
    vi.stubGlobal('fetch', fetched)

    render(<Probe attachmentId="abc" />)

    await waitFor(() => expect(fetched).toHaveBeenCalled())

    const [url, init] = fetched.mock.calls[0]
    expect(url).toContain('/api/v1/attachments/abc/download')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer token-1')
  })

  // bez tego kazde wejscie w zgloszenie zostawia pobrany plik w pamieci karty
  it('zwalnia adres bloba po odmontowaniu', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('png', { status: 200 })))

    const view = render(<Probe />)

    await waitFor(() => expect(screen.getByText('blob:zrzut')).toBeDefined())

    view.unmount()

    expect(revoked).toHaveBeenCalledWith('blob:zrzut')
  })

  it('nieudane pobranie pokazuje blad zamiast wisiec na pobieraniu', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 404 })))

    render(<Probe />)

    await waitFor(() => expect(screen.getByText('blad')).toBeDefined())
    expect(created).not.toHaveBeenCalled()
  })
})
