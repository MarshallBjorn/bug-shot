import { createContext, useContext } from 'react'
import type { Project, ProjectRole } from '../types'

export interface ProjectsValue {
  projects: Project[]
  loading: boolean
  reload: () => void
}

export const ProjectsContext = createContext<ProjectsValue | null>(null)

export function useProjects() {
  const value = useContext(ProjectsContext)

  if (!value) {
    throw new Error('useProjects wymaga ProjectsProvider wyżej w drzewie.')
  }

  return value
}

// null dopoki lista sie laduje, wiec akcje pojawiaja sie dopiero gdy wiadomo ze wolno
export function useProjectRole(projectId: string): ProjectRole | null {
  const { projects } = useProjects()

  return projects.find((project) => project.id === projectId)?.role ?? null
}

// ustawienia projektu ma w panelu kazdy kto jest maintainerem choc jednego projektu
export function useManagesAnyProject() {
  const { projects } = useProjects()

  return projects.some((project) => project.role === 'Maintainer')
}
