import type { AccountLinkResult, CreatedUser, ProjectAccess, UserAccount } from '../types'
import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from './client'

export function getUsers(signal?: AbortSignal) {
  return apiGet<UserAccount[]>('/api/v1/users', signal)
}

export function inviteUser(email: string, isAdmin: boolean, projects: ProjectAccess[]) {
  return apiPost<CreatedUser>('/api/v1/users', { email, isAdmin, projects })
}

export function setUserAdmin(userId: string, isAdmin: boolean) {
  return apiPatch<UserAccount>(`/api/v1/users/${userId}`, { isAdmin })
}

export function setUserProjects(userId: string, projects: ProjectAccess[]) {
  return apiPut<UserAccount>(`/api/v1/users/${userId}/projects`, projects)
}

export function deactivateUser(userId: string) {
  return apiPatch<void>(`/api/v1/users/${userId}/deactivate`, undefined)
}

export function activateUser(userId: string) {
  return apiPatch<void>(`/api/v1/users/${userId}/activate`, undefined)
}

export function resendInvitation(userId: string) {
  return apiPost<AccountLinkResult>(`/api/v1/users/${userId}/invitation`, undefined)
}

export function sendPasswordReset(userId: string) {
  return apiPost<AccountLinkResult>(`/api/v1/users/${userId}/reset-password`, undefined)
}

export function deleteUser(userId: string) {
  return apiDelete(`/api/v1/users/${userId}`)
}

export function changeOwnPassword(currentPassword: string, newPassword: string) {
  return apiPost<void>('/api/v1/auth/password', { currentPassword, newPassword })
}
