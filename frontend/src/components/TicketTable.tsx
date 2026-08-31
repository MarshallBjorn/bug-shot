import { Link } from 'react-router'
import { formatDateTime, formatStatus } from '../format'
import type { TicketListState } from '../navigation'
import type { TicketListItem } from '../types'

interface TicketTableProps {
  projectId: string
  items: TicketListItem[]
  listSearch: string
}

function TicketTable({ projectId, items, listSearch }: TicketTableProps) {
  const state: TicketListState = { listSearch }

  return (
    <table className="ticket-table">
      <thead>
        <tr>
          <th>Opis</th>
          <th>Adres strony</th>
          <th>Status</th>
          <th>Zgłoszono</th>
        </tr>
      </thead>
      <tbody>
        {items.map((ticket) => (
          <tr key={ticket.id}>
            <td>
              <Link to={`/projects/${projectId}/tickets/${ticket.id}`} state={state}>
                {ticket.description}
              </Link>
            </td>
            <td>{ticket.pageUrl}</td>
            <td>{formatStatus(ticket.status)}</td>
            <td>{formatDateTime(ticket.reportedAt ?? ticket.receivedAt)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export default TicketTable
