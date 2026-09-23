import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router'
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
import type {
  NotificationChannel,
  NotificationChannelType,
  NotificationTemplate,
} from '../types'

interface ChannelFormState {
  type: NotificationChannelType
  isEnabled: boolean
  emailAddress: string
  webhookUrl: string
  webhookSecret: string
  throttleWindowSeconds: string
  throttleMaxEvents: string
}

const emptyChannelForm: ChannelFormState = {
  type: 'Email',
  isEnabled: true,
  emailAddress: '',
  webhookUrl: '',
  webhookSecret: '',
  throttleWindowSeconds: '',
  throttleMaxEvents: '',
}

function channelToForm(channel: NotificationChannel): ChannelFormState {
  return {
    type: channel.type,
    isEnabled: channel.isEnabled,
    emailAddress: channel.emailAddress ?? '',
    webhookUrl: channel.webhookUrl ?? '',
    webhookSecret: '',
    throttleWindowSeconds: channel.throttleWindowSeconds?.toString() ?? '',
    throttleMaxEvents: channel.throttleMaxEvents?.toString() ?? '',
  }
}

function nullablePositiveInt(raw: string): number | null {
  const trimmed = raw.trim()
  if (trimmed === '') return null

  const value = Number(trimmed)
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error('Wartosc throttlingu musi byc dodatnia liczba calkowita.')
  }

  return value
}

function throttlingValues(windowRaw: string, maxRaw: string) {
  const windowValue = nullablePositiveInt(windowRaw)
  const maxValue = nullablePositiveInt(maxRaw)

  if ((windowValue === null) !== (maxValue === null)) {
    throw new Error('Okno throttlingu i maksymalna liczba zdarzen musza byc podane razem.')
  }

  return {
    throttleWindowSeconds: windowValue,
    throttleMaxEvents: maxValue,
  }
}

function AdminProjectNotificationsPage() {
  const { projectId } = useParams() as { projectId: string }

  const [projectName, setProjectName] = useState<string | null>(null)
  const [projectError, setProjectError] = useState<string | null>(null)

  const [channels, setChannels] = useState<NotificationChannel[]>([])
  const [channelsLoading, setChannelsLoading] = useState(true)
  const [channelsError, setChannelsError] = useState<string | null>(null)

  const [templates, setTemplates] = useState<NotificationTemplate[]>([])
  const [templatesLoading, setTemplatesLoading] = useState(true)
  const [templatesError, setTemplatesError] = useState<string | null>(null)

  const [form, setForm] = useState<ChannelFormState>(emptyChannelForm)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const [editingChannelId, setEditingChannelId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<ChannelFormState>(emptyChannelForm)
  const [savingChannel, setSavingChannel] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const [testStatus, setTestStatus] = useState<Record<string, string>>({})
  const [testingChannelId, setTestingChannelId] = useState<string | null>(null)

  const [editingTemplate, setEditingTemplate] = useState<NotificationTemplate | null>(null)
  const [templateSubject, setTemplateSubject] = useState('')
  const [templateBody, setTemplateBody] = useState('')
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [templateSaveError, setTemplateSaveError] = useState<string | null>(null)

  useEffect(() => {
    if (!projectId) return

    let active = true
    getProjects()
      .then((items) => {
        if (!active) return
        const project = items.find((item) => item.id === projectId)
        if (project) {
          setProjectName(project.name)
          setProjectError(null)
          return
        }
        setProjectName(null)
        setProjectError('Nie znaleziono projektu.')
      })
      .catch((cause: Error) => {
        if (!active) return
        setProjectError(cause.message)
      })

    return () => {
      active = false
    }
  }, [projectId])

  useEffect(() => {
    if (!projectId) return

    const controller = new AbortController()
    setChannelsLoading(true)
    setChannelsError(null)

    getNotificationChannels(projectId, controller.signal)
      .then((items) => {
        setChannels(items)
      })
      .catch((cause: Error) => {
        if (controller.signal.aborted) return
        setChannelsError(cause.message)
      })
      .finally(() => {
        if (!controller.signal.aborted) setChannelsLoading(false)
      })

    return () => controller.abort()
  }, [projectId])

  useEffect(() => {
    if (!projectId) return

    const controller = new AbortController()
    setTemplatesLoading(true)
    setTemplatesError(null)

    getNotificationTemplates(projectId, controller.signal)
      .then((items) => {
        setTemplates(items)
      })
      .catch((cause: Error) => {
        if (controller.signal.aborted) return
        setTemplatesError(cause.message)
      })
      .finally(() => {
        if (!controller.signal.aborted) setTemplatesLoading(false)
      })

    return () => controller.abort()
  }, [projectId])

  if (!projectId) {
    return <p role="alert">Brak identyfikatora projektu.</p>
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (creating) return

    setCreating(true)
    setCreateError(null)

    try {
      const throttle = throttlingValues(form.throttleWindowSeconds, form.throttleMaxEvents)
      const created = await createNotificationChannel(projectId, {
        type: form.type,
        isEnabled: form.isEnabled,
        emailAddress: form.type === 'Email' ? form.emailAddress.trim() : null,
        webhookUrl: form.type === 'Webhook' ? form.webhookUrl.trim() : null,
        webhookSecret: form.type === 'Webhook' ? form.webhookSecret.trim() || null : null,
        ...throttle,
      })

      setChannels((current) => [...current, created])
      setForm(emptyChannelForm)
    } catch (cause) {
      setCreateError(cause instanceof Error ? cause.message : 'Nie udalo sie utworzyc kanalu.')
    } finally {
      setCreating(false)
    }
  }

  function startEdit(channel: NotificationChannel) {
    setEditingChannelId(channel.id)
    setEditForm(channelToForm(channel))
    setSaveError(null)
  }

  function cancelEdit() {
    setEditingChannelId(null)
    setSaveError(null)
  }

  async function persistChannelUpdate(channel: NotificationChannel, values: ChannelFormState) {
    const throttle = throttlingValues(values.throttleWindowSeconds, values.throttleMaxEvents)

    return updateNotificationChannel(projectId, channel.id, {
      isEnabled: values.isEnabled,
      emailAddress: channel.type === 'Email' ? values.emailAddress.trim() : null,
      webhookUrl: channel.type === 'Webhook' ? values.webhookUrl.trim() : null,
      webhookSecret: channel.type === 'Webhook' ? values.webhookSecret.trim() || null : null,
      ...throttle,
    })
  }

  async function handleEditSubmit(event: FormEvent<HTMLFormElement>, channel: NotificationChannel) {
    event.preventDefault()
    if (savingChannel) return

    setSavingChannel(true)
    setSaveError(null)

    try {
      const updated = await persistChannelUpdate(channel, editForm)
      setChannels((current) => current.map((item) => (item.id === channel.id ? updated : item)))
      setEditingChannelId(null)
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : 'Nie udalo sie zapisac kanalu.')
    } finally {
      setSavingChannel(false)
    }
  }

  async function handleToggleEnabled(channel: NotificationChannel) {
    setSaveError(null)
    try {
      const updated = await persistChannelUpdate(channel, {
        ...channelToForm(channel),
        isEnabled: !channel.isEnabled,
      })
      setChannels((current) => current.map((item) => (item.id === channel.id ? updated : item)))
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : 'Nie udalo sie zmienic statusu kanalu.')
    }
  }

  async function handleDelete(channel: NotificationChannel) {
    if (!window.confirm('Czy na pewno chcesz usunac ten kanal powiadomien?')) return

    try {
      await deleteNotificationChannel(projectId, channel.id)
      setChannels((current) => current.filter((item) => item.id !== channel.id))
    } catch (cause) {
      window.alert(cause instanceof Error ? cause.message : 'Nie udalo sie usunac kanalu.')
    }
  }

  async function handleSendTest(channel: NotificationChannel) {
    if (testingChannelId) return

    setTestingChannelId(channel.id)
    setTestStatus((current) => ({ ...current, [channel.id]: 'Wysylanie...' }))

    try {
      await sendTestWebhook(projectId, channel.id)
      setTestStatus((current) => ({ ...current, [channel.id]: 'Wyslano testowe zdarzenie.' }))
    } catch (cause) {
      setTestStatus((current) => ({
        ...current,
        [channel.id]: cause instanceof Error ? cause.message : 'Nie udalo sie wyslac testowego zdarzenia.',
      }))
    } finally {
      setTestingChannelId(null)
    }
  }

  function startEditTemplate(template: NotificationTemplate) {
    setEditingTemplate(template)
    setTemplateSubject(template.subject ?? '')
    setTemplateBody(template.body)
    setTemplateSaveError(null)
  }

  function cancelEditTemplate() {
    setEditingTemplate(null)
    setTemplateSaveError(null)
  }

  async function handleTemplateSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editingTemplate || savingTemplate) return

    setSavingTemplate(true)
    setTemplateSaveError(null)

    try {
      const updated = await upsertNotificationTemplate(
        projectId,
        editingTemplate.eventType,
        editingTemplate.channelType,
        {
          subject: templateSubject.trim() || null,
          body: templateBody.trim(),
        },
      )

      setTemplates((current) => {
        const index = current.findIndex(
          (item) => item.eventType === updated.eventType && item.channelType === updated.channelType,
        )
        if (index < 0) return [...current, updated]
        const copy = [...current]
        copy[index] = updated
        return copy
      })
      setEditingTemplate(null)
    } catch (cause) {
      setTemplateSaveError(cause instanceof Error ? cause.message : 'Nie udalo sie zapisac szablonu.')
    } finally {
      setSavingTemplate(false)
    }
  }

  return (
    <>
      <div className="list-heading">
        <h2>Powiadomienia{projectName ? ` - ${projectName}` : ''}</h2>
        <Link to="/admin/projects">Zarzadzanie projektami</Link>
      </div>

      {projectError && <p role="alert">{projectError}</p>}

      <h3>Kanaly</h3>

      <form className="admin-form" onSubmit={handleCreate}>
        <label>
          <span>Typ</span>
          <select
            value={form.type}
            onChange={(event) => setForm({ ...form, type: event.target.value as NotificationChannelType })}
            disabled={creating}
          >
            <option value="Email">Email</option>
            <option value="Webhook">Webhook</option>
          </select>
        </label>

        {form.type === 'Email' ? (
          <label>
            <span>Adres email</span>
            <input
              type="email"
              value={form.emailAddress}
              onChange={(event) => setForm({ ...form, emailAddress: event.target.value })}
              disabled={creating}
              required
            />
          </label>
        ) : (
          <>
            <label>
              <span>Webhook URL</span>
              <input
                type="url"
                value={form.webhookUrl}
                onChange={(event) => setForm({ ...form, webhookUrl: event.target.value })}
                disabled={creating}
                required
              />
            </label>
            <label>
              <span>Webhook secret</span>
              <input
                type="password"
                value={form.webhookSecret}
                onChange={(event) => setForm({ ...form, webhookSecret: event.target.value })}
                disabled={creating}
                autoComplete="new-password"
              />
            </label>
          </>
        )}

        <label>
          <span>Okno throttlingu (s)</span>
          <input
            type="number"
            min="1"
            step="1"
            value={form.throttleWindowSeconds}
            onChange={(event) => setForm({ ...form, throttleWindowSeconds: event.target.value })}
            disabled={creating}
          />
        </label>

        <label>
          <span>Max zdarzen w oknie</span>
          <input
            type="number"
            min="1"
            step="1"
            value={form.throttleMaxEvents}
            onChange={(event) => setForm({ ...form, throttleMaxEvents: event.target.value })}
            disabled={creating}
          />
        </label>

        <label>
          <input
            type="checkbox"
            checked={form.isEnabled}
            onChange={(event) => setForm({ ...form, isEnabled: event.target.checked })}
            disabled={creating}
          />
          <span>Wlaczony</span>
        </label>

        <button type="submit" disabled={creating}>
          {creating ? 'Dodawanie...' : 'Dodaj kanal'}
        </button>

        {createError && <span role="alert">{createError}</span>}
      </form>

      {channelsError && <p role="alert">Nie udalo sie pobrac kanalow. {channelsError}</p>}
      {saveError && !editingChannelId && <p role="alert">{saveError}</p>}

      {channelsLoading ? (
        <p>Ladowanie...</p>
      ) : channels.length === 0 ? (
        <p>Brak kanalow powiadomien.</p>
      ) : (
        <ul className="admin-project-list">
          {channels.map((channel) => {
            const editing = editingChannelId === channel.id
            return (
              <li key={channel.id}>
                {editing ? (
                  <form className="admin-form" onSubmit={(event) => handleEditSubmit(event, channel)}>
                    <code>{channel.type}</code>

                    {channel.type === 'Email' ? (
                      <label>
                        <span>Adres email</span>
                        <input
                          type="email"
                          value={editForm.emailAddress}
                          onChange={(event) => setEditForm({ ...editForm, emailAddress: event.target.value })}
                          disabled={savingChannel}
                          required
                        />
                      </label>
                    ) : (
                      <>
                        <label>
                          <span>Webhook URL</span>
                          <input
                            type="url"
                            value={editForm.webhookUrl}
                            onChange={(event) => setEditForm({ ...editForm, webhookUrl: event.target.value })}
                            disabled={savingChannel}
                            required
                          />
                        </label>
                        <label>
                          <span>Webhook secret</span>
                          <input
                            type="password"
                            value={editForm.webhookSecret}
                            onChange={(event) => setEditForm({ ...editForm, webhookSecret: event.target.value })}
                            disabled={savingChannel}
                            autoComplete="new-password"
                            placeholder="Pozostaw puste, aby zachowac obecny sekret"
                          />
                        </label>
                      </>
                    )}

                    <label>
                      <span>Okno throttlingu (s)</span>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={editForm.throttleWindowSeconds}
                        onChange={(event) => setEditForm({ ...editForm, throttleWindowSeconds: event.target.value })}
                        disabled={savingChannel}
                      />
                    </label>

                    <label>
                      <span>Max zdarzen w oknie</span>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={editForm.throttleMaxEvents}
                        onChange={(event) => setEditForm({ ...editForm, throttleMaxEvents: event.target.value })}
                        disabled={savingChannel}
                      />
                    </label>

                    <label>
                      <input
                        type="checkbox"
                        checked={editForm.isEnabled}
                        onChange={(event) => setEditForm({ ...editForm, isEnabled: event.target.checked })}
                        disabled={savingChannel}
                      />
                      <span>Wlaczony</span>
                    </label>

                    <div className="admin-form-actions">
                      <button type="submit" disabled={savingChannel}>
                        {savingChannel ? 'Zapisywanie...' : 'Zapisz'}
                      </button>
                      <button type="button" onClick={cancelEdit} disabled={savingChannel}>
                        Anuluj
                      </button>
                    </div>

                    {saveError && <span role="alert">{saveError}</span>}
                  </form>
                ) : (
                  <>
                    <div className="admin-project-header">
                      <code>{channel.type}</code>
                      <strong>{channel.emailAddress ?? channel.webhookUrl}</strong>
                      <label>
                        <input
                          type="checkbox"
                          checked={channel.isEnabled}
                          onChange={() => void handleToggleEnabled(channel)}
                          aria-label={channel.isEnabled ? 'Wylacz kanal' : 'Wlacz kanal'}
                        />
                        <span>{channel.isEnabled ? 'Wlaczony' : 'Wylaczony'}</span>
                      </label>
                      <button type="button" onClick={() => startEdit(channel)}>
                        Edytuj
                      </button>
                      <button type="button" onClick={() => void handleDelete(channel)}>
                        Usun
                      </button>
                      {channel.type === 'Webhook' && (
                        <button
                          type="button"
                          onClick={() => void handleSendTest(channel)}
                          disabled={testingChannelId !== null}
                        >
                          {testingChannelId === channel.id ? 'Wysylanie...' : 'Wyslij testowe zdarzenie'}
                        </button>
                      )}
                    </div>

                    <p>
                      Throttling:{' '}
                      {channel.throttleWindowSeconds !== null && channel.throttleMaxEvents !== null
                        ? `${channel.throttleMaxEvents} / ${channel.throttleWindowSeconds}s`
                        : 'brak'}
                    </p>

                    {testStatus[channel.id] && (
                      <p className="admin-test-result" role="status">
                        {testStatus[channel.id]}
                      </p>
                    )}
                  </>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <h3>Szablony</h3>

      {templatesError && <p role="alert">Nie udalo sie pobrac szablonow. {templatesError}</p>}

      {templatesLoading ? (
        <p>Ladowanie...</p>
      ) : templates.length === 0 ? (
        <p>Brak szablonow.</p>
      ) : (
        <table className="admin-rule-table">
          <thead>
            <tr>
              <th>Zdarzenie</th>
              <th>Kanal</th>
              <th>Zakres</th>
              <th>Temat</th>
              <th>Akcja</th>
            </tr>
          </thead>
          <tbody>
            {templates.map((template) => (
              <tr key={`${template.eventType}-${template.channelType}`}>
                <td>{template.eventType}</td>
                <td>{template.channelType}</td>
                <td>{template.projectId ? 'Projektowy' : 'Globalny'}</td>
                <td>{template.subject ?? '(brak)'}</td>
                <td>
                  <button
                    type="button"
                    aria-label={`Edytuj szablon ${template.eventType} ${template.channelType}`}
                    onClick={() => startEditTemplate(template)}
                  >
                    Edytuj szablon
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {editingTemplate && (
        <form className="admin-form" onSubmit={handleTemplateSubmit}>
          <p>
            {editingTemplate.eventType} / {editingTemplate.channelType}
          </p>

          <label>
            <span>Temat</span>
            <input
              value={templateSubject}
              onChange={(event) => setTemplateSubject(event.target.value)}
              disabled={savingTemplate}
            />
          </label>

          <label>
            <span>Tresc</span>
            <textarea
              value={templateBody}
              onChange={(event) => setTemplateBody(event.target.value)}
              disabled={savingTemplate}
              required
            />
          </label>

          <div className="admin-form-actions">
            <button type="submit" disabled={savingTemplate || !templateBody.trim()}>
              {savingTemplate ? 'Zapisywanie...' : 'Zapisz szablon'}
            </button>
            <button type="button" onClick={cancelEditTemplate} disabled={savingTemplate}>
              Anuluj
            </button>
          </div>

          {templateSaveError && <span role="alert">{templateSaveError}</span>}
        </form>
      )}
    </>
  )
}

export default AdminProjectNotificationsPage

