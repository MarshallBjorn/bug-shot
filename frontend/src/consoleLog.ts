export const logLevels = ['ERROR', 'WARN', 'INFO', 'DEBUG'] as const

export type LogLevel = (typeof logLevels)[number]

export interface LogField {
  name: string
  value: string
}

export interface LogEntry {
  index: number
  timestamp: string
  level: LogLevel
  source: string
  message: string
  // pary key=value z window.onerror rozbite na pola, zeby nie czytac ich z jednej dlugiej linii
  fields: LogField[]
  stack: string[]
  json: string | null
  truncated: boolean
}

// format pochodzi z widget/widget.js, funkcja formatDiagnosticEntry
const header = /^\[([^\]]+)\] (ERROR|WARN|INFO|DEBUG) ([^:]+): ([\s\S]*)$/

const truncatedSuffix = ' [truncated]'

function isLevel(value: string): value is LogLevel {
  return (logLevels as readonly string[]).includes(value)
}

// window.onerror sklada szczegoly w pary rozdzielone pionowa kreska
function splitFields(message: string): { text: string; fields: LogField[]; stack: string[] } {
  const parts = message.split(' | ')

  if (parts.length === 1) {
    return { text: message, fields: [], stack: [] }
  }

  const fields: LogField[] = []
  const stack: string[] = []
  const rest: string[] = []

  for (const part of parts) {
    const match = /^([a-zA-Z][a-zA-Z0-9_]*)=([\s\S]*)$/.exec(part)

    if (!match) {
      rest.push(part)
      continue
    }

    const [, name, value] = match

    if (name === 'stack') {
      stack.push(...splitStack(value))
      continue
    }

    fields.push({ name, value })
  }

  return { text: rest.join(' | '), fields, stack }
}

// ramki schodza w jednej linii po slowie at wiec dzielimy po nim a nie po zlamaniu wiersza
export function splitStack(value: string): string[] {
  return value
    .split(/\n|(?= at )/)
    .map((frame) => frame.trim())
    .filter(Boolean)
}

function findJson(message: string): string | null {
  const trimmed = message.trim()

  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
    return null
  }

  try {
    return JSON.stringify(JSON.parse(trimmed), null, 2)
  } catch {
    return null
  }
}

export function parseConsoleLog(text: string): LogEntry[] {
  const entries: LogEntry[] = []

  for (const line of text.split('\n')) {
    const match = header.exec(line)

    if (!match) {
      // linia bez naglowka nalezy do poprzedniego wpisu, bo zwykly string z konsoli
      // moze miec surowe zlamania wiersza. Bez tego parser rozjechalby sie na pierwszym z nich
      const previous = entries.at(-1)

      if (previous && line !== '') {
        previous.message = `${previous.message}\n${line}`
      }

      continue
    }

    const [, timestamp, level, source, rawMessage] = match

    if (!isLevel(level)) {
      continue
    }

    entries.push({
      index: entries.length,
      timestamp,
      level,
      source: source.trim(),
      message: rawMessage,
      fields: [],
      stack: [],
      json: null,
      truncated: false,
    })
  }

  // pola i JSON liczymy po scaleniu kontynuacji, inaczej urwalyby sie w polowie
  return entries.map((entry) => {
    const truncated = entry.message.endsWith(truncatedSuffix)
    const message = truncated ? entry.message.slice(0, -truncatedSuffix.length) : entry.message

    const split = splitFields(message)
    const json = findJson(split.text)

    return {
      ...entry,
      message: split.text,
      fields: split.fields,
      stack: split.stack,
      json,
      truncated,
    }
  })
}

export function countByLevel(entries: LogEntry[]): Record<LogLevel, number> {
  const counts: Record<LogLevel, number> = { ERROR: 0, WARN: 0, INFO: 0, DEBUG: 0 }

  for (const entry of entries) {
    counts[entry.level] += 1
  }

  return counts
}

export function logSources(entries: LogEntry[]): string[] {
  return [...new Set(entries.map((entry) => entry.source))].sort()
}

export interface LogFilter {
  levels: LogLevel[]
  source: string
  search: string
}

export function filterEntries(entries: LogEntry[], filter: LogFilter): LogEntry[] {
  const phrase = filter.search.trim().toLowerCase()

  return entries.filter((entry) => {
    if (filter.levels.length > 0 && !filter.levels.includes(entry.level)) {
      return false
    }

    if (filter.source !== '' && entry.source !== filter.source) {
      return false
    }

    if (phrase === '') {
      return true
    }

    return (
      entry.message.toLowerCase().includes(phrase) ||
      entry.source.toLowerCase().includes(phrase) ||
      entry.fields.some((field) => field.value.toLowerCase().includes(phrase)) ||
      entry.stack.some((frame) => frame.toLowerCase().includes(phrase))
    )
  })
}

// czas liczy sie wzgledem pierwszego wpisu bo przy czytaniu logu liczy sie odstep a nie zegar
export function offsetFromStart(entries: LogEntry[], entry: LogEntry): string {
  const first = entries[0]

  if (!first) {
    return ''
  }

  const start = Date.parse(first.timestamp)
  const at = Date.parse(entry.timestamp)

  if (Number.isNaN(start) || Number.isNaN(at)) {
    return ''
  }

  const seconds = (at - start) / 1000

  return `+${seconds.toFixed(seconds < 10 ? 2 : 1)}s`
}
