import { ArrowRight, MessageSquare } from 'lucide-react'
import { formatDateTime, formatRelativeTime, formatStatus } from '../format'
import { buildTimeline } from '../ticketTimeline'
import type { TicketComment, TicketStatusChange } from '../types'

interface TicketTimelineProps {
  statusHistory: TicketStatusChange[]
  comments: TicketComment[]
  loading: boolean
}

function When({ at }: { at: string }) {
  return (
    <time dateTime={at} title={formatDateTime(at)} className="text-xs text-muted-foreground">
      {formatRelativeTime(at)}
    </time>
  )
}

function TicketTimeline({ statusHistory, comments, loading }: TicketTimelineProps) {
  if (loading) {
    return <p className="text-sm text-muted-foreground">Ładowanie historii...</p>
  }

  const items = buildTimeline(statusHistory, comments)

  if (items.length === 0) {
    return (
      <p className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
        Nic się jeszcze nie stało z tym zgłoszeniem.
      </p>
    )
  }

  return (
    <ol aria-label="Historia zgłoszenia" className="space-y-3">
      {items.map((item) =>
        item.kind === 'status' ? (
          <li
            key={`status-${item.at}-${item.change.toStatus}`}
            className="flex flex-wrap items-center gap-2 pl-1 text-sm"
          >
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full border bg-card">
              <ArrowRight aria-hidden="true" className="size-3 text-muted-foreground" />
            </span>
            <span>
              <span className="font-medium">{item.change.changedBy}</span> zmienił status z{' '}
              {formatStatus(item.change.fromStatus)} na {formatStatus(item.change.toStatus)}
            </span>
            <When at={item.at} />
          </li>
        ) : (
          <li key={`comment-${item.comment.id}`} className="flex gap-2">
            <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border bg-card">
              <MessageSquare aria-hidden="true" className="size-3 text-muted-foreground" />
            </span>
            <div className="min-w-0 flex-1 rounded-lg border bg-card">
              <div className="flex flex-wrap items-center gap-2 border-b px-3 py-1.5 text-sm">
                <span className="font-medium">{item.comment.author}</span>
                <When at={item.at} />
              </div>
              <p className="px-3 py-2 text-sm break-words whitespace-pre-wrap">
                {item.comment.body}
              </p>
            </div>
          </li>
        ),
      )}
    </ol>
  )
}

export default TicketTimeline
