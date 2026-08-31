import { Link, useLocation, useParams } from 'react-router'
import AttachmentGallery from '../components/AttachmentGallery'
import { formatDateTime, formatStatus } from '../format'
import { useTicket } from '../hooks/useTicket'
import { attachmentUrl } from '../media'
import { readListSearch } from '../navigation'

function TicketDetailsPage() {
  const { projectId = '', ticketId = '' } = useParams()
  const { state } = useLocation()
  const { ticket, missing, error, loading } = useTicket(ticketId)

  const backLink = (
    <Link to={{ pathname: `/projects/${projectId}/tickets`, search: readListSearch(state) }}>
      Wróć do listy
    </Link>
  )

  if (loading) {
    return <p>Ładowanie...</p>
  }

  if (missing) {
    return (
      <>
        <h2>Nie ma takiego zgłoszenia</h2>
        <p>Zgłoszenie zostało skasowane albo link jest nieprawidłowy.</p>
        {backLink}
      </>
    )
  }

  if (error || !ticket) {
    return (
      <>
        <p role="alert">Nie udało się pobrać zgłoszenia. {error}</p>
        {backLink}
      </>
    )
  }

  return (
    <>
      <h2>{ticket.description}</h2>
      {backLink}

      <dl className="ticket-meta">
        <dt>Status</dt>
        <dd>{formatStatus(ticket.status)}</dd>

        <dt>Adres strony</dt>
        <dd>
          <a href={ticket.pageUrl} rel="noreferrer noopener" target="_blank">
            {ticket.pageUrl}
          </a>
        </dd>

        <dt>Przeglądarka</dt>
        <dd>{ticket.userAgent}</dd>

        <dt>Zgłoszono</dt>
        <dd>{formatDateTime(ticket.reportedAt)}</dd>

        <dt>Przyjęto</dt>
        <dd>{formatDateTime(ticket.receivedAt)}</dd>

        <dt>Projekt</dt>
        <dd>{ticket.projectKey}</dd>

        <dt>Komentarze</dt>
        <dd>{ticket.commentCount}</dd>
      </dl>

      <h3>Załączniki</h3>
      <AttachmentGallery attachments={ticket.attachments} />

      <h3>Log konsoli</h3>
      {ticket.consoleLogUri ? (
        <p>
          <a href={attachmentUrl(ticket.consoleLogUri)}>Pobierz log konsoli</a>
        </p>
      ) : (
        <p>Zgłoszenie nie ma logu konsoli.</p>
      )}

      {ticket.statusHistory.length > 0 && (
        <>
          <h3>Historia statusów</h3>
          <ul>
            {ticket.statusHistory.map((change) => (
              <li key={change.changedAt}>
                {formatStatus(change.fromStatus)} na {formatStatus(change.toStatus)}, {change.changedBy},{' '}
                {formatDateTime(change.changedAt)}
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  )
}

export default TicketDetailsPage
