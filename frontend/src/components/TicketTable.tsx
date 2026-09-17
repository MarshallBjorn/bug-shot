import { useEffect, useRef } from 'react'
import { ChevronDown, Image, MessageSquare } from 'lucide-react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { formatDateTime, formatRelativeTime } from '../format'
import type { TicketListState } from '../navigation'
import type { TicketListItem, TicketStatus } from '../types'
import StatusBadge from './StatusBadge'
import TicketStatusMenu from './TicketStatusMenu'

interface TicketTableProps {
  projectId: string
  items: TicketListItem[]
  listSearch: string
  focusedIndex?: number
  statusMenuId?: string | null
  onStatusMenuChange?: (id: string | null) => void
  onPickStatus?: (ticket: TicketListItem, status: TicketStatus) => void
}

function TicketTable({
  projectId,
  items,
  listSearch,
  focusedIndex = -1,
  statusMenuId = null,
  onStatusMenuChange,
  onPickStatus,
}: TicketTableProps) {
  const state: TicketListState = { listSearch }
  const links = useRef<Array<HTMLAnchorElement | null>>([])

  // skrot przesuwa indeks a focus musi pojsc za nim, inaczej czytnik ekranu zostaje w miejscu
  useEffect(() => {
    if (focusedIndex >= 0) {
      links.current[focusedIndex]?.focus()
    }
  }, [focusedIndex])

  return (
    <table aria-label="Lista zgłoszeń" className="w-full border-collapse text-sm">
      <caption className="sr-only">
        Zgłoszenia projektu, ze statusem, adresem strony i czasem zgłoszenia
      </caption>
      <thead className="sr-only">
        <tr>
          <th scope="col">Status</th>
          <th scope="col">Opis</th>
          <th scope="col">Adres strony</th>
          <th scope="col">Załączniki i komentarze</th>
          <th scope="col">Zgłoszono</th>
          <th scope="col">Akcje</th>
        </tr>
      </thead>
      <tbody>
        {items.map((ticket, index) => {
          const reported = ticket.reportedAt ?? ticket.receivedAt

          return (
            <tr
              key={ticket.id}
              className="border-b last:border-0 hover:bg-accent/40 focus-within:bg-accent/40"
            >
              <td className="py-2.5 pr-3 pl-3 align-top">
                <StatusBadge status={ticket.status} />
              </td>

              <td className="w-full py-2.5 pr-3 align-top sm:w-[45%]">
                <Link
                  ref={(node) => {
                    links.current[index] = node
                  }}
                  to={`/projects/${projectId}/tickets/${ticket.id}`}
                  state={state}
                  className="font-medium text-foreground hover:text-primary hover:underline"
                >
                  {ticket.description}
                </Link>

                <span className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-muted-foreground sm:hidden">
                  <span className="font-mono">{ticket.page || ticket.pageUrl}</span>
                  <time dateTime={reported}>{formatRelativeTime(reported)}</time>
                </span>
              </td>

              <td className="hidden w-[30%] max-w-0 py-2.5 pr-3 align-top sm:table-cell">
                <span
                  title={ticket.pageUrl}
                  className="block truncate font-mono text-xs text-muted-foreground"
                >
                  {ticket.page || ticket.pageUrl}
                </span>
              </td>

              <td className="py-2.5 pr-3 align-top whitespace-nowrap">
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  {ticket.hasScreenshot && (
                    <span className="inline-flex items-center gap-0.5" title="Ma zrzut ekranu">
                      <Image aria-hidden="true" className="size-3.5" />
                      <span className="sr-only">Ma zrzut ekranu</span>
                    </span>
                  )}
                  {ticket.commentCount > 0 && (
                    <span
                      className="inline-flex items-center gap-0.5"
                      title={`Komentarze: ${ticket.commentCount}`}
                    >
                      <MessageSquare aria-hidden="true" className="size-3.5" />
                      <span className="tabular-nums">{ticket.commentCount}</span>
                    </span>
                  )}
                </span>
              </td>

              <td className="hidden py-2.5 pr-3 align-top text-xs whitespace-nowrap text-muted-foreground sm:table-cell">
                <time dateTime={reported} title={formatDateTime(reported)}>
                  {formatRelativeTime(reported)}
                </time>
              </td>

              <td className="py-1.5 pr-2 align-top">
                <TicketStatusMenu
                  status={ticket.status}
                  open={statusMenuId === ticket.id}
                  onOpenChange={(open) => onStatusMenuChange?.(open ? ticket.id : null)}
                  onPick={(status) => onPickStatus?.(ticket, status)}
                >
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    aria-label={`Zmień status zgłoszenia ${ticket.description}`}
                  >
                    <ChevronDown aria-hidden="true" />
                  </Button>
                </TicketStatusMenu>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

export default TicketTable
