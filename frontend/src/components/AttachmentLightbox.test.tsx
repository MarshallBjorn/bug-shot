import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AttachmentLightbox from './AttachmentLightbox'
import { useAttachment } from '../hooks/useAttachment'
import { downloadAttachment } from '../media'
import type { TicketAttachment } from '../types'

vi.mock('../hooks/useAttachment', () => ({
  useAttachment: vi.fn(),
}))

vi.mock('../media', () => ({
  downloadAttachment: vi.fn(),
}))

function attachment(id: string, fileName: string): TicketAttachment {
  return { id, kind: 'Screenshot', fileName, contentType: 'image/png', sizeBytes: 1024 }
}

const two = [attachment('a1', 'pierwszy.png'), attachment('a2', 'drugi.png')]

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(useAttachment).mockReturnValue({ url: 'blob:x', failed: false })
})

afterEach(() => {
  cleanup()
})

describe('lightbox zalacznikow', () => {
  it('zamkniety nie renderuje niczego', () => {
    const { container } = render(
      <AttachmentLightbox attachments={two} openIndex={null} onOpenChange={vi.fn()} />,
    )

    expect(container.firstChild).toBeNull()
  })

  it('pokazuje nazwe pliku i pozycje w zestawie', () => {
    render(<AttachmentLightbox attachments={two} openIndex={0} onOpenChange={vi.fn()} />)

    expect(screen.getByText('pierwszy.png')).toBeDefined()
    expect(screen.getByText(/1 z 2/)).toBeDefined()
  })

  it('jeden zalacznik nie dostaje nawigacji', () => {
    render(<AttachmentLightbox attachments={[two[0]]} openIndex={0} onOpenChange={vi.fn()} />)

    expect(screen.queryByRole('button', { name: 'Następny załącznik' })).toBeNull()
  })

  it('przyciski przechodza miedzy zalacznikami', () => {
    const onOpenChange = vi.fn()

    render(<AttachmentLightbox attachments={two} openIndex={0} onOpenChange={onOpenChange} />)

    fireEvent.click(screen.getByRole('button', { name: 'Następny załącznik' }))

    expect(onOpenChange).toHaveBeenCalledWith(1)
  })

  // lista jest zamknieta w petle wiec z ostatniego wracamy na pierwszy
  it('nawigacja zawija sie na koncach', () => {
    const onOpenChange = vi.fn()

    render(<AttachmentLightbox attachments={two} openIndex={0} onOpenChange={onOpenChange} />)

    fireEvent.click(screen.getByRole('button', { name: 'Poprzedni załącznik' }))

    expect(onOpenChange).toHaveBeenCalledWith(1)
  })

  it('strzalki przechodza miedzy zalacznikami', () => {
    const onOpenChange = vi.fn()

    render(<AttachmentLightbox attachments={two} openIndex={0} onOpenChange={onOpenChange} />)

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'ArrowRight' })
    expect(onOpenChange).toHaveBeenCalledWith(1)

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'ArrowLeft' })
    expect(onOpenChange).toHaveBeenCalledWith(1)
  })

  it('przelacznik skali zmienia stan', () => {
    render(<AttachmentLightbox attachments={two} openIndex={0} onOpenChange={vi.fn()} />)

    const toggle = screen.getByRole('button', { name: 'Skala 1:1' })

    expect(toggle.getAttribute('aria-pressed')).toBe('false')

    fireEvent.click(toggle)

    expect(screen.getByRole('button', { name: 'Dopasuj' }).getAttribute('aria-pressed')).toBe('true')
  })

  it('pobranie idzie po identyfikatorze i nazwie', () => {
    render(<AttachmentLightbox attachments={two} openIndex={1} onOpenChange={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Pobierz' }))

    expect(downloadAttachment).toHaveBeenCalledWith('a2', 'drugi.png')
  })

  it('nieudane pobranie pliku mowi o tym zamiast pokazywac pusty kadr', () => {
    vi.mocked(useAttachment).mockReturnValue({ url: null, failed: true })

    render(<AttachmentLightbox attachments={two} openIndex={0} onOpenChange={vi.fn()} />)

    expect(screen.getByText('Nie udało się pobrać pliku.')).toBeDefined()
  })

  it('w trakcie pobierania pokazuje postep', () => {
    vi.mocked(useAttachment).mockReturnValue({ url: null, failed: false })

    render(<AttachmentLightbox attachments={two} openIndex={0} onOpenChange={vi.fn()} />)

    expect(screen.getByText('Pobieranie...')).toBeDefined()
  })
})
