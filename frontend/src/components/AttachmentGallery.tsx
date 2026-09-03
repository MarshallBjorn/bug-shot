import { formatAttachmentKind, formatFileSize } from '../format'
import { attachmentUrl, isImage } from '../media'
import type { TicketAttachment } from '../types'

interface AttachmentGalleryProps {
  attachments: TicketAttachment[]
}

function AttachmentGallery({ attachments }: AttachmentGalleryProps) {
  if (attachments.length === 0) {
    return <p>Zgłoszenie nie ma załączników.</p>
  }

  return (
    <ul className="attachments">
      {attachments.map((attachment) => {
        const url = attachmentUrl(attachment.uri)

        return (
          <li key={attachment.id}>
            <a href={url}>
              {isImage(attachment.contentType) ? (
                <img src={url} alt={attachment.fileName} loading="lazy" />
              ) : (
                <span className="attachment-file">{attachment.contentType}</span>
              )}
            </a>
            <p className="attachment-meta">
              <a href={url}>{attachment.fileName}</a>
              <br />
              {formatAttachmentKind(attachment.kind)}, {formatFileSize(attachment.sizeBytes)}
            </p>
          </li>
        )
      })}
    </ul>
  )
}

export default AttachmentGallery
