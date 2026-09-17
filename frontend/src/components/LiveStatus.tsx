import { cn } from 'cn'
import type { StreamStatus } from '../hooks/useTicketStream'

const labels: Record<StreamStatus, string> = {
  connecting: 'Łączenie z kanałem live',
  live: 'Kanał live aktywny',
  offline: 'Kanał live rozłączony',
}

const dots: Record<StreamStatus, string> = {
  connecting: 'bg-warning',
  live: 'bg-success',
  offline: 'bg-muted-foreground',
}

function LiveStatus({ status }: { status: StreamStatus }) {
  return (
    <span role="status" className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <span aria-hidden="true" className={cn('size-2 rounded-full', dots[status])} />
      {labels[status]}
    </span>
  )
}

export default LiveStatus
