import { expect, test } from '@playwright/test'
import { apiBaseUrl, widgetOrigin } from '../e2e.config'
import { openSignedIn, ticketsPath } from './helpers'

test('widget init -> submit ze screenshotem -> backend -> dashboard -> filtr -> detail', async ({
  page,
}) => {
  const description = `E2E widget happy path ${Date.now()}`

  await page.goto(`${widgetOrigin}/`)

  const widgetButton = page.locator('.bugshot-fab')
  await expect(widgetButton).toBeVisible()

  await widgetButton.click()

  const descriptionField = page.locator('#bugshot-description')
  await expect(descriptionField).toBeVisible()

  await descriptionField.fill(description)

  await page.evaluate(() => {
    console.warn('E2E widget happy path diagnostic')
  })

  const ticketResponsePromise = page.waitForResponse((response) =>
    response.url() === `${apiBaseUrl}/api/v1/tickets` &&
    response.request().method() === 'POST' &&
    response.status() === 201,
  )

  const attachmentResponsePromise = page.waitForResponse((response) =>
    /\/api\/v1\/tickets\/[^/]+\/attachments$/.test(response.url()) &&
    response.request().method() === 'POST' &&
    response.status() === 201,
  )

  await expect(page.locator('.bugshot-submit')).toBeEnabled()
  await page.locator('.bugshot-submit').click()

  const ticketResponse = await ticketResponsePromise
  const attachmentResponse = await attachmentResponsePromise

  expect(ticketResponse.status()).toBe(201)
  expect(attachmentResponse.status()).toBe(201)

  const successView = page.locator('.bugshot-success-view')
  await expect(successView).toBeVisible()

  const ticketId = await page
    .locator('.bugshot-success-ticket code')
    .textContent()

  expect(ticketId).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  )

  await openSignedIn(page, `${ticketsPath()}/${ticketId}`)

  await expect(page.getByRole('heading', { name: description })).toBeVisible()

  const screenshot = page.locator('.attachments img')
  await expect(screenshot).toBeVisible()
  await expect(screenshot).toHaveAttribute('src', /^blob:/)

  await expect
    .poll(() => screenshot.evaluate((image) => image.naturalWidth))
    .toBeGreaterThan(0)

  await page.goto(ticketsPath())

  const search = page.getByRole('searchbox', { name: 'Szukaj' })
  await search.fill(description)

  const ticketLink = page.getByRole('link', { name: description })
  await expect(ticketLink).toBeVisible()
  await ticketLink.click()

  await expect(page.getByRole('heading', { name: description })).toBeVisible()
  await expect(page.locator('.attachments img')).toBeVisible()
})
