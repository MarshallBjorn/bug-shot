import { useEffect, useState } from 'react'
import { fetchAttachment } from '../media'

interface AttachmentState {
  url: string | null
  failed: boolean
}

// adres blobu żyje tyle co komponent bo inaczej pobrane pliki zostają w pamięci karty
export function useAttachment(attachmentId: string): AttachmentState {
  const [state, setState] = useState<AttachmentState>({ url: null, failed: false })

  useEffect(() => {
    const controller = new AbortController()
    let created: string | null = null

    fetchAttachment(attachmentId, controller.signal)
      .then((url) => {
        created = url
        setState({ url, failed: false })
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setState({ url: null, failed: true })
        }
      })

    return () => {
      controller.abort()

      if (created) {
        URL.revokeObjectURL(created)
      }
    }
  }, [attachmentId])

  return state
}
