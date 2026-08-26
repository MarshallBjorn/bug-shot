import { Link } from 'react-router'
import { formatDateTime, formatStatus } from '../format'
import type { TicketListItem } from '../types'

interface TicketTableProps {
  projectId: string
  items: TicketListItem[]
}

function TicketTable({ projectId, items }: TicketTableProps) {
  if (items.length === 0) {
    return <p>Brak zgłoszeń.</p>
  }

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
              <Link to={`/projects/${projectId}/tickets/${ticket.id}`}>{ticket.description}</Link>
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
