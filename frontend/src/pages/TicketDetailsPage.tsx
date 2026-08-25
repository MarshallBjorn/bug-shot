import { Link, useParams } from 'react-router'

function TicketDetailsPage() {
  const { projectId, ticketId } = useParams()

  return (
    <>
      <h2>Zgłoszenie {ticketId}</h2>
      <Link to={`/projects/${projectId}/tickets`}>Wróć do listy</Link>
    </>
  )
}

export default TicketDetailsPage
