import { useAttachment } from '../hooks/useAttachment'
import type { TicketAttachment } from '../types'

function ConsoleLogLink({ attachment }: { attachment: TicketAttachment }) {
  const { url, failed } = useAttachment(attachment.id)

  if (failed) {
    return <p role="alert">Nie udało się pobrać logu konsoli.</p>
  }

  if (!url) {
    return <p>Pobieranie logu konsoli...</p>
  }

  return (
    <p>
      <a download={attachment.fileName} href={url}>
        Pobierz log konsoli
      </a>
    </p>
  )
}

export default ConsoleLogLink
