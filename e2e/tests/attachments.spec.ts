import { expect, test } from '@playwright/test'
import { apiBaseUrl, demoProjectId } from '../e2e.config'
import { openSignedIn, reportFromWidget, signIn, ticketsPath } from './helpers'

test.describe('zalaczniki za tokenem', () => {
  test('widget zglasza i wysyla zrzut bez logowania', async ({ request }) => {
    const { ticketId, attachmentId } = await reportFromWidget(request, 'Zgloszenie z widgetu')

    expect(ticketId).toBeTruthy()
    expect(attachmentId).toBeTruthy()
  })

  test('plik nie wychodzi bez tokena', async ({ request }) => {
    const { attachmentId } = await reportFromWidget(request, 'Zgloszenie do pobrania')

    const response = await request.get(`${apiBaseUrl}/api/v1/attachments/${attachmentId}/download`)

    expect(response.status()).toBe(401)
  })

  test('zalogowany widzi zrzut w szczegolach zgloszenia', async ({ page, request }) => {
    const { ticketId } = await reportFromWidget(request, 'Zgloszenie ze zrzutem')

    await page.goto(`${ticketsPath()}/${ticketId}`)
    await signIn(page)

    await expect(page.getByRole('heading', { name: 'Zgloszenie ze zrzutem' })).toBeVisible()

    const screenshot = page.locator('.attachments img')

    await expect(screenshot).toBeVisible()

    // plik przychodzi zadaniem z tokenem i trafia na strone jako blob
    await expect(screenshot).toHaveAttribute('src', /^blob:/)
    await expect
      .poll(() => screenshot.evaluate((image: HTMLImageElement) => image.naturalWidth))
      .toBeGreaterThan(0)
  })

  test('pobrany plik ma naglowki ktore trzymal wczesniej nginx', async ({ request }) => {
    const { attachmentId } = await reportFromWidget(request, 'Zgloszenie z naglowkami')

    const login = await request.post(`${apiBaseUrl}/api/v1/auth/login`, {
      data: { email: 'admin@bug-shot.test', password: process.env.E2E_ADMIN_PASSWORD ?? 'e2e-admin-not-a-real-password' },
    })

    const { accessToken } = await login.json()

    const response = await request.get(`${apiBaseUrl}/api/v1/attachments/${attachmentId}/download`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    expect(response.status()).toBe(200)
    expect(response.headers()['content-disposition']).toContain('attachment')
    expect(response.headers()['x-content-type-options']).toBe('nosniff')
    expect(response.headers()['cache-control']).toContain('no-store')
  })
})

test.describe('lista zgloszen', () => {
  test('pokazuje zgloszenie przyslane przez widget', async ({ page, request }) => {
    await reportFromWidget(request, 'Zgloszenie na liscie')

    await openSignedIn(page, ticketsPath())

    await expect(page.getByRole('link', { name: 'Zgloszenie na liscie' })).toBeVisible()
  })

  test('wejscie w szczegoly pokazuje dane zgloszenia', async ({ page, request }) => {
    const { ticketId } = await reportFromWidget(request, 'Zgloszenie do podgladu')

    await openSignedIn(page, `${ticketsPath()}/${ticketId}`)

    await expect(page.getByRole('heading', { name: 'Zgloszenie do podgladu' })).toBeVisible()
    await expect(page.getByText('https://acme.example/cart')).toBeVisible()
    expect(page.url()).toContain(demoProjectId)
  })
})
