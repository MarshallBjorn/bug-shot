import { expect, type APIRequestContext, type Page } from '@playwright/test'
import { crc32, deflateSync } from 'node:zlib'
import { admin, apiBaseUrl, demoProjectId, widgetOrigin } from '../e2e.config'

export function ticketsPath() {
  return `/projects/${demoProjectId}/tickets`
}

// samo wypelnienie formularza bo przy zlym hasle nie ma na co czekac
export async function fillLoginForm(page: Page, password: string = admin.password) {
  await page.getByLabel('E-mail').fill(admin.email)
  await page.getByLabel('Hasło').fill(password)
  await page.getByRole('button', { name: 'Zaloguj' }).click()
}

// czekanie na naglowek jest konieczne bo bez niego kolejna nawigacja moze wyprzedzic ustawienie cookie
export async function signIn(page: Page) {
  await fillLoginForm(page)
  await expect(page.getByText(admin.email)).toBeVisible()
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

// widget nie ma konta wiec zglasza sam Originem i jednorazowym tokenem wysylki
export async function reportFromWidget(request: APIRequestContext, description: string) {
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

  const ticket = await created.json()

  const uploaded = await request.post(`${apiBaseUrl}/api/v1/tickets/${ticket.id}/attachments`, {
    headers: { 'X-Upload-Token': ticket.uploadToken, Origin: widgetOrigin },
    multipart: {
      screenshot: { name: 'zrzut.png', mimeType: 'image/png', buffer: screenshotBytes() },
    },
  })

  expect(uploaded.status()).toBe(201)

  const attachments = await uploaded.json()

  return { ticketId: ticket.id as string, attachmentId: attachments[0].id as string }
}

function chunk(type: string, data: Buffer) {
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const length = Buffer.alloc(4)
  const checksum = Buffer.alloc(4)

  length.writeUInt32BE(data.length)
  checksum.writeUInt32BE(crc32(body))

  return Buffer.concat([length, body, checksum])
}
