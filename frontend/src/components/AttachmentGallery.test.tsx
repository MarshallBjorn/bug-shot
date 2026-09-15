import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AttachmentGallery from './AttachmentGallery'
import { useAttachment } from '../hooks/useAttachment'

vi.mock('../hooks/useAttachment', () => ({
  useAttachment: vi.fn(),
}))

vi.mock('./AttachmentDownload', () => ({
  default: ({
    label,
  }: {
    attachment: unknown
    label: string
  }) => <button type="button">{label}</button>,
}))

const mockedUseAttachment = vi.mocked(useAttachment)

const image = {
  id: 'img-1',
  kind: 'Screenshot' as const,
  fileName: 'screen.png',
  contentType: 'image/png',
  sizeBytes: 2048,
}

const document = {
  id: 'log-1',
  kind: 'ConsoleLog' as const,
  fileName: 'console.txt',
  contentType: 'text/plain',
  sizeBytes: 512,
}

beforeEach(() => {
  vi.clearAllMocks()
  mockedUseAttachment.mockReturnValue({
    url: 'blob:http://test/image',
    failed: false,
  })
})

afterEach(() => {
  cleanup()
})

describe('AttachmentGallery', () => {
  it('pokazuje komunikat gdy brak zalacznikow', () => {
    render(<AttachmentGallery attachments={[]} />)

    expect(
      screen.getByText('Zgłoszenie nie ma załączników.'),
    ).toBeDefined()
  })

  it('pokazuje obraz oraz plik tekstowy', () => {
    render(
      <AttachmentGallery
        attachments={[image, document]}
      />,
    )

    expect(screen.getByRole('img', { name: 'screen.png' })).toBeDefined()
    expect(screen.getByText('text/plain')).toBeDefined()
    expect(screen.getByRole('button', { name: 'screen.png' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'console.txt' })).toBeDefined()
  })

  it('pokazuje stan bledu podgladu obrazu', () => {
    mockedUseAttachment.mockReturnValue({
      url: null,
      failed: true,
    })

    render(<AttachmentGallery attachments={[image]} />)

    expect(
      screen.getByText('Nie udało się pobrać'),
    ).toBeDefined()
  })

  it('pokazuje stan pobierania podgladu', () => {
    mockedUseAttachment.mockReturnValue({
      url: null,
      failed: false,
    })

    render(<AttachmentGallery attachments={[image]} />)

    expect(screen.getByText('Pobieranie...')).toBeDefined()
  })
})
