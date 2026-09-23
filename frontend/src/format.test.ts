import { describe, expect, it } from 'vitest'
import {
  formatAttachmentKind,
  formatDateTime,
  formatFileSize,
  formatResultCount,
  formatStatus,
  formatRelativeTime,
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

describe('czas relatywny', () => {
  const now = new Date('2026-09-17T12:00:00Z')

  it('skaluje jednostke do odstepu', () => {
    expect(formatRelativeTime('2026-09-17T11:59:30Z', now)).toBe('30 sekund temu')
    expect(formatRelativeTime('2026-09-17T11:30:00Z', now)).toBe('30 minut temu')
    expect(formatRelativeTime('2026-09-17T06:00:00Z', now)).toBe('6 godzin temu')
    expect(formatRelativeTime('2026-09-14T12:00:00Z', now)).toBe('3 dni temu')
    expect(formatRelativeTime('2026-08-27T12:00:00Z', now)).toBe('3 tygodnie temu')
    expect(formatRelativeTime('2026-05-17T12:00:00Z', now)).toBe('4 miesiące temu')
    expect(formatRelativeTime('2024-09-17T12:00:00Z', now)).toBe('2 lata temu')
  })

  it('brak wartosci i zepsuta data daja kreske', () => {
    expect(formatRelativeTime(null, now)).toBe('-')
    expect(formatRelativeTime('nie data', now)).toBe('-')
  })
})
