import { Image, MessageSquare } from 'lucide-react'
import { Link } from 'react-router'
import { formatDateTime, formatRelativeTime } from '../format'
import type { TicketListState } from '../navigation'
import type { TicketListItem } from '../types'
import StatusBadge from './StatusBadge'

interface TicketTableProps {
  projectId: string
  items: TicketListItem[]
  listSearch: string
}

function TicketTable({ projectId, items, listSearch }: TicketTableProps) {
  const state: TicketListState = { listSearch }

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
        </tr>
      </thead>
      <tbody>
        {items.map((ticket) => {
          const reported = ticket.reportedAt ?? ticket.receivedAt

          return (
            <tr
              key={ticket.id}
              className="border-b last:border-0 hover:bg-accent/40 focus-within:bg-accent/40"
            >
              <td className="py-2.5 pr-3 pl-3 align-top">
                <StatusBadge status={ticket.status} />
              </td>

              <td className="w-[45%] py-2.5 pr-3 align-top">
                <Link
                  to={`/projects/${projectId}/tickets/${ticket.id}`}
                  state={state}
                  className="font-medium text-foreground hover:text-primary hover:underline"
                >
                  {ticket.description}
                </Link>
              </td>

              <td className="w-[30%] max-w-0 py-2.5 pr-3 align-top">
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

              <td className="py-2.5 pr-3 align-top text-xs whitespace-nowrap text-muted-foreground">
                <time dateTime={reported} title={formatDateTime(reported)}>
                  {formatRelativeTime(reported)}
                </time>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

export default TicketTable
