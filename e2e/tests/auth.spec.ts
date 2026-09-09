import { expect, test } from '@playwright/test'
import { admin } from '../e2e.config'
import { fillLoginForm, signIn, ticketsPath } from './helpers'

test.describe('dostep do panelu', () => {
  test('niezalogowany trafia na ekran logowania', async ({ page }) => {
    await page.goto(ticketsPath())

    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByRole('button', { name: 'Zaloguj' })).toBeVisible()
  })

  test('zle haslo pokazuje blad i nie wpuszcza dalej', async ({ page }) => {
    await page.goto('/login')
    await fillLoginForm(page, 'zupelnie-inne-haslo')

    await expect(page.getByRole('alert')).toHaveText('Nieprawidłowy e-mail albo hasło.')
    await expect(page).toHaveURL(/\/login$/)
  })

  test('poprawne logowanie wraca pod pierwotny adres', async ({ page }) => {
    await page.goto(ticketsPath())
    await expect(page).toHaveURL(/\/login$/)

    await signIn(page)

    await expect(page).toHaveURL(new RegExp(`${ticketsPath()}$`))
  })

  test('sesja przezywa odswiezenie strony', async ({ page }) => {
    await page.goto('/login')
    await signIn(page)

    await page.reload()

    await expect(page).not.toHaveURL(/\/login$/)
    await expect(page.getByText(admin.email)).toBeVisible()
  })

  test('wylogowanie zamyka sesje na dobre', async ({ page }) => {
    await page.goto('/login')
    await signIn(page)
    await page.getByRole('button', { name: 'Wyloguj' }).click()

    await expect(page).toHaveURL(/\/login$/)

    // po wylogowaniu cookie juz nie odtworzy sesji
    await page.goto(ticketsPath())
    await expect(page).toHaveURL(/\/login$/)
  })

  // token odswiezajacy ma byc poza zasiegiem skryptow na stronie
  test('token odswiezajacy nie jest widoczny dla javascriptu', async ({ page }) => {
    await page.goto('/login')
    await signIn(page)

    await expect(page.evaluate(() => document.cookie)).resolves.not.toContain('bugshot_refresh')
  })

  test('access token nie zostaje w pamieci przegladarki', async ({ page }) => {
    await page.goto('/login')
    await signIn(page)

    const stored = await page.evaluate(() => JSON.stringify({
      local: { ...localStorage },
      session: { ...sessionStorage },
    }))

    expect(stored).not.toContain('eyJ')
  })
})

test.describe('kilka kart naraz', () => {
  test('obie karty zostaja zalogowane gdy wstaja jednoczesnie', async ({ context }) => {
    const first = await context.newPage()
    await first.goto('/login')
    await signIn(first)
    await first.close()

    // przywrocenie sesji przegladarki podnosi obie karty w tej samej chwili
    // obie ida po nowy token tym samym cookie wiec panel musi je ustawic w kolejce
    const tabs = [await context.newPage(), await context.newPage()]

    await Promise.all(tabs.map((tab) => tab.goto(ticketsPath())))

    for (const tab of tabs) {
      await expect(tab).toHaveURL(new RegExp(`${ticketsPath()}$`))
      await expect(tab.getByText(admin.email)).toBeVisible()
    }
  })
})
