import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getProjects } from '../api/projects'
import { useManagesAnyProject, useProjectRole, useProjects } from './ProjectsContext'
import { ProjectsProvider } from './ProjectsProvider'

vi.mock('../api/projects', () => ({
  getProjects: vi.fn(),
}))

const project = { id: 'p1', name: 'Acme', key: 'acme', createdAt: '2026-09-01', origins: [] }

function Probe() {
  const { loading, reload } = useProjects()
  const role = useProjectRole('p1')
  const manages = useManagesAnyProject()

  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="role">{role ?? 'brak'}</span>
      <span data-testid="manages">{String(manages)}</span>
      <button type="button" onClick={reload}>
        Odswiez
      </button>
    </div>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  cleanup()
})

describe('ProjectsProvider', () => {
  it('podaje role konta w projekcie', async () => {
    vi.mocked(getProjects).mockResolvedValue([{ ...project, role: 'Member' }])

    render(
      <ProjectsProvider>
        <Probe />
      </ProjectsProvider>,
    )

    expect(screen.getByTestId('role').textContent).toBe('brak')
    expect(await screen.findByText('Member')).toBeDefined()
    expect(screen.getByTestId('manages').textContent).toBe('false')
  })

  it('maintainer choc jednego projektu zarzadza projektami', async () => {
    vi.mocked(getProjects).mockResolvedValue([{ ...project, role: 'Maintainer' }])

    render(
      <ProjectsProvider>
        <Probe />
      </ProjectsProvider>,
    )

    await vi.waitFor(() => expect(screen.getByTestId('manages').textContent).toBe('true'))
  })

  it('blad pobrania zostawia pusta liste bez akcji', async () => {
    vi.mocked(getProjects).mockRejectedValue(new Error('500'))

    render(
      <ProjectsProvider>
        <Probe />
      </ProjectsProvider>,
    )

    await vi.waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'))
    expect(screen.getByTestId('role').textContent).toBe('brak')
  })

  it('odswiezenie pyta API jeszcze raz', async () => {
    vi.mocked(getProjects).mockResolvedValue([])

    render(
      <ProjectsProvider>
        <Probe />
      </ProjectsProvider>,
    )

    await vi.waitFor(() => expect(getProjects).toHaveBeenCalledTimes(1))

    fireEvent.click(screen.getByRole('button', { name: 'Odswiez' }))

    await vi.waitFor(() => expect(getProjects).toHaveBeenCalledTimes(2))
  })

  it('hook poza providerem mowi czego brakuje', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => render(<Probe />)).toThrow('ProjectsProvider')
  })
})
