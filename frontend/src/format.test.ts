import { describe, expect, it } from 'vitest'
import {
  formatAttachmentKind,
  formatDateTime,
  formatFileSize,
  formatResultCount,
  formatStatus,
} from './format'

describe('formatStatus', () => {
  it('formatuje znane statusy', () => {
    expect(formatStatus('New')).toBe('Nowe')
    expect(formatStatus('InProgress')).toBe('W trakcie')
    expect(formatStatus('Resolved')).toBe('Rozwiązane')
    expect(formatStatus('Rejected')).toBe('Odrzucone')
    expect(formatStatus('Deleted')).toBe('Usunięte')
  })

  it('zwraca wartość wejściową dla nieznanego statusu', () => {
    expect(formatStatus('Unknown' as never)).toBe('Unknown')
  })
})

describe('formatAttachmentKind', () => {
  it('formatuje znane rodzaje załączników', () => {
    expect(formatAttachmentKind('Screenshot')).toBe('Zrzut ekranu')
    expect(formatAttachmentKind('UserUpload')).toBe('Plik użytkownika')
    expect(formatAttachmentKind('ConsoleLog')).toBe('Log konsoli')
  })

  it('zwraca wartość wejściową dla nieznanego rodzaju', () => {
    expect(formatAttachmentKind('Unknown' as never)).toBe('Unknown')
  })
})

describe('formatResultCount', () => {
  it('stosuje polskie formy liczby wyników', () => {
    expect(formatResultCount(0)).toBe('0 wyników')
    expect(formatResultCount(1)).toBe('1 wynik')
    expect(formatResultCount(2)).toBe('2 wyniki')
    expect(formatResultCount(5)).toBe('5 wyników')
  })
})

describe('formatFileSize', () => {
  it('formatuje bajty', () => {
    expect(formatFileSize(512)).toBe('512 B')
  })

  it('formatuje kibibajty', () => {
    expect(formatFileSize(1024)).toBe('1.0 KiB')
    expect(formatFileSize(1536)).toBe('1.5 KiB')
  })

  it('formatuje mebibajty', () => {
    expect(formatFileSize(1024 * 1024)).toBe('1.0 MiB')
    expect(formatFileSize(2 * 1024 * 1024)).toBe('2.0 MiB')
  })
})

describe('formatDateTime', () => {
  it('zwraca kreskę dla braku daty', () => {
    expect(formatDateTime(null)).toBe('-')
  })

  it('formatuje poprawną datę', () => {
    expect(formatDateTime('2026-01-15T12:30:00.000Z')).not.toBe('-')
  })
})
