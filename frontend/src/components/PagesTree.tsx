import { useState } from 'react'
import { ChevronRight, FileText } from 'lucide-react'
import { cn } from 'cn'
import { formatStatus } from '../format'
import type { ProjectPageCount } from '../types'
import type { TicketStatus } from '../types'

interface PagesTreeProps {
  pages: ProjectPageCount[]
  loading: boolean
  selected: string
  onSelect: (page: string, status: TicketStatus | null) => void
}

const statusKeys: Array<{ status: TicketStatus; read: (page: ProjectPageCount) => number }> = [
  { status: 'New', read: (page) => page.new },
  { status: 'InProgress', read: (page) => page.inProgress },
  { status: 'Resolved', read: (page) => page.resolved },
  { status: 'Rejected', read: (page) => page.rejected },
]

// drugi segment adresu wystarcza do rozpoznania strony a pelny adres zostaje w tytule
function shortLabel(page: string) {
  const slash = page.indexOf('/')

  return slash === -1 ? page : page.slice(slash)
}

function PageRow({
  page,
  selected,
  onSelect,
}: {
  page: ProjectPageCount
  selected: boolean
  onSelect: PagesTreeProps['onSelect']
}) {
  const [open, setOpen] = useState(false)

  return (
    <li>
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          onClick={() => setOpen((previous) => !previous)}
          aria-expanded={open}
          aria-label={`Rozwiń statusy dla ${page.page}`}
          className="flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        >
          <ChevronRight
            aria-hidden="true"
            className={cn('size-3.5 transition-transform', open && 'rotate-90')}
          />
        </button>

        <button
          type="button"
          onClick={() => onSelect(page.page, null)}
          title={page.page}
          aria-current={selected ? 'true' : undefined}
          className={cn(
            'flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-sm transition-colors',
            selected
              ? 'bg-accent font-medium text-accent-foreground'
              : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
          )}
        >
          <FileText aria-hidden="true" className="size-3.5 shrink-0" />
          <span className="truncate">{shortLabel(page.page)}</span>
          <span className="ml-auto shrink-0 text-xs tabular-nums">{page.total}</span>
        </button>
      </div>

      {open && (
        <ul className="mt-0.5 ml-6 space-y-0.5">
          {statusKeys
            .filter(({ read }) => read(page) > 0)
            .map(({ status, read }) => (
              <li key={status}>
                <button
                  type="button"
                  onClick={() => onSelect(page.page, status)}
                  className="flex w-full items-center gap-1.5 rounded-md px-1.5 py-0.5 text-left text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  <span className="truncate">{formatStatus(status)}</span>
                  <span className="ml-auto tabular-nums">{read(page)}</span>
                </button>
              </li>
            ))}
        </ul>
      )}
    </li>
  )
}

function PagesTree({ pages, loading, selected, onSelect }: PagesTreeProps) {
  if (loading) {
    return <p className="px-2 text-xs text-muted-foreground">Ładowanie stron...</p>
  }

  if (pages.length === 0) {
    return <p className="px-2 text-xs text-muted-foreground">Brak stron ze zgłoszeniami.</p>
  }

  return (
    <ul aria-label="Strony projektu" className="space-y-0.5">
      {pages.map((page) => (
        <PageRow
          key={page.page}
          page={page}
          selected={page.page === selected}
          onSelect={onSelect}
        />
      ))}
    </ul>
  )
}

export default PagesTree
