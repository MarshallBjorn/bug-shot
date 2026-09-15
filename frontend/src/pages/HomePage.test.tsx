import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import HomePage from './HomePage'

const getProjects = vi.fn()
const useAuth = vi.fn()

vi.mock('../api/projects', () => ({
  getProjects: (...args: unknown[]) => getProjects(...args),
}))

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => useAuth(),
}))

function renderAs(isAdmin: boolean) {
  useAuth.mockReturnValue({ user: { email: 'ktos@bug-shot.test', isAdmin } })

  return render(
    <MemoryRouter>
      <HomePage />
    </MemoryRouter>,
  )
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('HomePage', () => {
  it('pokazuje deweloperowi liste projektow z linkami do zgloszen', async () => {
    getProjects.mockResolvedValue([
      { id: 'p1', name: 'Sklep', key: 'sklep', createdAt: '2026-09-14T10:00:00Z', origins: [] },
    ])

    renderAs(false)

    const link = await screen.findByRole('link', { name: 'Sklep' })

    expect(link.getAttribute('href')).toBe('/projects/p1/tickets')
    expect(screen.queryByRole('link', { name: 'Zarządzaj projektami' })).toBeNull()
  })

  it('daje adminowi przejscie do zarzadzania projektami nad lista', async () => {
    getProjects.mockResolvedValue([
      { id: 'p1', name: 'Sklep', key: 'sklep', createdAt: '2026-09-14T10:00:00Z', origins: [] },
    ])

    renderAs(true)

    const manage = await screen.findByRole('link', { name: 'Zarządzaj projektami' })

    expect(manage.getAttribute('href')).toBe('/admin/projects')
    expect(screen.getByRole('link', { name: 'Sklep' })).toBeTruthy()
  })

  it('bez projektow odsyla admina do panelu a dewelopera nie', async () => {
    getProjects.mockResolvedValue([])

    renderAs(true)
    expect(await screen.findByRole('link', { name: 'panelu projektów' })).toBeTruthy()

    cleanup()

    renderAs(false)
    expect(await screen.findByText('Brak projektów. Zakłada je administrator.')).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'panelu projektów' })).toBeNull()
  })

  it('pokazuje blad pobierania', async () => {
    getProjects.mockRejectedValue(new Error('HTTP 500'))

    renderAs(false)

    expect((await screen.findByRole('alert')).textContent).toContain('HTTP 500')
  })
})
