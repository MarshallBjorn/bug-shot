import { formatDevice } from '../../environmentOptions'
import type { TicketClientEnvironment } from '../../types'
import OverviewCard from './OverviewCard'

interface OverviewUserAgentProps {
  userAgent: string
  environment: TicketClientEnvironment
  onFilterByBrowser: (browser: string) => void
}

function OverviewUserAgent({
  userAgent,
  environment,
  onFilterByBrowser,
}: OverviewUserAgentProps) {
  const { browserName, osName, deviceType } = environment

  const summary = [browserName, osName, deviceType && formatDevice(deviceType)]
    .filter(Boolean)
    .join(', ')

  return (
    <OverviewCard
      label="Przeglądarka"
      action={`Pokaż wszystkie zgłoszenia z przeglądarki ${browserName}`}
      onClick={browserName ? () => onFilterByBrowser(browserName) : undefined}
    >
      <span className="block truncate" title={userAgent}>
        {summary || 'Nierozpoznana'}
      </span>
    </OverviewCard>
  )
}

export default OverviewUserAgent
