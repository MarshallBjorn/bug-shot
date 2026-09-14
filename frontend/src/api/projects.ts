import type { Project, ProjectOrigin } from '../types'
import { apiDelete, apiGet, apiPatch, apiPost } from './client'

export function getProjects(signal?: AbortSignal) {
  return apiGet<Project[]>('/api/v1/projects', signal)
}

export function createProject(name: string, key: string) {
  return apiPost<Project>('/api/v1/projects', { name, key })
}

export function renameProject(projectId: string, name: string) {
  return apiPatch<Project>(`/api/v1/projects/${projectId}`, { name })
}

export function deleteProject(projectId: string) {
  return apiDelete(`/api/v1/projects/${projectId}`)
}

export function addProjectOrigin(projectId: string, origin: string) {
  return apiPost<ProjectOrigin>(`/api/v1/projects/${projectId}/origins`, { origin })
}

export function removeProjectOrigin(projectId: string, originId: string) {
  return apiDelete(`/api/v1/projects/${projectId}/origins/${originId}`)
}
