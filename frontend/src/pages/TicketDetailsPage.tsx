import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { ArrowLeft, PanelRightClose, PanelRightOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { addTicketComment, deleteTicket, getTicketComments, updateTicketStatus } from '../api/tickets'
import { ApiError } from '../api/client'
import AttachmentGallery from '../components/AttachmentGallery'
import AttachmentLightbox from '../components/AttachmentLightbox'
import CommentForm from '../components/CommentForm'
import ConsoleLogViewer from '../components/ConsoleLogViewer'
import DeleteTicketDialog from '../components/DeleteTicketDialog'
import TicketEnvironment from '../components/TicketEnvironment'
import TicketStatusControl from '../components/TicketStatusControl'
import TicketTimeline from '../components/TicketTimeline'
import OverviewLogs from '../components/overview/OverviewLogs'
import OverviewProject from '../components/overview/OverviewProject'
import OverviewScreenshot from '../components/overview/OverviewScreenshot'
import OverviewTimestamp from '../components/overview/OverviewTimestamp'
import OverviewUrl from '../components/overview/OverviewUrl'
import OverviewUserAgent from '../components/overview/OverviewUserAgent'
import { useAuth } from '../auth/AuthContext'
import type { LogLevel } from '../consoleLog'
import { useAttachmentText } from '../hooks/useAttachmentText'
import { useTicket } from '../hooks/useTicket'
import { isImage } from '../media'
import { readListSearch } from '../navigation'
import { ticketQueryToParams, emptyQuery } from '../ticketQuery'
import type { TicketComment, TicketStatus } from '../types'

function TicketDetailsPage() {
  const { projectId = '', ticketId = '' } = useParams()
  const { state } = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { ticket, missing, error, loading, reload } = useTicket(ticketId)

  const [comments, setComments] = useState<TicketComment[]>([])
  const [commentsTicketId, setCommentsTicketId] = useState('')
  const [commentsError, setCommentsError] = useState<string | null>(null)
  const [addingComment, setAddingComment] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [statusError, setStatusError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [logLevel, setLogLevel] = useState<LogLevel | null>(null)
  const [logOpen, setLogOpen] = useState(false)
  const [railOpen, setRailOpen] = useState(true)

  const author = user?.email ?? 'dashboard'

  useEffect(() => {
    if (!toast) {
      return
    }

    const timeout = window.setTimeout(() => setToast(null), 4000)

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

  const consoleLog = useAttachmentText(ticket?.consoleLog?.id ?? null)

  const images = useMemo(
    () => (ticket?.attachments ?? []).filter((attachment) => isImage(attachment.contentType)),
    [ticket?.attachments],
  )

  const listSearch = readListSearch(state)

  const openList = useCallback(
    (patch: Partial<typeof emptyQuery>) => {
      const params = ticketQueryToParams({ ...emptyQuery, ...patch })

      navigate({ pathname: `/projects/${projectId}/tickets`, search: params.toString() })
    },
    [navigate, projectId],
  )

  async function addComment(body: string) {
    if (!ticket) {
      return
    }

    setAddingComment(true)
    setCommentsError(null)

    try {
      const comment = await addTicketComment(ticket.id, author, body)

      setComments((current) => [...current, comment])
      setCommentsTicketId(ticket.id)
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
      await updateTicketStatus(ticket.id, status, ticket.rowVersion, author)

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

  const backLink = (
    <Link
      to={{ pathname: `/projects/${projectId}/tickets`, search: listSearch }}
      className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft aria-hidden="true" className="size-3.5" />
      Wróć do listy
    </Link>
  )

  if (loading) {
    return <p className="text-sm text-muted-foreground">Ładowanie...</p>
  }

  if (missing) {
    return (
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">Nie ma takiego zgłoszenia</h2>
        <p className="text-sm text-muted-foreground">
          Zgłoszenie zostało skasowane albo link jest nieprawidłowy.
        </p>
        {backLink}
      </div>
    )
  }

  if (error || !ticket) {
    return (
      <div className="space-y-2">
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          Nie udało się pobrać zgłoszenia. {error}
        </p>
        {backLink}
      </div>
    )
  }

  const screenshot = ticket.attachments.find((attachment) => attachment.kind === 'Screenshot') ?? null

  return (
    <div className="space-y-4">
      {toast && (
        <div role="status" className="rounded-md border bg-card px-3 py-2 text-sm">
          {toast}
        </div>
      )}

      <div className="space-y-2">
        {backLink}
        <div className="flex items-start gap-3">
          <h2 className="min-w-0 flex-1 text-xl font-semibold tracking-tight break-words">
            {ticket.description}
          </h2>
          {/* szpalta meta zwija sie, bo przy czytaniu logu liczy sie szerokosc glownej kolumny */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-expanded={railOpen}
            className="hidden shrink-0 lg:inline-flex"
            onClick={() => setRailOpen((previous) => !previous)}
          >
            {railOpen ? (
              <PanelRightClose aria-hidden="true" />
            ) : (
              <PanelRightOpen aria-hidden="true" />
            )}
            {railOpen ? 'Zwiń szczegóły' : 'Rozwiń szczegóły'}
          </Button>
        </div>
      </div>

      <div
        className={
          railOpen
            ? 'lg:grid lg:grid-cols-[minmax(0,1fr)_17rem] lg:gap-6'
            : 'lg:grid lg:grid-cols-[minmax(0,1fr)] lg:gap-6'
        }
      >
        <div className="min-w-0 space-y-5">
          <section aria-label="Przegląd zgłoszenia" className="space-y-3">
            <div className="grid grid-cols-1 divide-y overflow-hidden rounded-lg border bg-card sm:grid-cols-2 sm:divide-x lg:grid-cols-4 lg:divide-y-0">
              <OverviewUrl
                pageUrl={ticket.pageUrl}
                page={ticket.page}
                onFilterByPage={(page) => openList({ page })}
              />
              <OverviewUserAgent
                userAgent={ticket.userAgent}
                environment={ticket.environment}
                onFilterByBrowser={(browser) => openList({ browser })}
              />
              <OverviewTimestamp
                reportedAt={ticket.reportedAt}
                receivedAt={ticket.receivedAt}
                onFilterByDay={(day) => openList({ dateFrom: day, dateTo: day })}
              />
              <OverviewProject projectKey={ticket.projectKey} onOpenProject={() => openList({})} />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <OverviewScreenshot
                screenshot={screenshot}
                onOpen={() => setLightboxIndex(screenshot ? images.indexOf(screenshot) : null)}
              />
              <OverviewLogs
                text={ticket.consoleLog ? consoleLog.text : null}
                loading={consoleLog.loading}
                onOpen={(level) => {
                  setLogLevel(level)
                  setLogOpen(true)
                }}
              />
            </div>
          </section>

          {logOpen && ticket.consoleLog && consoleLog.text !== null && (
            <section aria-label="Log konsoli" className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Log konsoli</h3>
                <Button type="button" variant="ghost" size="sm" onClick={() => setLogOpen(false)}>
                  Zwiń
                </Button>
              </div>
              <ConsoleLogViewer text={consoleLog.text} initialLevel={logLevel} />
            </section>
          )}

          {consoleLog.error && (
            <p role="alert" className="text-sm text-destructive">
              Nie udało się pobrać logu konsoli. {consoleLog.error}
            </p>
          )}

          <section aria-label="Załączniki" className="space-y-2">
            <h3 className="text-sm font-semibold">Załączniki</h3>
            <AttachmentGallery attachments={ticket.attachments} />
          </section>

          <Separator />

          <section aria-label="Historia i komentarze" className="space-y-4">
            <h3 className="text-sm font-semibold">Historia</h3>

            {commentsError && (
              <p role="alert" className="text-sm text-destructive">
                {commentsError}
              </p>
            )}

            <TicketTimeline
              statusHistory={ticket.statusHistory}
              comments={comments}
              loading={commentsLoading}
            />

            {ticket.status !== 'Deleted' && (
              <CommentForm author={author} busy={addingComment} onSubmit={addComment} />
            )}
          </section>
        </div>

        <aside className={railOpen ? 'mt-5 space-y-5 lg:mt-0' : 'mt-5 space-y-5 lg:hidden'}>
          <section aria-label="Status" className="space-y-2">
            <h3 className="text-xs font-medium text-muted-foreground">Status</h3>
            <TicketStatusControl
              status={ticket.status}
              allowed={ticket.allowedStatuses}
              busy={updatingStatus}
              onChange={handleStatusChange}
            />
            {statusError && (
              <p role="alert" className="text-sm text-destructive">
                {statusError}
              </p>
            )}
          </section>

          <section aria-label="Środowisko" className="space-y-2">
            <h3 className="text-xs font-medium text-muted-foreground">Środowisko</h3>
            <TicketEnvironment environment={ticket.environment} userAgent={ticket.userAgent} />
          </section>

          {ticket.status !== 'Deleted' && (
            <section aria-label="Kasowanie" className="space-y-2">
              <h3 className="text-xs font-medium text-muted-foreground">Nieodwracalne</h3>
              <DeleteTicketDialog
                ticketId={ticket.id}
                busy={deleting}
                onConfirm={handleDelete}
              />
            </section>
          )}
        </aside>
      </div>

      <AttachmentLightbox
        attachments={images}
        openIndex={lightboxIndex}
        onOpenChange={setLightboxIndex}
      />
    </div>
  )
}

export default TicketDetailsPage
