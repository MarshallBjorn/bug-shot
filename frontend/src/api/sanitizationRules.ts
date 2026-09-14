import type { SanitizationRule } from '../types'
import { apiDelete, apiGet, apiPatch, apiPost } from './client'

export function getSanitizationRules(projectId?: string, signal?: AbortSignal) {
  const suffix = projectId ? `?projectId=${projectId}` : ''

  return apiGet<SanitizationRule[]>(`/api/v1/sanitization-rules${suffix}`, signal)
}

export function createSanitizationRule(projectId: string | null, pattern: string, replacement: string) {
  return apiPost<SanitizationRule>('/api/v1/sanitization-rules', { projectId, pattern, replacement })
}

export function updateSanitizationRule(id: string, pattern: string, replacement: string) {
  return apiPatch<SanitizationRule>(`/api/v1/sanitization-rules/${id}`, { pattern, replacement })
}

export function setSanitizationRuleEnabled(id: string, isEnabled: boolean) {
  return apiPatch<SanitizationRule>(`/api/v1/sanitization-rules/${id}/enabled`, { isEnabled })
}

export function deleteSanitizationRule(id: string) {
  return apiDelete(`/api/v1/sanitization-rules/${id}`)
}

export interface SanitizationRuleTestResult {
  result: string
  matchCount: number
}

export function testSanitizationRule(pattern: string, replacement: string, sampleText: string) {
  return apiPost<SanitizationRuleTestResult>('/api/v1/sanitization-rules/test', {
    pattern,
    replacement,
    sampleText,
  })
}
