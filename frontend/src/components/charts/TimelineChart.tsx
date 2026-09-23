import { useState } from 'react'
import {
  axisTicks,
  linePath,
  nearestIndex,
  scaleX,
  scaleY,
  separateLabels,
} from '../../charts/scale'
import { useElementWidth } from '../../hooks/useElementWidth'

export interface TimelinePoint {
  date: string
  created: number
  resolved: number
}

interface TimelineChartProps {
  points: TimelinePoint[]
  bucket: string
}

const height = 180
const padding = { top: 12, right: 82, bottom: 24, left: 36 }

function formatDay(day: string) {
  const parts = day.split('-')

  return parts.length === 3 ? `${parts[2]}.${parts[1]}` : day
}

function TimelineChart({ points, bucket }: TimelineChartProps) {
  const { ref, width } = useElementWidth()
  const [hover, setHover] = useState<number | null>(null)

  const plotWidth = Math.max(80, width - padding.left - padding.right)
  const plotHeight = height - padding.top - padding.bottom

  const max = Math.max(1, ...points.map((point) => Math.max(point.created, point.resolved)))
  const ticks = axisTicks(max)
  const top = ticks[ticks.length - 1]

  const created = points.map((point) => point.created)
  const resolved = points.map((point) => point.resolved)

  const active = hover === null ? null : points[hover]

  // etykiety przy koncach moga wypasc na tej samej wysokosci, wiec rozsuwamy je
  const [createdLabelY, resolvedLabelY] = separateLabels(
    scaleY(created[created.length - 1] ?? 0, top, plotHeight),
    scaleY(resolved[resolved.length - 1] ?? 0, top, plotHeight),
  )
  const unit = bucket === 'week' ? 'Tydzień' : 'Dzień'

  return (
    <div ref={ref} className="w-full">
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={`Nowe i rozwiązane zgłoszenia, ${points.length} punktów w czasie`}
        className="max-w-full"
      >
        <g transform={`translate(${padding.left} ${padding.top})`}>
          {ticks.map((tick) => {
            const y = scaleY(tick, top, plotHeight)

            return (
              <g key={tick}>
                <line
                  x1={0}
                  x2={plotWidth}
                  y1={y}
                  y2={y}
                  stroke="var(--color-chart-grid)"
                  strokeWidth={1}
                />
                <text
                  x={-8}
                  y={y}
                  textAnchor="end"
                  dominantBaseline="middle"
                  className="fill-muted-foreground text-[10px] tabular-nums"
                >
                  {tick}
                </text>
              </g>
            )
          })}

          <path
            d={linePath(created, top, plotWidth, plotHeight)}
            fill="none"
            stroke="var(--color-chart-1)"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <path
            d={linePath(resolved, top, plotWidth, plotHeight)}
            fill="none"
            stroke="var(--color-chart-2)"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* etykiety przy koncach, bo rozroznialnosc pary przy tritanie jest niska */}
          {points.length > 0 && (
            <>
              <text
                x={plotWidth + 6}
                y={createdLabelY}
                dominantBaseline="middle"
                className="fill-chart-1 text-[10px] font-medium"
              >
                nowe
              </text>
              <text
                x={plotWidth + 6}
                y={resolvedLabelY}
                dominantBaseline="middle"
                className="fill-chart-2 text-[10px] font-medium"
              >
                rozwiązane
              </text>
            </>
          )}

          {active && hover !== null && (
            <g>
              <line
                x1={scaleX(hover, points.length, plotWidth)}
                x2={scaleX(hover, points.length, plotWidth)}
                y1={0}
                y2={plotHeight}
                stroke="var(--color-ring)"
                strokeWidth={1}
              />
              <circle
                cx={scaleX(hover, points.length, plotWidth)}
                cy={scaleY(active.created, top, plotHeight)}
                r={4}
                fill="var(--color-chart-1)"
                stroke="var(--color-card)"
                strokeWidth={2}
              />
              <circle
                cx={scaleX(hover, points.length, plotWidth)}
                cy={scaleY(active.resolved, top, plotHeight)}
                r={4}
                fill="var(--color-chart-2)"
                stroke="var(--color-card)"
                strokeWidth={2}
              />
            </g>
          )}

          {points.length > 0 && (
            <>
              <text
                x={0}
                y={plotHeight + 16}
                className="fill-muted-foreground text-[10px]"
              >
                {formatDay(points[0].date)}
              </text>
              <text
                x={plotWidth}
                y={plotHeight + 16}
                textAnchor="end"
                className="fill-muted-foreground text-[10px]"
              >
                {formatDay(points[points.length - 1].date)}
              </text>
            </>
          )}

          <rect
            x={0}
            y={0}
            width={plotWidth}
            height={plotHeight}
            fill="transparent"
            onMouseMove={(event) => {
              const box = event.currentTarget.getBoundingClientRect()
              setHover(nearestIndex(event.clientX - box.left, points.length, plotWidth))
            }}
            onMouseLeave={() => setHover(null)}
          />
        </g>
      </svg>

      <p aria-live="polite" className="min-h-5 text-xs text-muted-foreground">
        {active
          ? `${unit} ${active.date}, nowe ${active.created}, rozwiązane ${active.resolved}`
          : 'Najedź na wykres, aby zobaczyć liczby z danego dnia.'}
      </p>
    </div>
  )
}

export default TimelineChart
