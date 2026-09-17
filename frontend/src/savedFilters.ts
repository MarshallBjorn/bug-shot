export interface SavedFilter {
  name: string
  // caly query string listy, wiec zapis nie musi znac ksztaltu filtrow
  search: string
}

const maxFilters = 20

// filtry sa per projekt zeby zapisy z jednego nie wyskakiwaly w drugim
function storageKey(projectId: string) {
  return `bugshot-filters:${projectId}`
}

function isFilter(value: unknown): value is SavedFilter {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as SavedFilter).name === 'string' &&
    typeof (value as SavedFilter).search === 'string'
  )
}

// prywatne okno rzuca przy samym siegnieciu po magazyn a obcy zapis moze byc czymkolwiek
export function readSavedFilters(projectId: string): SavedFilter[] {
  try {
    const raw = localStorage.getItem(storageKey(projectId))

    if (!raw) return []

    const parsed: unknown = JSON.parse(raw)

    return Array.isArray(parsed) ? parsed.filter(isFilter).slice(0, maxFilters) : []
  } catch {
    return []
  }
}

// useSyncExternalStore wymaga stabilnej referencji miedzy renderami wiec odczyt idzie przez cache
const cache = new Map<string, SavedFilter[]>()
const listeners = new Set<() => void>()

export function subscribeSavedFilters(listener: () => void) {
  listeners.add(listener)

  return () => {
    listeners.delete(listener)
  }
}

export function savedFiltersSnapshot(projectId: string): SavedFilter[] {
  const cached = cache.get(projectId)

  if (cached) {
    return cached
  }

  const filters = readSavedFilters(projectId)
  cache.set(projectId, filters)

  return filters
}

function write(projectId: string, filters: SavedFilter[]) {
  try {
    localStorage.setItem(storageKey(projectId), JSON.stringify(filters))
  } catch {
    // brak zapisu gubi tylko wygode i nie psuje listy
  }

  cache.set(projectId, filters)
  listeners.forEach((listener) => listener())

  return filters
}

export function saveFilter(projectId: string, name: string, search: string): SavedFilter[] {
  const trimmed = name.trim()

  if (!trimmed) {
    return readSavedFilters(projectId)
  }

  // ta sama nazwa nadpisuje wpis zamiast mnozyc pozycje o identycznej etykiecie
  const rest = readSavedFilters(projectId).filter((filter) => filter.name !== trimmed)

  return write(projectId, [{ name: trimmed, search }, ...rest].slice(0, maxFilters))
}

export function removeSavedFilter(projectId: string, name: string): SavedFilter[] {
  return write(
    projectId,
    readSavedFilters(projectId).filter((filter) => filter.name !== name),
  )
}
