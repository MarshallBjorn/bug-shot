import { useState } from 'react'
import { downloadAttachment } from '../media'
import type { TicketAttachment } from '../types'

interface AttachmentDownloadProps {
  attachment: TicketAttachment
  label: string
}

// plik idzie po kliknięciu a nie przy wejściu w zgłoszenie
// bo inaczej panel ściąga do pamięci karty także te załączniki których nikt nie otworzy
function AttachmentDownload({ attachment, label }: AttachmentDownloadProps) {
  const [pending, setPending] = useState(false)
  const [failed, setFailed] = useState(false)

  async function save() {
    setPending(true)
    setFailed(false)

    try {
      await downloadAttachment(attachment.id, attachment.fileName)
    } catch {
      setFailed(true)
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      <button
        className="break-all text-primary underline-offset-2 hover:underline disabled:opacity-60"
        disabled={pending}
        onClick={save}
        type="button"
      >
        {pending ? 'Pobieranie...' : label}
      </button>
      {failed && (
        <span role="alert" className="text-destructive">
          Nie udało się pobrać.
        </span>
      )}
    </>
  )
}

export default AttachmentDownload
