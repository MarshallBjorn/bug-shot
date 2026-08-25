import { useParams } from 'react-router'
import TicketTable from '../components/TicketTable'
import { mockTickets } from '../mocks/tickets'

function TicketListPage() {
  const { projectId = '' } = useParams()

  return (
    <>
      <h2>Zgłoszenia</h2>
      <p>Wyświetlane {mockTickets.items.length} z {mockTickets.total}</p>
      <TicketTable projectId={projectId} items={mockTickets.items} />
    </>
  )
}

export default TicketListPage
