import { Link, useParams, useSearchParams } from 'react-router'
import {
  analyticsRanges,
  defaultAnalyticsRange,
  type AnalyticsDuration,
  type AnalyticsNameCount,
  type AnalyticsRange,
  type ProjectAnalytics,
} from '../api/analytics'
import { downloadCsv, toCsv, type CsvValue } from '../analyticsCsv'
import { formatStatus } from '../format'
import { useProjectAnalytics } from '../hooks/useProjectAnalytics'

const rangeLabels: Record<AnalyticsRange, string> = {
  '7d': '7 dni',
  '30d': '30 dni',
  '90d': '90 dni',
  all: 'Całość',
}

const deviceLabels: Record<string, string> = {
  desktop: 'Komputer',
  mobile: 'Telefon',
  tablet: 'Tablet',
  unknown: 'Nieznane',
}

const numberFormat = new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 1 })

const percentFormat = new Intl.NumberFormat('pl-PL', { style: 'percent', maximumFractionDigits: 1 })

function parseRange(value: string | null): AnalyticsRange {
  return analyticsRanges.find((range) => range === value) ?? defaultAnalyticsRange
}

// powyżej dwóch dób godziny przestają się czytać więc przechodzimy na dni
function formatHours(hours: number | null) {
  if (hours === null) return 'brak danych'

  return hours < 48 ? `${numberFormat.format(hours)} h` : `${numberFormat.format(hours / 24)} dni`
}

function formatRate(rate: number | null) {
  return rate === null ? 'brak danych' : percentFormat.format(rate)
}

function formatName(name: string) {
  return name === 'Other' ? 'Inne' : name
}

function changeNote(current: number, previous: number | null) {
  if (previous === null) return 'cały okres'
  if (previous === 0) return `poprzednio ${previous}`

  const change = (current - previous) / previous
  const sign = change > 0 ? '+' : ''

  return `poprzednio ${previous} (${sign}${percentFormat.format(change)})`
}

function durationNote(duration: AnalyticsDuration) {
  return `p90 ${formatHours(duration.p90Hours)}, zgłoszeń: ${duration.samples}`
}

interface AnalyticsTableProps {
  title: string
  fileName: string
  header: string[]
  rows: CsvValue[][]
}

function AnalyticsTable({ title, fileName, header, rows }: AnalyticsTableProps) {
  return (
    <section className="analytics-section">
      <div className="list-heading">
        <h3>{title}</h3>
        <button
          type="button"
          aria-label={`Pobierz CSV: ${title}`}
          disabled={rows.length === 0}
          onClick={() => downloadCsv(fileName, toCsv(header, rows))}
        >
          Pobierz CSV
        </button>
      </div>

      {rows.length === 0 ? (
        <p>Brak danych w tym zakresie.</p>
      ) : (
        <table className="ticket-table">
          <thead>
            <tr>
              {header.map((column) => (
                <th key={column}>{column}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex}>{cell ?? ''}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}

function nameRows(items: AnalyticsNameCount[], label: (name: string) => string = formatName): CsvValue[][] {
  return items.map((item) => [label(item.name), item.count])
}

function AnalyticsSummary({ analytics }: { analytics: ProjectAnalytics }) {
  const { summary } = analytics

  const tiles = [
    { label: 'Nowe zgłoszenia', value: String(summary.newTickets), note: changeNote(summary.newTickets, summary.previousNewTickets) },
    { label: 'Nowe dzisiaj', value: String(summary.newToday), note: 'od północy' },
    { label: 'Otwarte teraz', value: String(summary.openBacklog), note: 'nowe i w trakcie' },
    { label: 'Czas do rozwiązania', value: formatHours(summary.timeToResolve.medianHours), note: durationNote(summary.timeToResolve) },
    { label: 'Pierwsza reakcja', value: formatHours(summary.timeToFirstResponse.medianHours), note: durationNote(summary.timeToFirstResponse) },
    { label: 'Rozwiązane', value: formatRate(summary.resolvedRate), note: `odrzucone ${formatRate(summary.rejectedRate)}` },
    { label: 'Ze zrzutem ekranu', value: formatRate(summary.screenshotRate), note: 'bez skasowanych' },
  ]

  return (
    <dl className="stat-tiles">
      {tiles.map((tile) => (
        <div key={tile.label}>
          <dt>{tile.label}</dt>
          <dd className="stat-value">{tile.value}</dd>
          <dd className="stat-note">{tile.note}</dd>
        </div>
      ))}
    </dl>
  )
}

function ProjectAnalyticsPage() {
  const { projectId = '' } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const range = parseRange(searchParams.get('range'))
  const includeToday = searchParams.get('today') !== '0'
  const { analytics, error, loading } = useProjectAnalytics(projectId, range, includeToday)

  // domyślne wartości nie trafiają do adresu żeby link do analityki był krótki
  function updateView(nextRange: AnalyticsRange, nextIncludeToday: boolean) {
    const params: Record<string, string> = {}

    if (nextRange !== defaultAnalyticsRange) params.range = nextRange
    if (!nextIncludeToday) params.today = '0'

    setSearchParams(params, { replace: true })
  }

  const file = (section: string) => `analityka-${section}-${range}${includeToday ? '' : '-bez-dzisiaj'}.csv`

  return (
    <>
      <div className="list-heading">
        <h2>Analityka</h2>
        <Link to={`/projects/${projectId}/tickets`}>Zgłoszenia</Link>
      </div>

      <div className="analytics-controls">
        <div className="analytics-ranges" role="group" aria-label="Zakres">
          {analyticsRanges.map((value) => (
            <button key={value} type="button" aria-pressed={value === range} onClick={() => updateView(value, includeToday)}>
              {rangeLabels[value]}
            </button>
          ))}
        </div>

        <label>
          <input
            type="checkbox"
            checked={includeToday}
            onChange={(event) => updateView(range, event.target.checked)}
          />
          Z dzisiejszym dniem
        </label>
      </div>

      {error && <p role="alert">Nie udało się pobrać analityki. {error}</p>}

      {!analytics && loading && <p>Ładowanie...</p>}

      {analytics && (
        <div className={loading ? 'is-stale' : undefined} aria-busy={loading}>
          <AnalyticsSummary analytics={analytics} />

          <div className="analytics-sections">
            <AnalyticsTable
              title="Statusy"
              fileName={file('statusy')}
              header={['Status', 'Zgłoszenia']}
              rows={analytics.statuses.map((item) => [formatStatus(item.status), item.count])}
            />
            <AnalyticsTable
              title="Najczęstsze strony"
              fileName={file('strony')}
              header={['Strona', 'Zgłoszenia']}
              rows={analytics.topPages.map((item) => [item.page, item.count])}
            />
            <AnalyticsTable
              title="Strony z przyrostem"
              fileName={file('przyrost')}
              header={['Strona', 'Teraz', 'Poprzednio']}
              rows={analytics.risingPages.map((item) => [item.page, item.current, item.previous])}
            />
            <AnalyticsTable
              title="Przeglądarki"
              fileName={file('przegladarki')}
              header={['Przeglądarka', 'Zgłoszenia']}
              rows={nameRows(analytics.browsers)}
            />
            <AnalyticsTable
              title="Systemy"
              fileName={file('systemy')}
              header={['System', 'Zgłoszenia']}
              rows={nameRows(analytics.operatingSystems)}
            />
            <AnalyticsTable
              title="Urządzenia"
              fileName={file('urzadzenia')}
              header={['Urządzenie', 'Zgłoszenia']}
              rows={nameRows(analytics.devices, (name) => deviceLabels[name] ?? name)}
            />
            <AnalyticsTable
              title="Sanityzacja"
              fileName={file('sanityzacja')}
              header={['Reguła', 'Zakres', 'Trafienia', 'Zgłoszenia']}
              rows={analytics.sanitization.map((item) => [
                item.pattern,
                item.isGlobal ? 'globalna' : 'projektowa',
                item.matches,
                item.tickets,
              ])}
            />
            <AnalyticsTable
              title={analytics.bucket === 'week' ? 'Nowe i rozwiązane w tygodniach' : 'Nowe i rozwiązane w dniach'}
              fileName={file('w-czasie')}
              header={[analytics.bucket === 'week' ? 'Tydzień od' : 'Dzień', 'Nowe', 'Rozwiązane']}
              rows={analytics.timeline.map((point) => [point.date, point.created, point.resolved])}
            />
          </div>
        </div>
      )}
    </>
  )
}

export default ProjectAnalyticsPage
