import type {
  NotificationChannel,
  NotificationChannelType,
  NotificationEventType,
  NotificationTemplate,
} from '../types'
import { apiDelete, apiGet, apiPost, apiPut } from './client'

export interface CreateNotificationChannelInput {
  type: NotificationChannelType
  isEnabled: boolean
  emailAddress: string | null
  webhookUrl: string | null
  webhookSecret: string | null
  throttleWindowSeconds: number | null
  throttleMaxEvents: number | null
}

export interface UpdateNotificationChannelInput {
  isEnabled: boolean
  emailAddress: string | null
  webhookUrl: string | null
  // null/empty is intentionally sent as null here. The backend only changes
  // the secret when this value is non-empty, so an existing secret is retained.
  webhookSecret: string | null
  throttleWindowSeconds: number | null
  throttleMaxEvents: number | null
}

export interface UpsertNotificationTemplateInput {
  subject: string | null
  body: string
}

export function getNotificationChannels(projectId: string, signal?: AbortSignal) {
  return apiGet<NotificationChannel[]>(`/api/v1/projects/${projectId}/notifications`, signal)
}

export function createNotificationChannel(projectId: string, input: CreateNotificationChannelInput) {
  return apiPost<NotificationChannel>(`/api/v1/projects/${projectId}/notifications`, input)
}

export function updateNotificationChannel(
  projectId: string,
  channelId: string,
  input: UpdateNotificationChannelInput,
) {
  return apiPut<NotificationChannel>(
    `/api/v1/projects/${projectId}/notifications/${channelId}`,
    input,
  )
}

export function deleteNotificationChannel(projectId: string, channelId: string) {
  return apiDelete(`/api/v1/projects/${projectId}/notifications/${channelId}`)
}

export function sendTestWebhook(projectId: string, channelId: string) {
  return apiPost<void>(`/api/v1/projects/${projectId}/notifications/${channelId}/test`, undefined)
}

export function getNotificationTemplates(projectId: string, signal?: AbortSignal) {
  return apiGet<NotificationTemplate[]>(`/api/v1/projects/${projectId}/templates`, signal)
}

export function upsertNotificationTemplate(
  projectId: string,
  eventType: NotificationEventType,
  channelType: NotificationChannelType,
  input: UpsertNotificationTemplateInput,
) {
  return apiPut<NotificationTemplate>(
    `/api/v1/projects/${projectId}/templates/${eventType}/${channelType}`,
    input,
  )
}
