import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { downloadAttachment } from './media'

const created = vi.fn(() => 'blob:zrzut')
const revoked = vi.fn()

function anchorClicks() {
  const clicked: { download: string; href: string | null }[] = []

  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    clicked.push({ download: this.download, href: this.getAttribute('href') })
  })

  return clicked
}

beforeEach(() => {
  created.mockClear()
  revoked.mockClear()

  // jsdom nie ma adresow blob wiec podstawiamy je zeby dalo sie sprawdzic sprzatanie
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: created, revokeObjectURL: revoked }))
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('pobieranie pliku na zadanie', () => {
  it('idzie na endpoint zalacznika i zapisuje pod nazwa z metadanych', async () => {
    const fetched = vi.fn().mockResolvedValue(new Response('png', { status: 200 }))
    vi.stubGlobal('fetch', fetched)

    const clicked = anchorClicks()

    await downloadAttachment('a1', 'zrzut.png')

    expect(fetched.mock.calls[0][0]).toContain('/api/v1/attachments/a1/download')
    expect(clicked).toEqual([{ download: 'zrzut.png', href: 'blob:zrzut' }])
  })

  // natychmiastowe zwolnienie adresu potrafi przerwac rozpoczete pobieranie
  it('zwalnia adres bloba dopiero po oddaniu sterowania przegladarce', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('png', { status: 200 })))

    anchorClicks()

    await downloadAttachment('a1', 'zrzut.png')

    expect(revoked).not.toHaveBeenCalled()

    await new Promise((done) => setTimeout(done, 0))

    expect(revoked).toHaveBeenCalledWith('blob:zrzut')
  })
})
