import type { TicketStatus } from '../types'
import { apiGet } from './client'

export type AnalyticsRange = '7d' | '30d' | '90d' | 'all'

export const analyticsRanges: AnalyticsRange[] = ['7d', '30d', '90d', 'all']

export const defaultAnalyticsRange: AnalyticsRange = '30d'

export interface AnalyticsDuration {
  medianHours: number | null
  p90Hours: number | null
  samples: number
}

export interface AnalyticsNameCount {
  name: string
  count: number
}

export interface ProjectAnalytics {
  range: AnalyticsRange
  timeZone: string
  includeToday: boolean
  from: string | null
  to: string
  bucket: 'day' | 'week'
  summary: {
    newTickets: number
    previousNewTickets: number | null
    newToday: number
    openBacklog: number
    resolvedRate: number | null
    rejectedRate: number | null
    screenshotRate: number | null
    timeToResolve: AnalyticsDuration
    timeToFirstResponse: AnalyticsDuration
  }
  timeline: { date: string; created: number; resolved: number }[]
  statuses: { status: TicketStatus; count: number }[]
  topPages: { page: string; count: number }[]
  risingPages: { page: string; current: number; previous: number }[]
  browsers: AnalyticsNameCount[]
  operatingSystems: AnalyticsNameCount[]
  devices: AnalyticsNameCount[]
  sanitization: { ruleId: string; pattern: string; isGlobal: boolean; matches: number; tickets: number }[]
}

export function getProjectAnalytics(
  projectId: string,
  range: AnalyticsRange,
  includeToday: boolean,
  timeZone: string,
  signal?: AbortSignal,
) {
  const params = new URLSearchParams({ range, tz: timeZone, includeToday: String(includeToday) })

  return apiGet<ProjectAnalytics>(`/api/v1/projects/${projectId}/analytics?${params}`, signal)
}
