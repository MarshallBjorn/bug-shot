import { useMemo, useState } from 'react'
import { AlertCircle, Copy, WrapText } from 'lucide-react'
import { cn } from 'cn'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  countByLevel,
  filterEntries,
  logLevels,
  logSources,
  offsetFromStart,
  parseConsoleLog,
  type LogEntry,
  type LogLevel,
} from '../consoleLog'
import { formatDateTime } from '../format'
import FilterSelect from './FilterSelect'
import JsonBlock from './JsonBlock'

interface ConsoleLogViewerProps {
  text: string
  initialLevel?: LogLevel | null
}

// ta sama rampa co statusy, wiec czerwony znaczy blad w calym panelu
const levelTones: Record<LogLevel, string> = {
  ERROR: 'border-l-destructive',
  WARN: 'border-l-warning',
  INFO: 'border-l-primary',
  DEBUG: 'border-l-border',
}

const levelText: Record<LogLevel, string> = {
  ERROR: 'text-destructive',
  WARN: 'text-warning',
  INFO: 'text-primary',
  DEBUG: 'text-muted-foreground',
}

function Entry({
  entry,
  offset,
  wrap,
}: {
  entry: LogEntry
  offset: string
  wrap: boolean
}) {
  return (
    <li className={cn('border-l-2 px-3 py-1.5', levelTones[entry.level])}>
      <div className="flex gap-3 font-mono text-xs">
        <span
          className="w-16 shrink-0 text-right text-muted-foreground tabular-nums"
          title={formatDateTime(entry.timestamp)}
        >
          {offset}
        </span>
        <span className={cn('w-12 shrink-0 font-medium', levelText[entry.level])}>
          {entry.level}
        </span>
        <span className="w-40 shrink-0 truncate text-muted-foreground" title={entry.source}>
          {entry.source}
        </span>
        <span className={cn('min-w-0 flex-1', wrap ? 'break-words whitespace-pre-wrap' : 'truncate')}>
          {entry.message}
        </span>
      </div>

      {entry.fields.length > 0 && (
        <dl className="mt-1 ml-[8.5rem] grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 font-mono text-xs">
          {entry.fields.map((field) => (
            <div key={field.name} className="col-span-2 flex gap-3">
              <dt className="text-muted-foreground">{field.name}</dt>
              <dd className="min-w-0 break-all">{field.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {entry.stack.length > 0 && (
        <ul className="mt-1 ml-[8.5rem] space-y-0.5 font-mono text-xs text-muted-foreground">
          {entry.stack.map((frame, index) => (
            <li key={index} className="break-all">
              {frame}
            </li>
          ))}
        </ul>
      )}

      {entry.json && (
        <div className="mt-1 ml-[8.5rem]">
          <JsonBlock json={entry.json} />
        </div>
      )}

      {entry.truncated && (
        <p className="mt-1 ml-[8.5rem] text-xs text-muted-foreground">
          Wpis został przycięty przez widget przy limicie rozmiaru.
        </p>
      )}
    </li>
  )
}

function ConsoleLogViewer({ text, initialLevel = null }: ConsoleLogViewerProps) {
  const entries = useMemo(() => parseConsoleLog(text), [text])
  const counts = useMemo(() => countByLevel(entries), [entries])
  const sources = useMemo(() => logSources(entries), [entries])

  const [levels, setLevels] = useState<LogLevel[]>(initialLevel ? [initialLevel] : [])
  const [source, setSource] = useState('')
  const [search, setSearch] = useState('')
  const [wrap, setWrap] = useState(true)

  const visible = useMemo(
    () => filterEntries(entries, { levels, source, search }),
    [entries, levels, source, search],
  )

  function toggleLevel(level: LogLevel) {
    setLevels((previous) =>
      previous.includes(level)
        ? previous.filter((candidate) => candidate !== level)
        : [...previous, level],
    )
  }

  async function copyAll() {
    try {
      await navigator.clipboard.writeText(visible.map((entry) => entry.message).join('\n'))
    } catch {
      // brak zgody na schowek nie psuje widoku
    }
  }

  if (entries.length === 0) {
    return (
      <p className="flex items-center gap-2 rounded-md border border-dashed px-3 py-6 text-sm text-muted-foreground">
        <AlertCircle aria-hidden="true" className="size-4" />
        Log konsoli jest pusty albo ma nieznany format.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Poziom</span>
          <div className="flex gap-1">
            {logLevels.map((level) => (
              <button
                key={level}
                type="button"
                aria-pressed={levels.includes(level)}
                onClick={() => toggleLevel(level)}
                className={cn(
                  'inline-flex items-center gap-1 rounded-md border px-2 py-1 font-mono text-xs transition-colors',
                  levels.includes(level)
                    ? 'border-ring bg-accent'
                    : 'bg-card hover:bg-accent/60',
                  levelText[level],
                )}
              >
                {level}
                <span className="tabular-nums opacity-70">{counts[level]}</span>
              </button>
            ))}
          </div>
        </div>

        <FilterSelect label="Źródło" value={source} onChange={setSource}>
          <option value="">Wszystkie</option>
          {sources.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </FilterSelect>

        <label className="flex min-w-48 flex-1 flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Szukaj w logu</span>
          <Input
            type="search"
            value={search}
            placeholder="Treść, źródło albo ramka stosu"
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>

        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-pressed={wrap}
          onClick={() => setWrap((previous) => !previous)}
        >
          <WrapText aria-hidden="true" />
          Zawijaj
        </Button>

        <Button type="button" variant="outline" size="sm" onClick={copyAll}>
          <Copy aria-hidden="true" />
          Kopiuj
        </Button>
      </div>

      <p className="text-xs text-muted-foreground" aria-live="polite">
        {visible.length === entries.length
          ? `${entries.length} wpisów`
          : `${visible.length} z ${entries.length} wpisów`}
      </p>

      {visible.length === 0 ? (
        <p className="rounded-md border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
          Żaden wpis nie pasuje do filtrów.
        </p>
      ) : (
        <ul aria-label="Wpisy logu konsoli" className="divide-y rounded-lg border bg-card">
          {visible.map((entry) => (
            <Entry
              key={entry.index}
              entry={entry}
              offset={offsetFromStart(entries, entry)}
              wrap={wrap}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

export default ConsoleLogViewer
