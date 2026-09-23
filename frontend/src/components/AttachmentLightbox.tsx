import { useState } from 'react'
import { ChevronLeft, ChevronRight, Download, Maximize2, Minimize2 } from 'lucide-react'
import { cn } from 'cn'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { formatAttachmentKind, formatFileSize } from '../format'
import { useAttachment } from '../hooks/useAttachment'
import { downloadAttachment } from '../media'
import type { TicketAttachment } from '../types'

interface AttachmentLightboxProps {
  attachments: TicketAttachment[]
  openIndex: number | null
  onOpenChange: (index: number | null) => void
}

function Preview({ attachment, actualSize }: { attachment: TicketAttachment; actualSize: boolean }) {
  const { url, failed } = useAttachment(attachment.id)

  if (failed) {
    return <p className="p-8 text-sm text-muted-foreground">Nie udało się pobrać pliku.</p>
  }

  if (!url) {
    return <p className="p-8 text-sm text-muted-foreground">Pobieranie...</p>
  }

  return (
    <img
      alt={attachment.fileName}
      src={url}
      className={cn(
        'mx-auto',
        actualSize ? 'max-w-none' : 'max-h-[70vh] w-auto max-w-full object-contain',
      )}
    />
  )
}

function AttachmentLightbox({ attachments, openIndex, onOpenChange }: AttachmentLightboxProps) {
  const [actualSize, setActualSize] = useState(false)
  const [shown, setShown] = useState(openIndex)

  const open = openIndex !== null
  const attachment = open ? attachments[openIndex] : undefined

  // skala wraca do dopasowania przy kazdej zmianie pliku, bo poprzedni wybor dotyczyl innego kadru
  // stan dostosowuje sie w trakcie renderu zamiast efektem, wiec nie ma dodatkowego przebiegu
  if (shown !== openIndex) {
    setShown(openIndex)
    setActualSize(false)
  }

  if (!attachment) {
    return null
  }

  function step(by: number) {
    const next = (openIndex! + by + attachments.length) % attachments.length
    onOpenChange(next)
  }

  const many = attachments.length > 1

  return (
    <Dialog open={open} onOpenChange={(next) => onOpenChange(next ? openIndex : null)}>
      <DialogContent
        className="max-h-[90vh] overflow-auto sm:max-w-4xl"
        onKeyDown={(event) => {
          if (!many) return

          if (event.key === 'ArrowRight') {
            event.preventDefault()
            step(1)
          }

          if (event.key === 'ArrowLeft') {
            event.preventDefault()
            step(-1)
          }
        }}
      >
        <DialogTitle className="pr-8 text-sm font-medium break-all">
          {attachment.fileName}
        </DialogTitle>

        <p className="text-xs text-muted-foreground">
          {formatAttachmentKind(attachment.kind)}, {formatFileSize(attachment.sizeBytes)}
          {many && `, ${openIndex! + 1} z ${attachments.length}`}
        </p>

        <div className="overflow-auto rounded-md border bg-background p-2">
          <Preview attachment={attachment} actualSize={actualSize} />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {many && (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-label="Poprzedni załącznik"
                onClick={() => step(-1)}
              >
                <ChevronLeft aria-hidden="true" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-label="Następny załącznik"
                onClick={() => step(1)}
              >
                <ChevronRight aria-hidden="true" />
              </Button>
            </>
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-pressed={actualSize}
            onClick={() => setActualSize((previous) => !previous)}
          >
            {actualSize ? <Minimize2 aria-hidden="true" /> : <Maximize2 aria-hidden="true" />}
            {actualSize ? 'Dopasuj' : 'Skala 1:1'}
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="ml-auto"
            onClick={() => downloadAttachment(attachment.id, attachment.fileName)}
          >
            <Download aria-hidden="true" />
            Pobierz
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default AttachmentLightbox
