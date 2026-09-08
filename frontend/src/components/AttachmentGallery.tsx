import { formatAttachmentKind, formatFileSize } from '../format'
import { useAttachment } from '../hooks/useAttachment'
import { isImage } from '../media'
import type { TicketAttachment } from '../types'

interface AttachmentGalleryProps {
  attachments: TicketAttachment[]
}

function AttachmentItem({ attachment }: { attachment: TicketAttachment }) {
  const { url, failed } = useAttachment(attachment.id)

  if (failed) {
    return (
      <li>
        <span className="attachment-file">Nie udało się pobrać</span>
        <p className="attachment-meta">{attachment.fileName}</p>
      </li>
    )
  }

  return (
    <li>
      {url ? (
        <a download={attachment.fileName} href={url}>
          {isImage(attachment.contentType) ? (
            <img alt={attachment.fileName} loading="lazy" src={url} />
          ) : (
            <span className="attachment-file">{attachment.contentType}</span>
          )}
        </a>
      ) : (
        <span className="attachment-file">Pobieranie...</span>
      )}
      <p className="attachment-meta">
        {url ? (
          <a download={attachment.fileName} href={url}>
            {attachment.fileName}
          </a>
        ) : (
          attachment.fileName
        )}
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
