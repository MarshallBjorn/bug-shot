import { expect, test } from '@playwright/test'
import { demoProjectId } from '../e2e.config'
import { openSignedIn, reportFromWidget, signIn, ticketsPath } from './helpers'

test.describe('zalaczniki za tokenem', () => {
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
