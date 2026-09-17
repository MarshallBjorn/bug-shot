import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { openSignedIn, reportFromWidget, ticketsPath } from './helpers'

// axe liczy kontrast na wartosciach zmieszanych, wiec w trakcie animacji wejscia dialogu
// widzi polprzezroczyste warstwy i zglasza naruszenia, ktorych po ustaniu ruchu nie ma
async function settle(page) {
  await page.waitForFunction(() => document.getAnimations().every((animation) => animation.playState !== 'running'))
}

async function expectDashboardAccessibility(
  page,
  contextName,
) {
  await settle(page)

  const results = await new AxeBuilder({ page }).analyze()

  const critical = results.violations.filter((violation) => violation.impact === 'critical')
  const serious = results.violations.filter((violation) => violation.impact === 'serious')

  expect(
    critical,
    `${contextName}: critical violations\n${JSON.stringify(critical, null, 2)}`,
  ).toHaveLength(0)

  expect(
    serious,
    `${contextName}: serious violations\n${JSON.stringify(serious, null, 2)}`,
  ).toHaveLength(0)
}

test.describe('dashboard accessibility', () => {
  test('lista nie ma naruszen critical ani serious', async ({ page }) => {
    await openSignedIn(page, ticketsPath())

    await expect(page.getByRole('heading', { name: 'Zgłoszenia' })).toBeVisible()

    await expectDashboardAccessibility(page, 'lista')
  })

  test('detail nie ma naruszen critical ani serious', async ({ page, request }) => {
    const { ticketId } = await reportFromWidget(request, `Axe detail ${Date.now()}`)

    await openSignedIn(page, `${ticketsPath()}/${ticketId}`)

    await expect(page.getByRole('heading', { level: 2 })).toBeVisible()

    await expectDashboardAccessibility(page, 'detail')
  })

  // viewer logu i lightbox to nowe powierzchnie, wiec wchodza pod te sama bramke
  test('viewer logu nie ma naruszen critical ani serious', async ({ page, request }) => {
    const { ticketId } = await reportFromWidget(request, `Axe log ${Date.now()}`)

    await openSignedIn(page, `${ticketsPath()}/${ticketId}`)
    await page.getByRole('button', { name: /Otwórz pełny log konsoli/ }).click()

    await expect(page.getByRole('list', { name: 'Wpisy logu konsoli' })).toBeVisible()

    await expectDashboardAccessibility(page, 'viewer logu')
  })

  test('lightbox nie ma naruszen critical ani serious', async ({ page, request }) => {
    const { ticketId } = await reportFromWidget(request, `Axe lightbox ${Date.now()}`)

    await openSignedIn(page, `${ticketsPath()}/${ticketId}`)
    await page.getByRole('button', { name: /Zrzut ekranu, kliknij aby powiększyć/ }).click()

    await expect(page.getByRole('dialog')).toBeVisible()

    await expectDashboardAccessibility(page, 'lightbox')
  })

  test('analityka nie ma naruszen critical ani serious', async ({ page, request }) => {
    await reportFromWidget(request, `Axe analityka ${Date.now()}`)

    await openSignedIn(page, ticketsPath().replace('/tickets', '/analytics'))

    await expect(page.getByRole('heading', { name: 'Analityka' })).toBeVisible()

    await expectDashboardAccessibility(page, 'analityka')
  })

  test('ciemny motyw nie ma naruszen critical ani serious', async ({ page }) => {
    await openSignedIn(page, ticketsPath())

    await page.getByRole('button', { name: 'Włącz motyw ciemny' }).click()

    await expect(page.getByRole('button', { name: 'Włącz motyw jasny' })).toBeVisible()

    await expectDashboardAccessibility(page, 'ciemny motyw')
  })
})
