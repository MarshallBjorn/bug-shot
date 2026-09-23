import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AnalyticsRange, ProjectAnalytics } from '../api/analytics'
import ProjectAnalyticsPage from './ProjectAnalyticsPage'

const getProjectAnalytics = vi.fn()

vi.mock('../api/analytics', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/analytics')>()),
  getProjectAnalytics: (...args: unknown[]) => getProjectAnalytics(...args),
}))

function analytics(range: AnalyticsRange, newTickets: number): ProjectAnalytics {
  return {
    range,
    timeZone: 'Europe/Warsaw',
    includeToday: true,
    from: '2026-08-15T19:00:00Z',
    to: '2026-09-14T19:00:00Z',
    bucket: 'day',
    summary: {
      newTickets,
      previousNewTickets: 200,
      newToday: 10,
      openBacklog: 177,
      resolvedRate: 0.5233,
      rejectedRate: 0.093,
      screenshotRate: 0.8682,
      timeToResolve: { medianHours: 72, p90Hours: 122.2, samples: 135 },
      timeToFirstResponse: { medianHours: 4.8, p90Hours: 22.6, samples: 229 },
    },
    timeline: [{ date: '2026-09-14', created: 10, resolved: 7 }],
    statuses: [{ status: 'InProgress', count: 54 }],
    topPages: [{ page: 'sklep.example/koszyk', count: 61 }],
    risingPages: [],
    browsers: [{ name: 'Other', count: 3 }],
    operatingSystems: [{ name: 'iOS', count: 48 }],
    devices: [{ name: 'mobile', count: 90 }],
    sanitization: [{ ruleId: 'r1', pattern: 'sekret', isGlobal: true, matches: 7, tickets: 5 }],
  }
}

function renderPage(path = '/projects/p1/analytics') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="projects/:projectId/analytics" element={<ProjectAnalyticsPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  getProjectAnalytics.mockReset()
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('ProjectAnalyticsPage', () => {
  it('pokazuje kafelki i sekcje z odpowiedzi', async () => {
    getProjectAnalytics.mockResolvedValue(analytics('30d', 259))

    renderPage()

    expect(await screen.findByText('259')).toBeTruthy()
    expect(screen.getByText('poprzednio 200 (+29,5%)')).toBeTruthy()
    expect(screen.getByText('3 dni')).toBeTruthy()
    expect(screen.getByText('52,3%')).toBeTruthy()
    // sekcje ze slupkami trzymaja tabele w zwinietym details, wiec etykieta jest dwa razy
    const statuses = within(screen.getByRole('list', { name: 'Statusy' }))
    expect(statuses.getByText('W trakcie')).toBeTruthy()

    expect(
      within(screen.getByRole('list', { name: 'Najczęstsze strony' })).getByText(
        'sklep.example/koszyk',
      ),
    ).toBeTruthy()
    expect(
      within(screen.getByRole('list', { name: 'Przeglądarki' })).getByText('Inne'),
    ).toBeTruthy()
    expect(
      within(screen.getByRole('list', { name: 'Urządzenia' })).getByText('Telefon'),
    ).toBeTruthy()
    expect(screen.getByText('globalna')).toBeTruthy()
    expect(screen.getAllByText('Brak danych w tym zakresie.')).toHaveLength(1)

    expect(getProjectAnalytics).toHaveBeenCalledWith('p1', '30d', true, expect.any(String), expect.any(AbortSignal))
  })

  it('zmiana zakresu pyta o nowy zakres i do odpowiedzi zostawia poprzednie dane', async () => {
    let answerWeek: (value: ProjectAnalytics) => void = () => {}

    getProjectAnalytics
      .mockResolvedValueOnce(analytics('30d', 259))
      .mockReturnValueOnce(new Promise((resolve) => (answerWeek = resolve)))

    renderPage()
    expect(await screen.findByText('259')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: '7 dni' }))

    expect(getProjectAnalytics).toHaveBeenLastCalledWith('p1', '7d', true, expect.any(String), expect.any(AbortSignal))
    expect(screen.getByText('259')).toBeTruthy()
    expect(screen.getByRole('button', { name: '7 dni' }).getAttribute('aria-pressed')).toBe('true')

    await act(async () => answerWeek(analytics('7d', 42)))

    await waitFor(() => expect(screen.getByText('42')).toBeTruthy())
    expect(screen.queryByText('259')).toBeNull()
  })

  it('zakres z adresu trafia do zapytania a nieznany wraca do domyslnego', async () => {
    getProjectAnalytics.mockResolvedValue(analytics('90d', 1))

    renderPage('/projects/p1/analytics?range=90d')
    await screen.findByText('1')
    expect(getProjectAnalytics).toHaveBeenCalledWith('p1', '90d', true, expect.any(String), expect.any(AbortSignal))

    cleanup()

    renderPage('/projects/p1/analytics?range=rok')
    await waitFor(() =>
      expect(getProjectAnalytics).toHaveBeenLastCalledWith('p1', '30d', true, expect.any(String), expect.any(AbortSignal)),
    )
  })

  it('odznaczenie dzisiejszego dnia pyta bez niego i zostawia wybrany zakres', async () => {
    getProjectAnalytics.mockResolvedValue(analytics('90d', 333))

    renderPage('/projects/p1/analytics?range=90d')
    await screen.findByText('333')

    const today = screen.getByRole('checkbox', { name: 'Z dzisiejszym dniem' }) as HTMLInputElement
    expect(today.checked).toBe(true)

    fireEvent.click(today)

    await waitFor(() =>
      expect(getProjectAnalytics).toHaveBeenLastCalledWith('p1', '90d', false, expect.any(String), expect.any(AbortSignal)),
    )
    expect((screen.getByRole('checkbox', { name: 'Z dzisiejszym dniem' }) as HTMLInputElement).checked).toBe(false)
    expect(screen.getByRole('button', { name: '90 dni' }).getAttribute('aria-pressed')).toBe('true')
  })

  it('pobiera sekcje jako CSV', async () => {
    getProjectAnalytics.mockResolvedValue(analytics('30d', 259))

    const created = vi.fn((_blob: Blob) => 'blob:csv')
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: created, revokeObjectURL: vi.fn() }))
    const clicked = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    renderPage()
    await screen.findByText('259')

    fireEvent.click(
      screen.getByRole('button', { name: 'Pobierz CSV: Najczęstsze strony' }),
    )

    expect(clicked).toHaveBeenCalledOnce()
    expect(await created.mock.calls[0][0].text()).toContain('Strona,Zgłoszenia\r\nsklep.example/koszyk,61')
  })

  it('pokazuje blad pobierania', async () => {
    getProjectAnalytics.mockRejectedValue(new Error('HTTP 500'))

    renderPage()

    expect((await screen.findByRole('alert')).textContent).toContain('HTTP 500')
  })
})
