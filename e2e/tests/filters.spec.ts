import { expect, test } from '@playwright/test'
import { openSignedIn, reportTicket, ticketRows, ticketsPath } from './helpers'

test.describe('filtry i grupowanie po stronach', () => {
  test('klik w strone w panelu bocznym ustawia filtr i adres', async ({ page, request }) => {
    await reportTicket(request, `Filtr po stronie ${Date.now()}`)

    await openSignedIn(page, ticketsPath())

    const strona = page
      .getByRole('list', { name: 'Strony projektu' })
      .getByTitle('acme.example/cart')

    await expect(strona).toBeVisible()
    await strona.click()

    await expect(page).toHaveURL(/page=acme\.example%2Fcart/)

    // chip nad lista pokazuje co jest aktywne i pozwala to zdjac
    await expect(page.getByRole('button', { name: /Zdejmij filtr Strona/ })).toBeVisible()
  })

  test('licznik przy stronie zgadza sie z liczba trafien', async ({ page, request }) => {
    await reportTicket(request, `Licznik strony ${Date.now()}`)

    await openSignedIn(page, ticketsPath())

    const strona = page
      .getByRole('list', { name: 'Strony projektu' })
      .getByTitle('acme.example/cart')

    const licznik = Number((await strona.textContent())?.match(/(\d+)\s*$/)?.[1] ?? '0')

    expect(licznik).toBeGreaterThan(0)

    await strona.click()

    await expect(page.getByText(`${licznik} `, { exact: false }).first()).toBeVisible()
  })

  test('filtry skladaja sie w adresie i zawezaja liste', async ({ page, request }) => {
    const opis = `Skladane filtry ${Date.now()}`
    await reportTicket(request, opis)

    await openSignedIn(
      page,
      `${ticketsPath()}?status=New&page=acme.example/cart&hasScreenshot=false&search=${encodeURIComponent(opis)}`,
    )

    await expect(ticketRows(page)).toHaveCount(1)
    await expect(ticketRows(page).first()).toContainText(opis)

    // kazdy wymiar ma wlasny chip
    await expect(page.getByRole('button', { name: 'Zdejmij filtr Nowe' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Zdejmij filtr Bez zrzutu' })).toBeVisible()
  })

  test('czyszczenie zdejmuje wszystkie filtry naraz', async ({ page, request }) => {
    await reportTicket(request, `Czyszczenie ${Date.now()}`)

    await openSignedIn(page, `${ticketsPath()}?status=New&hasScreenshot=false`)

    await page.getByRole('button', { name: 'Wyczyść filtry' }).click()

    await expect(page).not.toHaveURL(/status=/)
    await expect(page.getByRole('button', { name: /Zdejmij filtr/ })).toHaveCount(0)
  })

  test('zapisany filtr wraca z panelu bocznego', async ({ page, request }) => {
    await reportTicket(request, `Zapisany filtr ${Date.now()}`)

    await openSignedIn(page, `${ticketsPath()}?status=New`)

    await page.getByRole('button', { name: 'Zapisz filtr' }).click()
    await page.getByLabel('Nazwa').fill('Tylko nowe')
    await page.getByRole('button', { name: 'Zapisz', exact: true }).click()

    await page.goto(ticketsPath())

    await page
      .getByRole('list', { name: 'Zapisane filtry' })
      .getByRole('button', { name: 'Tylko nowe', exact: true })
      .click()

    await expect(page).toHaveURL(/status=New/)
  })
})

test.describe('skroty klawiszowe', () => {
  test('j przesuwa podswietlenie a enter otwiera zgloszenie', async ({ page, request }) => {
    const opis = `Skrot klawiszowy ${Date.now()}`
    await reportTicket(request, opis)

    await openSignedIn(page, `${ticketsPath()}?search=${encodeURIComponent(opis)}`)

    await expect(ticketRows(page)).toHaveCount(1)

    await page.keyboard.press('j')

    // podswietlenie idzie realnym focusem, nie tylko kolorem
    await expect(page.getByRole('link', { name: opis })).toBeFocused()

    await page.keyboard.press('Enter')

    await expect(page).toHaveURL(/\/tickets\/[0-9a-f-]+$/)
  })

  test('ukosnik oddaje focus polu szukania', async ({ page }) => {
    await openSignedIn(page, ticketsPath())

    // nasluch skrotow montuje sie razem z lista, wiec klawisz przed nia po prostu przepada
    await expect(page.getByRole('heading', { name: 'Zgłoszenia' })).toBeVisible()

    await page.keyboard.press('/')

    await expect(page.getByRole('searchbox', { name: 'Szukaj' })).toBeFocused()
  })

  test('znak zapytania otwiera pomoc ze skrotami', async ({ page }) => {
    await openSignedIn(page, ticketsPath())

    await expect(page.getByRole('heading', { name: 'Zgłoszenia' })).toBeVisible()

    await page.keyboard.press('?')

    await expect(page.getByRole('heading', { name: 'Skróty klawiszowe' })).toBeVisible()
  })

  // pisanie w polu nie moze wywolywac skrotow, inaczej / byloby nie do wpisania
  test('skroty milcza gdy focus jest w polu szukania', async ({ page }) => {
    await openSignedIn(page, ticketsPath())

    await expect(page.getByRole('heading', { name: 'Zgłoszenia' })).toBeVisible()

    const szukaj = page.getByRole('searchbox', { name: 'Szukaj' })

    await szukaj.fill('j')

    await expect(szukaj).toHaveValue('j')
    await expect(page.getByRole('heading', { name: 'Skróty klawiszowe' })).toHaveCount(0)
  })
})
