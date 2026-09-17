import { expect, test } from '@playwright/test'
import { demoProjectId } from '../e2e.config'
import { openSignedIn, reportFromWidget, screenshotImage, signIn, ticketsPath } from './helpers'

test.describe('zalaczniki za tokenem', () => {
  test('zalogowany widzi zrzut w szczegolach zgloszenia', async ({ page, request }) => {
    const { ticketId } = await reportFromWidget(request, 'Zgloszenie ze zrzutem')

    await page.goto(`${ticketsPath()}/${ticketId}`)
    await signIn(page)

    await expect(page.getByRole('heading', { name: 'Zgloszenie ze zrzutem' })).toBeVisible()

    const screenshot = screenshotImage(page)

    await expect(screenshot).toBeVisible()

    // plik przychodzi zadaniem z tokenem i trafia na strone jako blob
    await expect(screenshot).toHaveAttribute('src', /^blob:/)
    await expect
      .poll(() => screenshot.evaluate((image: HTMLImageElement) => image.naturalWidth))
      .toBeGreaterThan(0)
  })

  test('log konsoli schodzi z serwera dopiero po kliknieciu', async ({ page, request }) => {
    const { ticketId, consoleLogId } = await reportFromWidget(request, 'Zgloszenie z logiem')

    const pobrania: string[] = []

    page.on('request', (call) => {
      if (call.url().includes(`/attachments/${consoleLogId}/download`)) {
        pobrania.push(call.url())
      }
    })

    await openSignedIn(page, `${ticketsPath()}/${ticketId}`)

    // zrzut musi wejsc na strone od razu wiec czekamy az sie ustoi
    await expect(screenshotImage(page)).toBeVisible()

    expect(pobrania).toHaveLength(0)

    const [pobrany] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Pobierz log konsoli' }).click(),
    ])

    expect(pobrany.suggestedFilename()).toBe('konsola.txt')
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
