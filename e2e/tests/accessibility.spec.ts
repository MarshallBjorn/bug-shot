import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { openSignedIn, reportFromWidget, ticketsPath } from './helpers'

async function expectDashboardAccessibility(
  page,
  contextName,
) {
  const results = await new AxeBuilder({ page }).analyze()

  const critical = results.violations.filter((violation) => violation.impact === 'critical')
  const serious = results.violations.filter((violation) => violation.impact === 'serious')

  expect(
    critical,
    `${contextName}: critical violations\n${JSON.stringify(critical, null, 2)}`,
  ).toHaveLength(0)

  expect(
    serious.length,
    `${contextName}: serious violations\n${JSON.stringify(serious, null, 2)}`,
  ).toBeLessThanOrEqual(3)
}

test.describe('dashboard accessibility', () => {
  test('lista ma zero critical i maksymalnie 3 serious', async ({ page }) => {
    await openSignedIn(page, ticketsPath())

    await expect(page.getByRole('heading', { name: 'Zgłoszenia' })).toBeVisible()

    await expectDashboardAccessibility(page, 'lista')
  })

  test('detail ma zero critical i maksymalnie 3 serious', async ({
    page,
    request,
  }) => {
    const { ticketId } = await reportFromWidget(request, `Axe detail ${Date.now()}`)

    await openSignedIn(page, `${ticketsPath()}/${ticketId}`)

    await expectDashboardAccessibility(page, 'detail')
  })
})
