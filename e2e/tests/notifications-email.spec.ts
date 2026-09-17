import { expect, test } from '@playwright/test'
import { admin, apiBaseUrl, demoProjectId, mailpitApiUrl } from '../e2e.config'
import { reportFromWidget } from './helpers'

// Dowod runtime na AC3 (email <5s) i na jakosc tresci maila (nie "0" / pusty /
// surowy placeholder) - opisane w handoffie jako "not fully proven" bez
// realnego SMTP. Mailpit jest dodawany do stacku wylacznie przez
// docker-compose.notifications.e2e.yml (patrz run-e2e.mjs) - nie dotyka
// production compose.
//
// Uzywamy unikalnego opisu ticketu jako klucza wyszukiwania w Mailpit, zeby
// test byl poprawny niezaleznie od tego, ile innych ticketow powstalo w tym
// samym przebiegu E2E (inne specy tez wolaja reportFromWidget na tym samym
// demoProjectId).
test.describe('notifications - email E2E przez Mailpit', () => {
  test('TicketCreated wysyla prawdziwy email w <5s z poprawna trescia', async ({
    request,
  }) => {
    const loginResponse = await request.post(`${apiBaseUrl}/api/v1/auth/login`, {
      data: { email: admin.email, password: admin.password },
    })

    expect(loginResponse.status()).toBe(200)

    const { accessToken } = (await loginResponse.json()) as {
      accessToken: string
    }

    const authHeader = { Authorization: `Bearer ${accessToken}` }
    const mailboxAddress = `e2e-${Date.now()}@bug-shot.test`

    const channelResponse = await request.post(
      `${apiBaseUrl}/api/v1/projects/${demoProjectId}/notifications`,
      {
        headers: authHeader,
        data: {
          type: 'Email',
          isEnabled: true,
          emailAddress: mailboxAddress,
          webhookUrl: null,
          webhookSecret: null,
          throttleWindowSeconds: null,
          throttleMaxEvents: null,
        },
      },
    )

    expect(channelResponse.status()).toBe(201)
    const channel = (await channelResponse.json()) as { id: string }

    try {
      const uniqueDescription = `E2E email proof ${Date.now()} ${Math.random()
        .toString(36)
        .slice(2)}`

      const start = Date.now()
      const { ticketId } = await reportFromWidget(request, uniqueDescription)

      const message = await pollMailpitForSubjectContaining(
        request,
        ticketId,
      )

      const elapsedMs = Date.now() - start

      expect(elapsedMs).toBeLessThan(5000)

      expect(message.From.Address).toBe('noreply@bug-shot.test')
      expect(message.To.some((to) => to.Address === mailboxAddress)).toBe(
        true,
      )
      expect(message.Subject).toContain(ticketId)
      expect(message.Subject).not.toContain('{{')

      const detail = await request.get(
        `${mailpitApiUrl}/api/v1/message/${message.ID}`,
      )

      expect(detail.status()).toBe(200)
      const body = (await detail.json()) as { Text: string }

      expect(body.Text).toContain(uniqueDescription)
      expect(body.Text).not.toContain('{{')
      expect(body.Text).not.toContain('null')
      expect(body.Text.trim()).not.toBe('0')
    } finally {
      await request.delete(
        `${apiBaseUrl}/api/v1/projects/${demoProjectId}/notifications/${channel.id}`,
        { headers: authHeader },
      )
    }
  })
})

type MailpitMessage = {
  ID: string
  From: { Address: string }
  To: { Address: string }[]
  Subject: string
}

async function pollMailpitForSubjectContaining(
  request: import('@playwright/test').APIRequestContext,
  needle: string,
): Promise<MailpitMessage> {
  const deadline = Date.now() + 10_000

  while (Date.now() < deadline) {
    const response = await request.get(
      `${mailpitApiUrl}/api/v1/search`,
      { params: { query: needle } },
    )

    if (response.ok()) {
      const payload = (await response.json()) as {
        messages: MailpitMessage[]
      }

      const found = payload.messages.find((m) => m.Subject.includes(needle))

      if (found) {
        return found
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 250))
  }

  throw new Error(
    `Mailpit did not receive an email with subject containing "${needle}" within 10s.`,
  )
}
