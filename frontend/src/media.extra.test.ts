import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from './api/client'
import {
  downloadAttachment,
  fetchAttachment,
  isImage,
} from './media'

vi.mock('./api/client', () => ({
  apiRequest: vi.fn(),
}))

describe('media extra', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('fetchAttachment pobiera blob i tworzy URL', async () => {
    const blob = new Blob(['test'], { type: 'text/plain' })
    const response = {
      blob: vi.fn().mockResolvedValue(blob),
    } as unknown as Response

    vi.mocked(apiRequest).mockResolvedValue(response)

    await expect(fetchAttachment('att-1')).resolves.toBe('blob:test')

    expect(apiRequest).toHaveBeenCalledWith(
      '/api/v1/attachments/att-1/download',
      undefined,
    )

    expect(response.blob).toHaveBeenCalledTimes(1)
    expect(URL.createObjectURL).toHaveBeenCalledWith(blob)
  })

  it('fetchAttachment przekazuje AbortSignal', async () => {
    const signal = new AbortController().signal
    const blob = new Blob(['test'])
    const response = {
      blob: vi.fn().mockResolvedValue(blob),
    } as unknown as Response

    vi.mocked(apiRequest).mockResolvedValue(response)

    await fetchAttachment('att-2', signal)

    expect(apiRequest).toHaveBeenCalledWith(
      '/api/v1/attachments/att-2/download',
      signal,
    )
  })

  it('downloadAttachment tworzy link z nazwa pliku', async () => {
    const click = vi.fn()
    const appendChild = vi.spyOn(document.body, 'appendChild')

    const createElement = vi
      .spyOn(document, 'createElement')
      .mockReturnValue({
        download: '',
        href: '',
        click,
      } as unknown as HTMLAnchorElement)

    vi.mocked(apiRequest).mockResolvedValue({
      blob: vi.fn().mockResolvedValue(new Blob(['test'])),
    } as unknown as Response)

    vi.useFakeTimers()

    await downloadAttachment('att-3', 'screen.png')

    expect(createElement).toHaveBeenCalledWith('a')
    expect(click).toHaveBeenCalledTimes(1)
    expect(appendChild).not.toHaveBeenCalled()

    const link = createElement.mock.results[0].value as HTMLAnchorElement

    expect(link.download).toBe('screen.png')
    expect(link.href).toBe('blob:test')

    expect(URL.revokeObjectURL).not.toHaveBeenCalled()

    vi.runAllTimers()

    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test')

    vi.useRealTimers()
  })

  it('rozpoznaje typy obrazow', () => {
    expect(isImage('image/png')).toBe(true)
    expect(isImage('image/jpeg')).toBe(true)
    expect(isImage('text/plain')).toBe(false)
    expect(isImage('application/json')).toBe(false)
  })
})
