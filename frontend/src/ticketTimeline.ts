import type { TicketComment, TicketStatusChange } from './types'

export type TimelineItem =
  | { kind: 'comment'; at: string; comment: TicketComment }
  | { kind: 'status'; at: string; change: TicketStatusChange }

// komentarze i zmiany statusu to jeden strumien pracy nad zgloszeniem, wiec panel je scala
// API oddaje je osobno bo to dwie tabele i dwa endpointy
export function buildTimeline(
  statusHistory: TicketStatusChange[],
  comments: TicketComment[],
): TimelineItem[] {
  const items: TimelineItem[] = [
    ...statusHistory.map((change) => ({
      kind: 'status' as const,
      at: change.changedAt,
      change,
    })),
    ...comments.map((comment) => ({
      kind: 'comment' as const,
      at: comment.createdAt,
      comment,
    })),
  ]

  // rowne znaczniki czasu ustawiamy zmiana statusu przed komentarzem, bo komentarz
  // zwykle opisuje zmiane ktora wlasnie zaszla
  return items.sort((left, right) => {
    const order = Date.parse(left.at) - Date.parse(right.at)

    if (order !== 0) {
      return order
    }

    if (left.kind === right.kind) {
      return 0
    }

    return left.kind === 'status' ? -1 : 1
  })
}
