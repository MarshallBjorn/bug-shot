import type { ProjectPageCount } from '../types'
import { apiGet } from './client'

interface ProjectPagesResponse {
  items: ProjectPageCount[]
}

export async function getProjectPages(projectId: string, signal?: AbortSignal) {
  const response = await apiGet<ProjectPagesResponse>(
    `/api/v1/projects/${projectId}/pages`,
    signal,
  )

  return response.items
}
