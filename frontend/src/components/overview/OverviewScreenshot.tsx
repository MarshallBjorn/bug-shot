import { ImageOff, Maximize2 } from 'lucide-react'
import { useAttachment } from '../../hooks/useAttachment'
import type { TicketAttachment } from '../../types'

interface OverviewScreenshotProps {
  screenshot: TicketAttachment | null
  onOpen: () => void
}

function Thumbnail({ screenshot }: { screenshot: TicketAttachment }) {
  const { url, failed } = useAttachment(screenshot.id)

  if (failed) {
    return (
      <span className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Nie udało się pobrać zrzutu
      </span>
    )
  }

  if (!url) {
    return (
      <span className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Pobieranie zrzutu...
      </span>
    )
  }

  return <img alt={screenshot.fileName} src={url} className="h-full w-full object-cover object-top" />
}

// zrzut jest bohaterem tego widoku wiec dostaje wlasny duzy kadr a nie kafel w gridzie
function OverviewScreenshot({ screenshot, onOpen }: OverviewScreenshotProps) {
  if (!screenshot) {
    return (
      <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-card text-sm text-muted-foreground">
        <ImageOff aria-hidden="true" className="size-5" />
        Zgłoszenie nie ma zrzutu ekranu.
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative block h-48 w-full overflow-hidden rounded-lg border bg-card"
    >
      <Thumbnail screenshot={screenshot} />
      <span className="absolute inset-x-0 bottom-0 flex items-center gap-1.5 bg-card/90 px-3 py-1.5 text-xs text-muted-foreground">
        <Maximize2 aria-hidden="true" className="size-3.5" />
        Zrzut ekranu, kliknij aby powiększyć
      </span>
    </button>
  )
}

export default OverviewScreenshot
