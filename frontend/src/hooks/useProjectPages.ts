import { useEffect, useState } from 'react'
import { getProjectPages } from '../api/pages'
import type { ProjectPageCount } from '../types'

interface PagesState {
  pages: ProjectPageCount[]
  error: string | null
  loading: boolean
}

interface Answer {
  projectId: string
  pages: ProjectPageCount[]
  error: string | null
}

// pusty projekt nie zgadza sie z zadnym wiec pierwszy render wychodzi jako ladowanie
const noAnswer: Answer = { projectId: '', pages: [], error: null }

export function useProjectPages(projectId: string, revision = 0): PagesState {
  const [answer, setAnswer] = useState<Answer>(noAnswer)

  useEffect(() => {
    if (!projectId) {
      return
    }

    const controller = new AbortController()

    getProjectPages(projectId, controller.signal)
      .then((pages) => setAnswer({ projectId, pages, error: null }))
      .catch((cause: Error) => {
        if (controller.signal.aborted) return
        setAnswer({ projectId, pages: [], error: cause.message })
      })

    return () => controller.abort()
    // revision przeladowuje liczniki po zdarzeniu z kanalu live
  }, [projectId, revision])

  const loading = answer.projectId !== projectId

  return {
    pages: answer.projectId === projectId ? answer.pages : [],
    error: loading ? null : answer.error,
    loading,
  }
}
