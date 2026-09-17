import { describe, expect, it } from 'vitest'
import { buildTimeline } from './ticketTimeline'
import type { TicketComment, TicketStatusChange } from './types'

function change(changedAt: string): TicketStatusChange {
  return { fromStatus: 'New', toStatus: 'InProgress', changedBy: 'bartek', changedAt }
}

function comment(createdAt: string, body = 'tresc'): TicketComment {
  return { id: createdAt, author: 'bartek', body, createdAt }
}

describe('scalony timeline', () => {
  it('uklada wpisy po czasie niezaleznie od zrodla', () => {
    const items = buildTimeline(
      [change('2026-09-17T10:05:00Z')],
      [comment('2026-09-17T10:00:00Z'), comment('2026-09-17T10:10:00Z')],
    )

    expect(items.map((item) => item.kind)).toEqual(['comment', 'status', 'comment'])
  })

  // komentarz zwykle opisuje zmiane wiec przy rownym czasie zmiana idzie pierwsza
  it('przy rownym czasie zmiana statusu wyprzedza komentarz', () => {
    const items = buildTimeline([change('2026-09-17T10:00:00Z')], [comment('2026-09-17T10:00:00Z')])

    expect(items.map((item) => item.kind)).toEqual(['status', 'comment'])
  })

  it('same komentarze zachowuja kolejnosc', () => {
    const items = buildTimeline([], [comment('2026-09-17T10:00:00Z', 'a'), comment('2026-09-17T10:01:00Z', 'b')])

    expect(items).toHaveLength(2)
    expect(items[0].kind).toBe('comment')
  })

  it('pusty timeline zostaje pusty', () => {
    expect(buildTimeline([], [])).toEqual([])
  })
})
