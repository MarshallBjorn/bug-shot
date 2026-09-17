import { formatDevice } from '../environmentOptions'
import type { TicketClientEnvironment } from '../types'

interface TicketEnvironmentProps {
  environment: TicketClientEnvironment
  userAgent: string
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-sm break-words">{value}</dd>
    </>
  )
}

// dane z migracji AddTicketClientDetails, ktore do tej pory nie wychodzily poza analityke
function TicketEnvironment({ environment, userAgent }: TicketEnvironmentProps) {
  const {
    browserName,
    osName,
    deviceType,
    viewportWidth,
    viewportHeight,
    devicePixelRatio,
    language,
    timeZone,
  } = environment

  const viewport =
    viewportWidth && viewportHeight
      ? `${viewportWidth} na ${viewportHeight}${devicePixelRatio ? `, dpr ${devicePixelRatio}` : ''}`
      : null

  return (
    <dl className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-x-3 gap-y-1.5">
      {browserName && <Row label="Przeglądarka" value={browserName} />}
      {osName && <Row label="System" value={osName} />}
      {deviceType && <Row label="Urządzenie" value={formatDevice(deviceType)} />}
      {viewport && <Row label="Viewport" value={viewport} />}
      {language && <Row label="Język" value={language} />}
      {timeZone && <Row label="Strefa" value={timeZone} />}
      {userAgent && (
        <>
          <dt className="text-xs text-muted-foreground">User agent</dt>
          <dd className="min-w-0 font-mono text-xs break-all text-muted-foreground">
            {userAgent}
          </dd>
        </>
      )}
    </dl>
  )
}

export default TicketEnvironment
