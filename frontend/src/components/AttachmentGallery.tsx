import { formatAttachmentKind, formatFileSize } from '../format'
import { useAttachment } from '../hooks/useAttachment'
import { isImage } from '../media'
import type { TicketAttachment } from '../types'
import AttachmentDownload from './AttachmentDownload'

interface AttachmentGalleryProps {
  attachments: TicketAttachment[]
}

// podgląd wchodzi na stronę od razu bo bez bajtów nie ma czego pokazać
function AttachmentPreview({ attachment }: { attachment: TicketAttachment }) {
  const { url, failed } = useAttachment(attachment.id)

  if (failed) {
    return <span className="attachment-file">Nie udało się pobrać</span>
  }

  if (!url) {
    return <span className="attachment-file">Pobieranie...</span>
  }

  return <img alt={attachment.fileName} src={url} />
}

function AttachmentItem({ attachment }: { attachment: TicketAttachment }) {
  return (
    <li>
      {isImage(attachment.contentType) ? (
        <AttachmentPreview attachment={attachment} />
      ) : (
        <span className="attachment-file">{attachment.contentType}</span>
      )}
      <p className="attachment-meta">
        <AttachmentDownload attachment={attachment} label={attachment.fileName} />
        <br />
        {formatAttachmentKind(attachment.kind)}, {formatFileSize(attachment.sizeBytes)}
      </p>
    </li>
  )
}

function AttachmentGallery({ attachments }: AttachmentGalleryProps) {
  if (attachments.length === 0) {
    return <p>Zgłoszenie nie ma załączników.</p>
  }

  return (
    <ul className="attachments">
      {attachments.map((attachment) => (
        <AttachmentItem attachment={attachment} key={attachment.id} />
      ))}
    </ul>
  )
}

export default AttachmentGallery
