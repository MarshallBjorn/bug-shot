import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiDelete, apiGet, apiPost, apiPut } from './client'
import {
  createNotificationChannel,
  deleteNotificationChannel,
  getNotificationChannels,
  getNotificationTemplates,
  sendTestWebhook,
  updateNotificationChannel,
  upsertNotificationTemplate,
} from './notifications'

vi.mock('./client', () => ({
  apiDelete: vi.fn(),
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPut: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('notifications api', () => {
  it('pobiera kanaly z opcjonalnym AbortSignal', async () => {
    const signal = new AbortController().signal
    vi.mocked(apiGet).mockResolvedValue([])

    await getNotificationChannels('p1', signal)

    expect(apiGet).toHaveBeenCalledWith('/api/v1/projects/p1/notifications', signal)
  })

  it('tworzy kanal', async () => {
    const input = {
      type: 'Email' as const,
      isEnabled: true,
      emailAddress: 'team@example.test',
      webhookUrl: null,
      webhookSecret: null,
      throttleWindowSeconds: 3600,
      throttleMaxEvents: 1,
    }
    const channel = { id: 'c1' }
    vi.mocked(apiPost).mockResolvedValue(channel)

    await expect(createNotificationChannel('p1', input)).resolves.toEqual(channel)
    expect(apiPost).toHaveBeenCalledWith('/api/v1/projects/p1/notifications', input)
  })

  it('aktualizuje kanal pelnym stanem', async () => {
    const input = {
      isEnabled: false,
      emailAddress: 'team@example.test',
      webhookUrl: null,
      webhookSecret: null,
      throttleWindowSeconds: 3600,
      throttleMaxEvents: 1,
    }
    const channel = { id: 'c1' }
    vi.mocked(apiPut).mockResolvedValue(channel)

    await expect(updateNotificationChannel('p1', 'c1', input)).resolves.toEqual(channel)
    expect(apiPut).toHaveBeenCalledWith('/api/v1/projects/p1/notifications/c1', input)
  })

  it('usuwa kanal', async () => {
    vi.mocked(apiDelete).mockResolvedValue(undefined)

    await deleteNotificationChannel('p1', 'c1')

    expect(apiDelete).toHaveBeenCalledWith('/api/v1/projects/p1/notifications/c1')
  })

  it('wysyla testowe zdarzenie webhooka', async () => {
    vi.mocked(apiPost).mockResolvedValue(undefined)

    await sendTestWebhook('p1', 'c1')

    expect(apiPost).toHaveBeenCalledWith('/api/v1/projects/p1/notifications/c1/test', undefined)
  })

  it('pobiera szablony', async () => {
    const signal = new AbortController().signal
    vi.mocked(apiGet).mockResolvedValue([])

    await getNotificationTemplates('p1', signal)

    expect(apiGet).toHaveBeenCalledWith('/api/v1/projects/p1/templates', signal)
  })

  it('robi upsert szablonu', async () => {
    const template = { id: 't1' }
    vi.mocked(apiPut).mockResolvedValue(template)

    await expect(
      upsertNotificationTemplate('p1', 'TicketCreated', 'Email', {
        subject: 'Nowe zgloszenie',
        body: '{{ticket.description}}',
      }),
    ).resolves.toEqual(template)

    expect(apiPut).toHaveBeenCalledWith('/api/v1/projects/p1/templates/TicketCreated/Email', {
      subject: 'Nowe zgloszenie',
      body: '{{ticket.description}}',
    })
  })
})
