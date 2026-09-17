import { useEffect, useState } from 'react'
import { fetchAttachmentText } from '../media'

interface TextState {
  text: string | null
  error: string | null
  loading: boolean
}

interface Answer {
  attachmentId: string
  text: string | null
  error: string | null
}

const noAnswer: Answer = { attachmentId: '', text: null, error: null }

export function useAttachmentText(attachmentId: string | null): TextState {
  const [answer, setAnswer] = useState<Answer>(noAnswer)

  useEffect(() => {
    if (!attachmentId) {
      return
    }

    const controller = new AbortController()

    fetchAttachmentText(attachmentId, controller.signal)
      .then((text) => setAnswer({ attachmentId, text, error: null }))
      .catch((cause: Error) => {
        if (controller.signal.aborted) return
        setAnswer({ attachmentId, text: null, error: cause.message })
      })

    return () => controller.abort()
  }, [attachmentId])

  if (!attachmentId) {
    return { text: null, error: null, loading: false }
  }

  const loading = answer.attachmentId !== attachmentId

  return {
    text: loading ? null : answer.text,
    error: loading ? null : answer.error,
    loading,
  }
}
