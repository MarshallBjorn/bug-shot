import { useParams } from 'react-router'

function TicketListPage() {
  const { projectId } = useParams()

  return (
    <>
      <h2>Zgłoszenia</h2>
      <p>Projekt {projectId}</p>
    </>
  )
}

export default TicketListPage
