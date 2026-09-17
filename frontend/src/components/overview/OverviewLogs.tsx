import { Terminal } from 'lucide-react'
import { cn } from 'cn'
import { countByLevel, logLevels, parseConsoleLog, type LogLevel } from '../../consoleLog'

interface OverviewLogsProps {
  text: string | null
  loading: boolean
  onOpen: (level: LogLevel | null) => void
}

const levelText: Record<LogLevel, string> = {
  ERROR: 'text-destructive',
  WARN: 'text-warning',
  INFO: 'text-primary',
  DEBUG: 'text-muted-foreground',
}

// powierzchnia w duchu terminala, bo trescia sa tu logi a nie opis produktu
function OverviewLogs({ text, loading, onOpen }: OverviewLogsProps) {
  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center rounded-lg border bg-card text-sm text-muted-foreground">
        Pobieranie logu konsoli...
      </div>
    )
  }

  if (text === null) {
    return (
      <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-card text-sm text-muted-foreground">
        <Terminal aria-hidden="true" className="size-5" />
        Zgłoszenie nie ma logu konsoli.
      </div>
    )
  }

  const entries = parseConsoleLog(text)

  // plik jest, ale nie ma w nim ani jednego wpisu w formacie widgetu
  if (entries.length === 0) {
    return (
      <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-card px-4 text-center text-sm text-muted-foreground">
        <Terminal aria-hidden="true" className="size-5" />
        Log konsoli ma nieznany format i nie da się go rozłożyć na wpisy.
      </div>
    )
  }

  const counts = countByLevel(entries)
  // bledy ida pierwsze bo po nie sie tu wchodzi, ale kadr dopelniamy reszta zeby nie zostawal pusty
  const errors = entries.filter((entry) => entry.level === 'ERROR')
  const shown = [...errors, ...entries.filter((entry) => entry.level !== 'ERROR')].slice(0, 3)

  return (
    <div className="flex h-48 flex-col overflow-hidden rounded-lg border bg-card">
      <div className="flex items-center gap-2 border-b px-3 py-1.5">
        <Terminal aria-hidden="true" className="size-3.5 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Log konsoli</span>
        <span className="ml-auto flex gap-1">
          {logLevels
            .filter((level) => counts[level] > 0)
            .map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => onOpen(level)}
                aria-label={`Pokaż wpisy ${level} w logu konsoli`}
                className={cn(
                  'rounded border px-1.5 font-mono text-xs transition-colors hover:bg-accent',
                  levelText[level],
                )}
              >
                {level} {counts[level]}
              </button>
            ))}
        </span>
      </div>

      <button
        type="button"
        onClick={() => onOpen(null)}
        aria-label="Otwórz pełny log konsoli"
        className="flex min-h-0 flex-1 flex-col items-start justify-start gap-0.5 overflow-hidden px-3 py-2 text-left font-mono text-xs transition-colors hover:bg-accent/40"
      >
        {shown.map((entry) => (
          <span key={entry.index} className="block max-w-full truncate">
            <span className={levelText[entry.level]}>{entry.level}</span> {entry.message}
          </span>
        ))}
        {entries.length > shown.length && (
          <span className="block max-w-full pt-1 text-muted-foreground">
            i {entries.length - shown.length} dalszych wpisów
          </span>
        )}
      </button>
    </div>
  )
}

export default OverviewLogs
