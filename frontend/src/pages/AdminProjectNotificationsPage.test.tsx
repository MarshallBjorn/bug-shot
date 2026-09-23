import React from 'react'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AdminProjectNotificationsPage from './AdminProjectNotificationsPage'
import { getProjects } from '../api/projects'
import {
  createNotificationChannel,
  deleteNotificationChannel,
  getNotificationChannels,
  getNotificationTemplates,
  sendTestWebhook,
  updateNotificationChannel,
  upsertNotificationTemplate,
} from '../api/notifications'

vi.mock('../api/projects', () => ({
  getProjects: vi.fn(),
}))

vi.mock('../api/notifications', () => ({
  createNotificationChannel: vi.fn(),
  deleteNotificationChannel: vi.fn(),
  getNotificationChannels: vi.fn(),
  getNotificationTemplates: vi.fn(),
  sendTestWebhook: vi.fn(),
  updateNotificationChannel: vi.fn(),
  upsertNotificationTemplate: vi.fn(),
}))

vi.mock('react-router', () => ({
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => <a href={to}>{children}</a>,
  useParams: () => ({ projectId: 'p1' }),
}))

const mockedGetProjects = vi.mocked(getProjects)
const mockedGetChannels = vi.mocked(getNotificationChannels)
const mockedGetTemplates = vi.mocked(getNotificationTemplates)
const mockedCreateChannel = vi.mocked(createNotificationChannel)
const mockedUpdateChannel = vi.mocked(updateNotificationChannel)
const mockedDeleteChannel = vi.mocked(deleteNotificationChannel)
const mockedSendTest = vi.mocked(sendTestWebhook)
const mockedUpsertTemplate = vi.mocked(upsertNotificationTemplate)

const project = {
  id: 'p1',
  name: 'Acme',
  key: 'ACME',
  createdAt: '2026-09-14T10:00:00Z',
  origins: [],
  role: 'Maintainer' as const,
}

const emailChannel = {
  id: 'c1',
  projectId: 'p1',
  type: 'Email' as const,
  isEnabled: true,
  emailAddress: 'team@acme.example',
  webhookUrl: null,
  throttleWindowSeconds: 3600,
  throttleMaxEvents: 1,
  createdAt: '2026-09-14T10:00:00Z',
}

const webhookChannel = {
  id: 'c2',
  projectId: 'p1',
  type: 'Webhook' as const,
  isEnabled: true,
  emailAddress: null,
  webhookUrl: 'https://hooks.acme.example/bugshot',
  throttleWindowSeconds: null,
  throttleMaxEvents: null,
  createdAt: '2026-09-14T10:00:00Z',
}

const template = {
  id: 't1',
  projectId: null,
  eventType: 'TicketCreated' as const,
  channelType: 'Email' as const,
  subject: 'Nowe zgloszenie',
  body: '{{ticket.description}}',
  createdAt: '2026-09-14T10:00:00Z',
}

beforeEach(() => {
  vi.resetAllMocks()
  mockedGetProjects.mockResolvedValue([project])
  mockedGetChannels.mockResolvedValue([emailChannel, webhookChannel])
  mockedGetTemplates.mockResolvedValue([template])
  mockedCreateChannel.mockResolvedValue({
    ...emailChannel,
    id: 'c3',
    emailAddress: 'new@acme.example',
  })
  mockedUpdateChannel.mockResolvedValue({ ...emailChannel, isEnabled: false })
  mockedDeleteChannel.mockResolvedValue(undefined)
  mockedSendTest.mockResolvedValue(undefined)
  mockedUpsertTemplate.mockResolvedValue({ ...template, projectId: 'p1', subject: 'Zaktualizowany' })
  vi.spyOn(window, 'confirm').mockReturnValue(true)
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('AdminProjectNotificationsPage', () => {
  it('laduje i pokazuje kanaly oraz szablony', async () => {
    render(<AdminProjectNotificationsPage />)

    expect(await screen.findByText('team@acme.example')).toBeTruthy()
    expect(screen.getByText('https://hooks.acme.example/bugshot')).toBeTruthy()
    expect(screen.getByText('Nowe zgloszenie')).toBeTruthy()
  })

  it('pokazuje pusty stan kanalow', async () => {
    mockedGetChannels.mockResolvedValueOnce([])

    render(<AdminProjectNotificationsPage />)

    expect(await screen.findByText('Brak kanalow powiadomien.')).toBeTruthy()
  })

  it('pokazuje blad pobierania kanalow', async () => {
    mockedGetChannels.mockRejectedValueOnce(new Error('Brak dostepu'))

    render(<AdminProjectNotificationsPage />)

    expect(await screen.findByText(/Nie udalo sie pobrac kanalow/)).toBeTruthy()
  })

  it('tworzy kanal email', async () => {
    render(<AdminProjectNotificationsPage />)
    await screen.findByText('team@acme.example')

    fireEvent.change(screen.getByLabelText('Adres email'), {
      target: { value: 'new@acme.example' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Dodaj kanal' }))

    await vi.waitFor(() => {
      expect(mockedCreateChannel).toHaveBeenCalledWith(
        'p1',
        expect.objectContaining({
          type: 'Email',
          emailAddress: 'new@acme.example',
          webhookUrl: null,
        }),
      )
    })
    expect(await screen.findByText('new@acme.example')).toBeTruthy()
  })

  it('odrzuca niepelne throttling', async () => {
    render(<AdminProjectNotificationsPage />)
    await screen.findByText('team@acme.example')

    fireEvent.change(screen.getByLabelText('Adres email'), {
      target: { value: 'new@acme.example' },
    })
    fireEvent.change(screen.getByLabelText('Okno throttlingu (s)'), {
      target: { value: '60' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Dodaj kanal' }))

    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(mockedCreateChannel).not.toHaveBeenCalled()
  })

  it('przelacza wlaczenie kanalu z pelnym stanem', async () => {
    render(<AdminProjectNotificationsPage />)
    const emailItem = await screen.findByText('team@acme.example')
    const checkbox = emailItem.closest('li')!.querySelector('input[type="checkbox"]')!

    fireEvent.click(checkbox)

    await vi.waitFor(() => {
      expect(mockedUpdateChannel).toHaveBeenCalledWith(
        'p1',
        'c1',
        expect.objectContaining({
          isEnabled: false,
          emailAddress: 'team@acme.example',
          throttleWindowSeconds: 3600,
          throttleMaxEvents: 1,
        }),
      )
    })
  })

  it('usuwa kanal po potwierdzeniu', async () => {
    render(<AdminProjectNotificationsPage />)
    await screen.findByText('team@acme.example')

    fireEvent.click(screen.getAllByRole('button', { name: 'Usun' })[0])

    await vi.waitFor(() => {
      expect(mockedDeleteChannel).toHaveBeenCalledWith('p1', 'c1')
    })
  })

  it('wysyla testowe zdarzenie dla webhooka', async () => {
    render(<AdminProjectNotificationsPage />)
    await screen.findByText('https://hooks.acme.example/bugshot')

    fireEvent.click(screen.getByRole('button', { name: 'Wyslij testowe zdarzenie' }))

    await vi.waitFor(() => {
      expect(mockedSendTest).toHaveBeenCalledWith('p1', 'c2')
    })
    expect(await screen.findByText('Wyslano testowe zdarzenie.')).toBeTruthy()
  })

  it('edytuje szablon', async () => {
    render(<AdminProjectNotificationsPage />)
    await screen.findByText('Nowe zgloszenie')

    fireEvent.click(screen.getByRole('button', { name: 'Edytuj szablon TicketCreated Email' }))
    fireEvent.change(screen.getByLabelText('Tresc'), {
      target: { value: 'Nowa tresc {{ticket.id}}' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Zapisz szablon' }))

    await vi.waitFor(() => {
      expect(mockedUpsertTemplate).toHaveBeenCalledWith('p1', 'TicketCreated', 'Email', {
        subject: 'Nowe zgloszenie',
        body: 'Nowa tresc {{ticket.id}}',
      })
    })
  })

  it('anuluje zmiane szablonu bez requestu', async () => {
    render(<AdminProjectNotificationsPage />)
    await screen.findByText('Nowe zgloszenie')

    fireEvent.click(screen.getByRole('button', { name: 'Edytuj szablon TicketCreated Email' }))
    fireEvent.change(screen.getByLabelText('Tresc'), { target: { value: 'x' } })
    fireEvent.click(screen.getByRole('button', { name: 'Anuluj' }))

    expect(mockedUpsertTemplate).not.toHaveBeenCalled()
    expect(screen.queryByLabelText('Tresc')).toBeNull()
  })
  it('pokazuje blad pobierania szablonow', async () => {
    mockedGetTemplates.mockRejectedValueOnce(new Error('Template load failed'))

    render(<AdminProjectNotificationsPage />)

    expect(
      await screen.findByText(/Nie udalo sie pobrac szablonow\. Template load failed/),
    ).toBeTruthy()
  })

  it('pokazuje blad tworzenia kanalu', async () => {
    mockedCreateChannel.mockRejectedValueOnce(new Error('Create failed'))

    render(<AdminProjectNotificationsPage />)
    await screen.findByText('team@acme.example')

    fireEvent.change(screen.getByLabelText('Adres email'), {
      target: { value: 'new@acme.example' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Dodaj kanal' }))

    expect(await screen.findByText('Create failed')).toBeTruthy()
  })

  it('edytuje kanal email', async () => {
    mockedUpdateChannel.mockResolvedValueOnce({
      ...emailChannel,
      emailAddress: 'edited@acme.example',
    })

    render(<AdminProjectNotificationsPage />)

    const emailText = await screen.findByText('team@acme.example')
    const emailItem = emailText.closest('li')!

    fireEvent.click(within(emailItem).getByRole('button', { name: 'Edytuj' }))

    fireEvent.change(within(emailItem).getByLabelText('Adres email'), {
      target: { value: 'edited@acme.example' },
    })

    fireEvent.click(within(emailItem).getByRole('button', { name: /Zapisz/ }))

    await vi.waitFor(() => {
      expect(mockedUpdateChannel).toHaveBeenCalledWith(
        'p1',
        'c1',
        expect.objectContaining({
          emailAddress: 'edited@acme.example',
        }),
      )
    })

    expect(await screen.findByText('edited@acme.example')).toBeTruthy()
  })

  it('anuluje edycje kanalu bez requestu', async () => {
    render(<AdminProjectNotificationsPage />)
    await screen.findByText('team@acme.example')

    fireEvent.click(screen.getAllByRole('button', { name: 'Edytuj' })[0])
    fireEvent.click(screen.getByRole('button', { name: 'Anuluj' }))

    expect(mockedUpdateChannel).not.toHaveBeenCalled()
  })

  it('pokazuje blad zmiany statusu kanalu', async () => {
    mockedUpdateChannel.mockRejectedValueOnce(new Error('Toggle failed'))

    render(<AdminProjectNotificationsPage />)

    const emailText = await screen.findByText('team@acme.example')
    const emailItem = emailText.closest('li')!
    const checkbox = within(emailItem).getByRole('checkbox')

    fireEvent.click(checkbox)

    expect(
      await screen.findByText(/Toggle failed/),
    ).toBeTruthy()
  })

  it('pokazuje blad usuwania kanalu', async () => {
    mockedDeleteChannel.mockRejectedValueOnce(new Error('Delete failed'))
    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {})

    render(<AdminProjectNotificationsPage />)
    await screen.findByText('team@acme.example')

    fireEvent.click(screen.getAllByRole('button', { name: 'Usun' })[0])

    await vi.waitFor(() => {
      expect(alertMock).toHaveBeenCalledWith('Delete failed')
    })
  })

  it('pokazuje blad testowego webhooka', async () => {
    mockedSendTest.mockRejectedValueOnce(new Error('Webhook failed'))

    render(<AdminProjectNotificationsPage />)
    await screen.findByText('https://hooks.acme.example/bugshot')

    fireEvent.click(screen.getByRole('button', { name: 'Wyslij testowe zdarzenie' }))

    expect(await screen.findByText('Webhook failed')).toBeTruthy()
  })

  it('pokazuje blad zapisu szablonu', async () => {
    mockedUpsertTemplate.mockRejectedValueOnce(new Error('Template save failed'))

    render(<AdminProjectNotificationsPage />)
    await screen.findByText('Nowe zgloszenie')

    fireEvent.click(screen.getByRole('button', { name: 'Edytuj szablon TicketCreated Email' }))
    fireEvent.change(screen.getByLabelText('Tresc'), {
      target: { value: 'Nowa tresc' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Zapisz szablon' }))

    expect(await screen.findByText('Template save failed')).toBeTruthy()
  })
})