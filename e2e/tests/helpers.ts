import { expect, type APIRequestContext, type Locator, type Page } from '@playwright/test'
import { crc32, deflateSync } from 'node:zlib'
import { admin, apiBaseUrl, demoProjectId, widgetOrigin } from '../e2e.config'

export function ticketsPath() {
  return `/projects/${demoProjectId}/tickets`
}

// lista i galeria maja nazwy dostepnosciowe wiec testy nie zaczepiaja sie o klasy CSS
export function ticketTable(page: Page): Locator {
  return page.getByRole('table', { name: 'Lista zgłoszeń' })
}

export function ticketRows(page: Page): Locator {
  return ticketTable(page).locator('tbody tr')
}

export function screenshotImage(page: Page): Locator {
  return page.getByRole('list', { name: 'Załączniki' }).getByRole('img')
}

// samo wypelnienie formularza bo przy zlym hasle nie ma na co czekac
export async function fillLoginForm(page: Page, password: string = admin.password) {
  await page.getByLabel('E-mail').fill(admin.email)
  await page.getByLabel('Hasło').fill(password)
  await page.getByRole('button', { name: 'Zaloguj' }).click()
}

// czekanie na naglowek jest konieczne bo bez niego kolejna nawigacja moze wyprzedzic ustawienie cookie
// adres konta szukamy w topbarze, bo na detalu pojawia sie tez w etykiecie formularza komentarza
export async function signIn(page: Page) {
  await fillLoginForm(page)
  await expect(page.getByRole('banner').getByText(admin.email)).toBeVisible()
}

export async function openSignedIn(page: Page, path: string) {
  await page.goto('/login')
  await signIn(page)
  await page.goto(path)
}

// API sprawdza sygnature i domkniecie pliku wiec zrzut musi byc prawdziwym PNG
export function screenshotBytes() {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(1, 0)
  header.writeUInt32BE(1, 4)
  header[8] = 8
  header[9] = 2

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(Buffer.from([0x00, 0x00, 0x00, 0x00]))),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// panel nie ma jeszcze ekranu zmiany statusu wiec e2e robi to zadaniem
export async function signInApi(request: APIRequestContext) {
  const response = await request.post(`${apiBaseUrl}/api/v1/auth/login`, {
    data: { email: admin.email, password: admin.password },
  })

  expect(response.status()).toBe(200)

  const session = (await response.json()) as { accessToken: string }

  return { Authorization: `Bearer ${session.accessToken}` }
}

// samo zgloszenie bo lista nie pokazuje zalacznikow
export async function reportTicket(request: APIRequestContext, description: string) {
  const created = await request.post(`${apiBaseUrl}/api/v1/tickets`, {
    headers: { Origin: widgetOrigin },
    data: {
      projectKey: 'demo',
      description,
      pageUrl: 'https://acme.example/cart',
      userAgent: 'playwright',
    },
  })

  expect(created.status()).toBe(201)

  return (await created.json()) as { id: string; uploadToken: string }
}

// widget nie ma konta wiec zglasza sam Originem i jednorazowym tokenem wysylki
export async function reportFromWidget(request: APIRequestContext, description: string) {
  const ticket = await reportTicket(request, description)

  const uploaded = await request.post(`${apiBaseUrl}/api/v1/tickets/${ticket.id}/attachments`, {
    headers: { 'X-Upload-Token': ticket.uploadToken, Origin: widgetOrigin },
    multipart: {
      screenshot: { name: 'zrzut.png', mimeType: 'image/png', buffer: screenshotBytes() },
      consoleLog: {
        name: 'konsola.txt',
        mimeType: 'text/plain',
        // ten sam format co formatDiagnosticEntry w widget/widget.js, inaczej panel nie ma czego sparsowac
        buffer: Buffer.from(
          [
            '[2026-09-17T10:00:00.000Z] ERROR console.error: koszyk nie przelicza rabatu',
            '[2026-09-17T10:00:05.000Z] WARN console.warn: brak ceny w odpowiedzi /api/cart',
            '',
          ].join('\n'),
        ),
      },
    },
  })

  expect(uploaded.status()).toBe(201)

  const attachments = (await uploaded.json()) as { id: string; kind: string }[]
  const byKind = (kind: string) => attachments.find((attachment) => attachment.kind === kind)!.id

  return {
    ticketId: ticket.id as string,
    attachmentId: byKind('Screenshot'),
    consoleLogId: byKind('ConsoleLog'),
  }
}

function chunk(type: string, data: Buffer) {
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const length = Buffer.alloc(4)
  const checksum = Buffer.alloc(4)

  length.writeUInt32BE(data.length)
  checksum.writeUInt32BE(crc32(body))

  return Buffer.concat([length, body, checksum])
}
