import { describe, expect, it, vi } from 'vitest'
import { apiDelete, apiGet, apiPatch, apiPost } from './client'
import {
  createSanitizationRule,
  deleteSanitizationRule,
  getSanitizationRules,
  setSanitizationRuleEnabled,
  testSanitizationRule,
  updateSanitizationRule,
} from './sanitizationRules'

vi.mock('./client', () => ({
  apiDelete: vi.fn(),
  apiGet: vi.fn(),
  apiPatch: vi.fn(),
  apiPost: vi.fn(),
}))

describe('sanitization rules api', () => {
  it('pobiera reguly bez projektu', async () => {
    vi.mocked(apiGet).mockResolvedValue([])

    await expect(getSanitizationRules()).resolves.toEqual([])
    expect(apiGet).toHaveBeenCalledWith('/api/v1/sanitization-rules', undefined)
  })

  it('pobiera reguly dla projektu', async () => {
    vi.mocked(apiGet).mockResolvedValue([])

    await getSanitizationRules('p1')

    expect(apiGet).toHaveBeenCalledWith('/api/v1/sanitization-rules?projectId=p1', undefined)
  })

  it('pobiera reguly z sygnalem abort', async () => {
    const signal = new AbortController().signal
    vi.mocked(apiGet).mockResolvedValue([])

    await getSanitizationRules('p1', signal)

    expect(apiGet).toHaveBeenCalledWith('/api/v1/sanitization-rules?projectId=p1', signal)
  })

  it('tworzy regule globalna', async () => {
    const rule = { id: 'r1' }
    vi.mocked(apiPost).mockResolvedValue(rule)

    await expect(createSanitizationRule(null, 'email', '[MASK]')).resolves.toEqual(rule)
    expect(apiPost).toHaveBeenCalledWith('/api/v1/sanitization-rules', {
      projectId: null,
      pattern: 'email',
      replacement: '[MASK]',
    })
  })

  it('tworzy regule dla projektu', async () => {
    vi.mocked(apiPost).mockResolvedValue({ id: 'r1' })

    await createSanitizationRule('p1', 'email', '[MASK]')

    expect(apiPost).toHaveBeenCalledWith('/api/v1/sanitization-rules', {
      projectId: 'p1',
      pattern: 'email',
      replacement: '[MASK]',
    })
  })

  it('aktualizuje regule', async () => {
    vi.mocked(apiPatch).mockResolvedValue({ id: 'r1' })

    await updateSanitizationRule('r1', 'email', '[MASK]')

    expect(apiPatch).toHaveBeenCalledWith('/api/v1/sanitization-rules/r1', {
      pattern: 'email',
      replacement: '[MASK]',
    })
  })

  it('wlacza lub wylacza regule', async () => {
    vi.mocked(apiPatch).mockResolvedValue({ id: 'r1' })

    await setSanitizationRuleEnabled('r1', false)

    expect(apiPatch).toHaveBeenCalledWith('/api/v1/sanitization-rules/r1/enabled', {
      isEnabled: false,
    })
  })

  it('usuwa regule', async () => {
    vi.mocked(apiDelete).mockResolvedValue(undefined)

    await deleteSanitizationRule('r1')

    expect(apiDelete).toHaveBeenCalledWith('/api/v1/sanitization-rules/r1')
  })

  it('testuje regule na przykladowym tekscie', async () => {
    const result = { result: 'abc', matchCount: 2 }
    vi.mocked(apiPost).mockResolvedValue(result)

    await expect(testSanitizationRule('email', '[MASK]', 'a@example.com'))
      .resolves.toEqual(result)

    expect(apiPost).toHaveBeenCalledWith('/api/v1/sanitization-rules/test', {
      pattern: 'email',
      replacement: '[MASK]',
      sampleText: 'a@example.com',
    })
  })
})
