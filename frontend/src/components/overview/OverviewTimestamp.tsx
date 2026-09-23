import { formatDateTime, formatRelativeTime } from '../../format'
import { calendarDay } from '../../ticketQuery'
import OverviewCard from './OverviewCard'

interface OverviewTimestampProps {
  reportedAt: string | null
  receivedAt: string
  onFilterByDay: (day: string) => void
}

// reportedAt podaje zegar klienta wiec moze klamac, receivedAt stempluje serwer
// filtr dat na liscie idzie po receivedAt wiec klik tez bierze dzien z serwera
function OverviewTimestamp({ reportedAt, receivedAt, onFilterByDay }: OverviewTimestampProps) {
  const day = calendarDay(receivedAt)

  const drift =
    reportedAt !== null && Math.abs(Date.parse(receivedAt) - Date.parse(reportedAt)) > 5 * 60_000

  return (
    <OverviewCard
      label="Zgłoszono"
      action={`Pokaż wszystkie zgłoszenia z dnia ${day}`}
      onClick={() => onFilterByDay(day)}
    >
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
