import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AttachmentDownload from './AttachmentDownload'
import { downloadAttachment } from '../media'

vi.mock('../media', () => ({
  downloadAttachment: vi.fn(),
}))

const attachment = {
  id: 'att-1',
  kind: 'Screenshot' as const,
  fileName: 'screen.png',
  contentType: 'image/png',
  sizeBytes: 1024,
}

const mockedDownload = vi.mocked(downloadAttachment)

beforeEach(() => {
  vi.clearAllMocks()
  mockedDownload.mockResolvedValue(undefined)
})

afterEach(() => {
  cleanup()
})

describe('AttachmentDownload', () => {
  it('pobiera zalacznik po kliknieciu', async () => {
    render(
      <AttachmentDownload
        attachment={attachment}
        label="Pobierz"
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Pobierz' }))

    await vi.waitFor(() => {
      expect(mockedDownload).toHaveBeenCalledWith(
        'att-1',
        'screen.png',
      )
    })

    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('pokazuje blad gdy pobieranie sie nie uda', async () => {
    mockedDownload.mockRejectedValueOnce(new Error('network'))

    render(
      <AttachmentDownload
        attachment={attachment}
        label="Pobierz"
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Pobierz' }))

    await vi.waitFor(() => {
      expect(screen.getByRole('alert')).toBeDefined()
    })

    expect(screen.getByRole('alert').textContent).toContain(
      'Nie udało się pobrać',
    )
  })
})
