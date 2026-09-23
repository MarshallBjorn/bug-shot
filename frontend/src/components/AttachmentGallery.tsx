import { useState } from 'react'
import { FileText } from 'lucide-react'
import { formatAttachmentKind, formatFileSize } from '../format'
import { useAttachment } from '../hooks/useAttachment'
import { isImage } from '../media'
import type { TicketAttachment } from '../types'
import AttachmentDownload from './AttachmentDownload'
import AttachmentLightbox from './AttachmentLightbox'

interface AttachmentGalleryProps {
  attachments: TicketAttachment[]
}

// podglad wchodzi na strone od razu bo bez bajtow nie ma czego pokazac
function AttachmentPreview({ attachment }: { attachment: TicketAttachment }) {
  const { url, failed } = useAttachment(attachment.id)

  if (failed) {
    return <span className="text-xs text-muted-foreground">Nie udało się pobrać</span>
  }

  if (!url) {
    return <span className="text-xs text-muted-foreground">Pobieranie...</span>
  }

  return (
    <img
      alt={attachment.fileName}
      src={url}
      className="h-32 w-full rounded-md border object-cover"
    />
  )
}

function AttachmentGallery({ attachments }: AttachmentGalleryProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  if (attachments.length === 0) {
    return <p className="text-sm text-muted-foreground">Zgłoszenie nie ma załączników.</p>
  }

  const images = attachments.filter((attachment) => isImage(attachment.contentType))

  return (
    <>
      <ul
        aria-label="Załączniki"
        className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
      >
        {attachments.map((attachment) => {
          const imageIndex = images.indexOf(attachment)

          return (
            <li key={attachment.id} className="space-y-1">
              {imageIndex >= 0 ? (
                <button
                  type="button"
                  onClick={() => setOpenIndex(imageIndex)}
                  aria-label={`Otwórz podgląd ${attachment.fileName}`}
                  className="block w-full overflow-hidden rounded-md transition-opacity hover:opacity-90"
                >
                  <AttachmentPreview attachment={attachment} />
                </button>
              ) : (
                <div className="flex h-32 items-center justify-center rounded-md border bg-muted">
                  <FileText aria-hidden="true" className="size-6 text-muted-foreground" />
                </div>
              )}

              <p className="text-xs">
                <AttachmentDownload attachment={attachment} label={attachment.fileName} />
                <span className="block text-muted-foreground">
                  {formatAttachmentKind(attachment.kind)},{' '}
                  <code className="font-mono">{attachment.contentType}</code>,{' '}
                  {formatFileSize(attachment.sizeBytes)}
                </span>
              </p>
            </li>
          )
        })}
      </ul>

      <AttachmentLightbox
        attachments={images}
        openIndex={openIndex}
        onOpenChange={setOpenIndex}
      />
    </>
  )
}

export default AttachmentGallery
