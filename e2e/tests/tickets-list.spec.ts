import { expect, test } from '@playwright/test'
import { apiBaseUrl } from '../e2e.config'
import { openSignedIn, reportTicket, signInApi, ticketRows, ticketsPath, ticketTable } from './helpers'

test.describe('paginacja i kanal live', () => {
  test('zgloszenie z widgetu wchodzi na liste bez ponownego pobrania listy', async ({
    page,
    request,
  }) => {
    const pobrania: string[] = []

    page.on('request', (call) => {
      if (call.url().startsWith(`${apiBaseUrl}/api/v1/projects/`)) {
        pobrania.push(call.url())
      }
    })

    await openSignedIn(page, ticketsPath())

    await expect(page.getByText('Kanał live aktywny')).toBeVisible()
    await expect(ticketTable(page)).toBeVisible()

    const wierszy = await ticketRows(page).count()

    // vite w trybie deweloperskim montuje efekt dwa razy wiec liczy sie przyrost a nie sama liczba
    const przedZdarzeniem = pobrania.length

    await reportTicket(request, 'Zgloszenie prosto z kanalu live')

    await expect(page.getByRole('link', { name: 'Zgloszenie prosto z kanalu live' })).toBeVisible()

    // wiersz przyszedl kanalem bo lista nie poszla do API drugi raz
    expect(pobrania).toHaveLength(przedZdarzeniem)

    // licznik idzie za tym samym zdarzeniem co lista
    await expect(page.getByText(`Koniec listy, ${wierszy + 1} wynik`, { exact: false })).toBeVisible()
  })

  test('zmiana statusu i skasowanie dochodza do otwartej listy', async ({ page, request }) => {
    const opis = 'Zgloszenie pod zmiane statusu'
    const ticket = await reportTicket(request, opis)
    const headers = await signInApi(request)

    await openSignedIn(page, `${ticketsPath()}?search=${encodeURIComponent(opis)}`)

    const wiersz = ticketRows(page).filter({ hasText: opis })

    await expect(wiersz).toContainText('Nowe')

    const details = await request.get(`${apiBaseUrl}/api/v1/tickets/${ticket.id}`, { headers })
    const { rowVersion } = (await details.json()) as { rowVersion: string }

    const zmiana = await request.patch(`${apiBaseUrl}/api/v1/tickets/${ticket.id}/status`, {
      headers: { ...headers, 'If-Match': rowVersion },
      data: { status: 'InProgress', changedBy: 'e2e' },
    })

    expect(zmiana.status()).toBe(200)

    await expect(wiersz).toContainText('W trakcie')

    const skasowanie = await request.delete(`${apiBaseUrl}/api/v1/tickets/${ticket.id}`, { headers })

    expect(skasowanie.status()).toBe(204)

    await expect(wiersz).toHaveCount(0)
    await expect(page.getByText('Żadne zgłoszenie nie pasuje do filtrów.')).toBeVisible()
  })

  test('doladowanie dokleja kolejna strone', async ({ page, request }) => {
    for (const numer of [1, 2, 3]) {
      await reportTicket(request, `Paginacja kursorowa ${numer}`)
    }

    await openSignedIn(page, `${ticketsPath()}?limit=2&search=Paginacja+kursorowa`)

    const wiersze = ticketRows(page)

    await expect(wiersze).toHaveCount(2)
    await expect(page.getByText('Pokazano 2 z 3')).toBeVisible()

    await page.getByRole('button', { name: 'Załaduj więcej' }).click()

    await expect(wiersze).toHaveCount(3)
    await expect(page.getByText('Koniec listy, 3 wyniki')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Załaduj więcej' })).toHaveCount(0)
  })
})
