import { niceCeiling } from '../../charts/scale'

export interface BarDatum {
  label: string
  value: number
  // ton uzywany tylko dla statusow, bo te maja zastrzezona palete
  tone?: string
}

interface HorizontalBarsProps {
  data: BarDatum[]
  caption: string
}

// jeden hue dla calej serii, bo kolor per slupek malowalby range a nie tozsamosc
function HorizontalBars({ data, caption }: HorizontalBarsProps) {
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">Brak danych w tym zakresie.</p>
  }

  const top = niceCeiling(Math.max(...data.map((datum) => datum.value)))

  return (
    <ul aria-label={caption} className="space-y-1.5">
      {data.map((datum) => (
        <li key={datum.label} className="grid grid-cols-[minmax(0,11rem)_1fr_auto] items-center gap-2">
          <span className="truncate text-xs text-muted-foreground" title={datum.label}>
            {datum.label}
          </span>

          <span className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
            <span
              className="block h-full rounded-full"
              style={{
                width: `${Math.max(1, (datum.value / top) * 100)}%`,
                backgroundColor: datum.tone ?? 'var(--color-chart-1)',
              }}
            />
          </span>

          <span className="text-xs tabular-nums">{datum.value}</span>
        </li>
      ))}
    </ul>
  )
}

export default HorizontalBars
