import { useCallback, useSyncExternalStore } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router'
import { Bookmark, Trash2 } from 'lucide-react'
import { useProjectPages } from '../hooks/useProjectPages'
import {
  removeSavedFilter,
  savedFiltersSnapshot,
  subscribeSavedFilters,
} from '../savedFilters'
import { parseTicketQuery, ticketQueryToParams } from '../ticketQuery'
import type { TicketStatus } from '../types'
import PagesTree from './PagesTree'

interface SidebarProjectProps {
  projectId: string
  onNavigate?: () => void
}

function SidebarProject({ projectId, onNavigate }: SidebarProjectProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const { pages, loading } = useProjectPages(projectId)

  // zapis filtra siedzi w localStorage czyli poza Reactem, wiec panel boczny slucha magazynu
  // zamiast odczytywac go efektem. Dzieki temu zapis z listy widac od razu
  const saved = useSyncExternalStore(subscribeSavedFilters, () => savedFiltersSnapshot(projectId))

  const ticketsPath = `/projects/${projectId}/tickets`
  const onList = location.pathname === ticketsPath

  const selectPage = useCallback(
    (page: string, status: TicketStatus | null) => {
      // filtry z listy zostaja tylko gdy na niej jestesmy, z detalu zaczynamy od czystego zapytania
      const base = onList ? parseTicketQuery(searchParams) : parseTicketQuery(new URLSearchParams())

      const params = ticketQueryToParams({
        ...base,
        page,
        statuses: status ? [status] : base.statuses,
      })

      navigate({ pathname: ticketsPath, search: params.toString() })
      onNavigate?.()
    },
    [navigate, onList, onNavigate, searchParams, ticketsPath],
  )

  const selected = onList ? parseTicketQuery(searchParams).page : ''

  return (
    <>
      <div className="space-y-1">
        <p className="px-2 text-xs font-medium text-muted-foreground">Strony</p>
        <PagesTree pages={pages} loading={loading} selected={selected} onSelect={selectPage} />
      </div>

      {saved.length > 0 && (
        <div className="space-y-1">
          <p className="px-2 text-xs font-medium text-muted-foreground">Zapisane filtry</p>
          <ul className="space-y-0.5">
            {saved.map((filter) => (
              <li key={filter.name} className="flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => {
                    navigate({ pathname: ticketsPath, search: filter.search })
                    onNavigate?.()
                  }}
                  className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  <Bookmark aria-hidden="true" className="size-3.5 shrink-0" />
                  <span className="truncate">{filter.name}</span>
                </button>
                <button
                  type="button"
                  aria-label={`Usuń zapisany filtr ${filter.name}`}
                  onClick={() => removeSavedFilter(projectId, filter.name)}
                  className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-destructive"
                >
                  <Trash2 aria-hidden="true" className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  )
}

export default SidebarProject
