import { cn } from 'cn'
import { formatStatus } from '../format'
import type { TicketStatus } from '../types'

// jedna rampa obsluguje statusy i poziomy logu wiec kolor znaczy to samo w calym panelu
const tones: Record<TicketStatus, string> = {
  New: 'border-primary/30 bg-primary/10 text-primary',
  InProgress: 'border-warning/30 bg-warning/10 text-warning',
  Resolved: 'border-success/30 bg-success/10 text-success',
  Rejected: 'border-destructive/30 bg-destructive/10 text-destructive',
  Deleted: 'border-border bg-muted text-muted-foreground',
}

function StatusBadge({ status, className }: { status: TicketStatus; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        tones[status],
        className,
      )}
    >
      {formatStatus(status)}
    </span>
  )
}

export default StatusBadge
