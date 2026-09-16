import type { StreamStatus } from '../hooks/useTicketStream'

const labels: Record<StreamStatus, string> = {
  connecting: 'Łączenie z kanałem live',
  live: 'Kanał live aktywny',
  offline: 'Kanał live rozłączony',
}

function LiveStatus({ status }: { status: StreamStatus }) {
  return (
    <span className={`live-status live-status-${status}`} role="status">
      <span className="live-dot" aria-hidden="true" />
      {labels[status]}
    </span>
  )
}

export default LiveStatus
