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

  // blok logu na detalu pokazuje liczniki per poziom, wiec tresc musi zejsc razem z widokiem
  // otwarcie viewera korzysta z tego co juz jest i nie odpytuje serwera drugi raz
  test('log konsoli schodzi raz razem z widokiem i wystarcza viewerowi', async ({
    page,
    request,
  }) => {
    const { ticketId, consoleLogId } = await reportFromWidget(request, 'Zgloszenie z logiem')

    const pobrania: string[] = []

    page.on('request', (call) => {
      if (call.url().includes(`/attachments/${consoleLogId}/download`)) {
        pobrania.push(call.url())
      }
    })

    await openSignedIn(page, `${ticketsPath()}/${ticketId}`)

    await expect(screenshotImage(page)).toBeVisible()
    await expect(page.getByRole('button', { name: /Otwórz pełny log konsoli/ })).toBeVisible()

    const poWejsciu = pobrania.length

    expect(poWejsciu).toBeGreaterThan(0)

    await page.getByRole('button', { name: /Otwórz pełny log konsoli/ }).click()

    await expect(page.getByRole('list', { name: 'Wpisy logu konsoli' })).toBeVisible()

    expect(pobrania).toHaveLength(poWejsciu)
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
