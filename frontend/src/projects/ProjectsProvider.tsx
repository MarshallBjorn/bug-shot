import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { getProjects } from '../api/projects'
import type { Project } from '../types'
import { ProjectsContext, type ProjectsValue } from './ProjectsContext'

// powloka pyta o projekty raz, a nawigacja i akcje zgloszen czytaja z tej samej listy role konta
export function ProjectsProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    const controller = new AbortController()

    getProjects(controller.signal)
      .then(setProjects)
      .catch(() => {
        // bez listy panel dziala dalej tylko bez akcji zaleznych od roli
        if (!controller.signal.aborted) setProjects([])
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [revision])

  const reload = useCallback(() => setRevision((current) => current + 1), [])

  const value = useMemo<ProjectsValue>(() => ({ projects, loading, reload }), [projects, loading, reload])

  return <ProjectsContext value={value}>{children}</ProjectsContext>
}
