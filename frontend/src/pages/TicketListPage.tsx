import { useParams } from 'react-router'
import TicketTable from '../components/TicketTable'
import { useTickets } from '../hooks/useTickets'

function TicketListPage() {
  const { projectId = '' } = useParams()
  const tickets = useTickets(projectId)

  return (
    <>
      <h2>Zgłoszenia</h2>
      {tickets.status === 'loading' && <p>Ładowanie...</p>}
      {tickets.status === 'error' && (
        <p role="alert">Nie udało się pobrać zgłoszeń. {tickets.message}</p>
      )}
      {tickets.status === 'loaded' && (
        <>
          <p>Wyświetlane {tickets.result.items.length} z {tickets.result.total}</p>
          <TicketTable projectId={projectId} items={tickets.result.items} />
        </>
      )}
    </>
  )
}

export default TicketListPage
