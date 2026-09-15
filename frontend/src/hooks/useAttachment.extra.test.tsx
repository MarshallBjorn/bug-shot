import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renewSession } from '../auth/session'
import { useAttachment } from './useAttachment'

vi.mock('../auth/session', () => ({
  accessToken: vi.fn(() => 'token-1'),
  renewSession: vi.fn(),
}))

const created = vi.fn(() => 'blob:test')
const revoked = vi.fn()

function Probe({ attachmentId = 'a1' }: { attachmentId?: string }) {
  const { url, failed } = useAttachment(attachmentId)

  return <p>{failed ? 'blad' : (url ?? 'pobieranie')}</p>
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
  vi.stubGlobal('URL', {
    ...URL,
    createObjectURL: created,
    revokeObjectURL: revoked,
  })

  created.mockClear()
  revoked.mockClear()
  vi.mocked(renewSession).mockResolvedValue(null)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('useAttachment extra', () => {
  it('pokazuje blad po odpowiedzi spoza 2xx', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(null, { status: 404 }),
    )

    render(<Probe />)

    await waitFor(() => {
      expect(screen.getByText('blad')).toBeDefined()
    })
  })

  it('tworzy blob URL po udanym pobraniu', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response('png', {
        status: 200,
        headers: { 'Content-Type': 'image/png' },
      }),
    )

    render(<Probe />)

    await waitFor(() => {
      expect(screen.getByText('blob:test')).toBeDefined()
    })

    expect(created).toHaveBeenCalledTimes(1)
  })

  it('zwalnia blob URL po odmontowaniu', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response('png', {
        status: 200,
        headers: { 'Content-Type': 'image/png' },
      }),
    )

    const view = render(<Probe />)

    await waitFor(() => {
      expect(screen.getByText('blob:test')).toBeDefined()
    })

    view.unmount()

    expect(revoked).toHaveBeenCalledWith('blob:test')
  })
})
