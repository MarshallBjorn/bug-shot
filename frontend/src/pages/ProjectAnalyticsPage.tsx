import { useParams, useSearchParams } from 'react-router'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import HorizontalBars, { type BarDatum } from '../components/charts/HorizontalBars'
import TimelineChart from '../components/charts/TimelineChart'
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

// statusy maja zastrzezona palete, wiec nie ida jednym hue jak zwykla seria
const statusTones: Record<string, string> = {
  New: 'var(--color-primary)',
  InProgress: 'var(--color-warning)',
  Resolved: 'var(--color-success)',
  Rejected: 'var(--color-destructive)',
  Deleted: 'var(--color-muted-foreground)',
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
  // slupki sa skrotem do porownania, a tabela zostaje jako pelny odczyt i zrodlo CSV
  bars?: BarDatum[]
}

function AnalyticsTable({ title, fileName, header, rows, bars }: AnalyticsTableProps) {
  const table = (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b">
          {header.map((column) => (
            <th key={column} scope="col" className="py-1.5 pr-3 text-left font-medium text-muted-foreground">
              {column}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, rowIndex) => (
          <tr key={rowIndex} className="border-b last:border-0">
            {row.map((cell, cellIndex) => (
              <td key={cellIndex} className="py-1.5 pr-3 align-top">
                {cell ?? ''}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )

  return (
    <section className="space-y-3 rounded-lg border bg-card p-4">
      <div className="flex items-center gap-3">
        <h3 className="text-sm font-semibold">{title}</h3>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="ml-auto h-7 px-2 text-xs"
          aria-label={`Pobierz CSV: ${title}`}
          disabled={rows.length === 0}
          onClick={() => downloadCsv(fileName, toCsv(header, rows))}
        >
          Pobierz CSV
        </Button>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Brak danych w tym zakresie.</p>
      ) : bars ? (
        <>
          <HorizontalBars data={bars} caption={title} />
          <details className="text-sm">
            <summary className="cursor-pointer text-xs text-muted-foreground">
              Pokaż jako tabelę
            </summary>
            <div className="pt-2">{table}</div>
          </details>
        </>
      ) : (
        table
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
    <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {tiles.map((tile) => (
        <div key={tile.label} className="rounded-lg border bg-card px-4 py-3">
          <dt className="text-xs text-muted-foreground">{tile.label}</dt>
          {/* liczba wiodaca bez tabular-nums, bo rowne szerokosci cyfr robia w duzym stopniu dziury */}
          <dd className="text-2xl font-semibold tracking-tight">{tile.value}</dd>
          <dd className="text-xs text-muted-foreground">{tile.note}</dd>
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
    <div className="space-y-4">
      <h2 className="text-xl font-semibold tracking-tight">Analityka</h2>

      {/* filtry ida jednym rzedem nad wykresami, nie w karcie wykresu */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1" role="group" aria-label="Zakres">
          {analyticsRanges.map((value) => (
            <Button
              key={value}
              type="button"
              variant={value === range ? 'default' : 'outline'}
              size="sm"
              aria-pressed={value === range}
              onClick={() => updateView(value, includeToday)}
            >
              {rangeLabels[value]}
            </Button>
          ))}
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-4 accent-primary"
            checked={includeToday}
            onChange={(event) => updateView(range, event.target.checked)}
          />
          Z dzisiejszym dniem
        </label>
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          Nie udało się pobrać analityki. {error}
        </p>
      )}

      {!analytics && loading && (
        <div className="space-y-3" aria-busy="true">
          <span className="sr-only">Ładowanie analityki</span>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {[0, 1, 2, 3].map((tile) => (
              <Skeleton key={tile} className="h-20" />
            ))}
          </div>
          <Skeleton className="h-52" />
        </div>
      )}

      {analytics && (
        <div className={loading ? 'opacity-60' : undefined} aria-busy={loading}>
          <AnalyticsSummary analytics={analytics} />

          <section className="mt-4 space-y-2 rounded-lg border bg-card p-4">
            <h3 className="text-sm font-semibold">
              {analytics.bucket === 'week'
                ? 'Nowe i rozwiązane w tygodniach'
                : 'Nowe i rozwiązane w dniach'}
            </h3>
            <TimelineChart points={analytics.timeline} bucket={analytics.bucket} />
          </section>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <AnalyticsTable
              title="Statusy"
              fileName={file('statusy')}
              header={['Status', 'Zgłoszenia']}
              rows={analytics.statuses.map((item) => [formatStatus(item.status), item.count])}
              bars={analytics.statuses.map((item) => ({
                label: formatStatus(item.status),
                value: item.count,
                tone: statusTones[item.status],
              }))}
            />
            <AnalyticsTable
              title="Najczęstsze strony"
              fileName={file('strony')}
              header={['Strona', 'Zgłoszenia']}
              rows={analytics.topPages.map((item) => [item.page, item.count])}
              bars={analytics.topPages.map((item) => ({ label: item.page, value: item.count }))}
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
              bars={analytics.browsers.map((item) => ({ label: formatName(item.name), value: item.count }))}
            />
            <AnalyticsTable
              title="Systemy"
              fileName={file('systemy')}
              header={['System', 'Zgłoszenia']}
              rows={nameRows(analytics.operatingSystems)}
              bars={analytics.operatingSystems.map((item) => ({ label: formatName(item.name), value: item.count }))}
            />
            <AnalyticsTable
              title="Urządzenia"
              fileName={file('urzadzenia')}
              header={['Urządzenie', 'Zgłoszenia']}
              rows={nameRows(analytics.devices, (name) => deviceLabels[name] ?? name)}
              bars={analytics.devices.map((item) => ({
                label: deviceLabels[item.name] ?? item.name,
                value: item.count,
              }))}
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
              title={analytics.bucket === 'week' ? 'Nowe i rozwiązane, tygodnie' : 'Nowe i rozwiązane, dni'}
              fileName={file('w-czasie')}
              header={[analytics.bucket === 'week' ? 'Tydzień od' : 'Dzień', 'Nowe', 'Rozwiązane']}
              rows={analytics.timeline.map((point) => [point.date, point.created, point.resolved])}
            />
          </div>
        </div>
      )}
    </div>
  )
}

export default ProjectAnalyticsPage
