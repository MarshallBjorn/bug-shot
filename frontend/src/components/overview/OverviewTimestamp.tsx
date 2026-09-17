import { formatDateTime, formatRelativeTime } from '../../format'
import OverviewCard from './OverviewCard'

interface OverviewTimestampProps {
  reportedAt: string | null
  receivedAt: string
}

// reportedAt podaje zegar klienta wiec moze klamac, receivedAt stempluje serwer
function OverviewTimestamp({ reportedAt, receivedAt }: OverviewTimestampProps) {
  const drift =
    reportedAt !== null && Math.abs(Date.parse(receivedAt) - Date.parse(reportedAt)) > 5 * 60_000

  return (
    <OverviewCard label="Zgłoszono">
      <span className="block" title={formatDateTime(reportedAt ?? receivedAt)}>
        {formatRelativeTime(reportedAt ?? receivedAt)}
      </span>
      {drift && (
        <span className="block text-xs text-muted-foreground">
          Zegar przeglądarki rozjechał się z serwerem, przyjęto {formatDateTime(receivedAt)}
        </span>
      )}
    </OverviewCard>
  )
}

export default OverviewTimestamp
