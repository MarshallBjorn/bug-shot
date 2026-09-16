import { useEffect, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { addTicketComment, deleteTicket, getTicketComments, updateTicketStatus } from '../api/tickets'
import { ApiError } from '../api/client'
import AttachmentDownload from '../components/AttachmentDownload'
import AttachmentGallery from '../components/AttachmentGallery'
import { formatDateTime, formatStatus } from '../format'
import { useTicket } from '../hooks/useTicket'
import { readListSearch } from '../navigation'
import type { TicketComment, TicketStatus } from '../types'

function TicketDetailsPage() {
  const { projectId = '', ticketId = '' } = useParams()
  const { state } = useLocation()
  const navigate = useNavigate()
  const { ticket, missing, error, loading, reload } = useTicket(ticketId)

  const [comments, setComments] = useState<TicketComment[]>([])
  const [commentsTicketId, setCommentsTicketId] = useState('')
  const [commentsError, setCommentsError] = useState<string | null>(null)
  const [commentAuthor, setCommentAuthor] = useState('')
  const [commentBody, setCommentBody] = useState('')
  const [addingComment, setAddingComment] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [statusError, setStatusError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const statusOptions: TicketStatus[] = [
    'New',
    'InProgress',
    'Resolved',
    'Rejected',
  ]

  const statusChangedBy = 'dashboard'

  useEffect(() => {
    if (!toast) {
      return
    }

    const timeout = window.setTimeout(() => {
      setToast(null)
    }, 4000)

    return () => window.clearTimeout(timeout)
  }, [toast])

  useEffect(() => {
    if (!ticketId || !ticket) {
      return
    }

    const controller = new AbortController()

    getTicketComments(ticketId, 1, 50, controller.signal)
      .then((result) => {
        setComments(result.items)
        setCommentsTicketId(ticketId)
        setCommentsError(null)
      })
      .catch((cause: Error) => {
        if (controller.signal.aborted) {
          return
        }

        setComments([])
        setCommentsTicketId(ticketId)
        setCommentsError(cause.message)
      })

    return () => controller.abort()
  }, [ticketId, ticket])

  const commentsLoading = commentsTicketId !== ticketId

  const backLink = (
    <Link to={{ pathname: `/projects/${projectId}/tickets`, search: readListSearch(state) }}>
      Wróć do listy
    </Link>
  )

  async function handleAddComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const author = commentAuthor.trim()
    const body = commentBody.trim()

    if (!author || !body || !ticket) {
      return
    }

    setAddingComment(true)
    setCommentsError(null)

    try {
      const comment = await addTicketComment(ticket.id, author, body)

      setComments((current) => [...current, comment])
      setCommentsTicketId(ticket.id)
      setCommentBody('')
    } catch (cause) {
      setCommentsError((cause as Error).message)
    } finally {
      setAddingComment(false)
    }
  }

  async function handleStatusChange(status: TicketStatus) {
    if (!ticket || updatingStatus || status === ticket.status) {
      return
    }

    setUpdatingStatus(true)
    setStatusError(null)

    try {
      await updateTicketStatus(
        ticket.id,
        status,
        ticket.rowVersion,
        statusChangedBy,
      )

      reload()
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 409) {
        setToast('ticket zmieniony przez kogoś innego')
        reload()
      } else {
        setStatusError((cause as Error).message)
      }
    } finally {
      setUpdatingStatus(false)
    }
  }

  async function handleDelete() {
    if (!ticket || deleting) {
      return
    }

    const confirmed = window.confirm('Czy na pewno chcesz usunąć to zgłoszenie?')

    if (!confirmed) {
      return
    }

    const enteredId = window.prompt('Aby potwierdzić usunięcie, wpisz ID ticketu.')

    if (enteredId !== ticket.id) {
      return
    }

    setDeleting(true)
    setCommentsError(null)

    try {
      await deleteTicket(ticket.id)
      navigate(`/projects/${projectId}/tickets`)
    } catch (cause) {
      setCommentsError((cause as Error).message)
      setDeleting(false)
    }
  }

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
      {toast && (
        <div className="ticket-toast" role="status">
          {toast}
        </div>
      )}

      <div className="ticket-details-layout">
        <main>
          <h2>{ticket.description}</h2>
          {backLink}

          <dl className="ticket-meta">
            <dt>Status</dt>
            <dd>
              <select
                aria-label="Status zgłoszenia"
                value={ticket.status}
                onChange={(event) => handleStatusChange(event.target.value as TicketStatus)}
                disabled={updatingStatus || ticket.status === 'Deleted'}
              >
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {formatStatus(status)}
                  </option>
                ))}
              </select>

              {statusError && <span role="alert">{statusError}</span>}
            </dd>

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

          <section>
            <h3>Komentarze</h3>

            {commentsError && <p role="alert">{commentsError}</p>}

            {commentsLoading ? (
              <p>Ładowanie komentarzy...</p>
            ) : comments.length === 0 ? (
              <p>Brak komentarzy.</p>
            ) : (
              <ul className="ticket-comments">
                {comments.map((comment) => (
                  <li key={comment.id}>
                    <div className="ticket-comment-header">
                      <strong>{comment.author}</strong>
                      <time dateTime={comment.createdAt}>
                        {formatDateTime(comment.createdAt)}
                      </time>
                    </div>
                    <p>{comment.body}</p>
                  </li>
                ))}
              </ul>
            )}

            <form className="comment-form" onSubmit={handleAddComment}>
              <label>
                Autor
                <input
                  value={commentAuthor}
                  onChange={(event) => setCommentAuthor(event.target.value)}
                  disabled={addingComment}
                  required
                />
              </label>

              <label>
                Komentarz
                <textarea
                  value={commentBody}
                  onChange={(event) => setCommentBody(event.target.value)}
                  disabled={addingComment}
                  required
                />
              </label>

              <button
                type="submit"
                disabled={addingComment || !commentAuthor.trim() || !commentBody.trim()}
              >
                {addingComment ? 'Dodawanie...' : 'Dodaj komentarz'}
              </button>
            </form>
          </section>

          <h3>Załączniki</h3>
          <AttachmentGallery attachments={ticket.attachments} />

          <h3>Log konsoli</h3>
          {ticket.consoleLog ? (
            <p>
              <AttachmentDownload
                attachment={ticket.consoleLog}
                label="Pobierz log konsoli"
              />
            </p>
          ) : (
            <p>Zgłoszenie nie ma logu konsoli.</p>
          )}

          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting || ticket.status === 'Deleted'}
          >
            {deleting ? 'Usuwanie...' : 'Usuń zgłoszenie'}
          </button>
        </main>

        <aside className="ticket-history">
          <h3>Historia statusów</h3>

          {ticket.statusHistory.length === 0 ? (
            <p>Brak zmian statusu.</p>
          ) : (
            <ul>
              {ticket.statusHistory.map((change) => (
                <li
                  key={`${change.changedAt}-${change.fromStatus}-${change.toStatus}`}
                >
                  <strong>
                    {formatStatus(change.fromStatus)} → {formatStatus(change.toStatus)}
                  </strong>
                  <span>{change.changedBy}</span>
                  <time dateTime={change.changedAt}>
                    {formatDateTime(change.changedAt)}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </>
  )
}

export default TicketDetailsPage
