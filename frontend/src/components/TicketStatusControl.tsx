import { Button } from '@/components/ui/button'
import { formatStatus } from '../format'
import StatusBadge from './StatusBadge'
import type { TicketStatus } from '../types'

interface TicketStatusControlProps {
  status: TicketStatus
  allowed: TicketStatus[]
  busy: boolean
  onChange: (status: TicketStatus) => void
}

// przyciski ida z allowedStatuses z API, czyli z mapy przejsc przylozonej do stanu na serwerze
function TicketStatusControl({ status, allowed, busy, onChange }: TicketStatusControlProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <StatusBadge status={status} />
      </div>

      {allowed.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {status === 'Deleted'
            ? 'Skasowane zgłoszenie nie zmienia już statusu.'
            : 'Brak dostępnych przejść.'}
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {allowed.map((target) => (
            <Button
              key={target}
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => onChange(target)}
            >
              {formatStatus(target)}
            </Button>
          ))}
        </div>
      )}
    </div>
  )
}

export default TicketStatusControl
