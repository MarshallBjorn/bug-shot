import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import RequireProjectManager from './RequireProjectManager'

const state = vi.hoisted(() => ({ isAdmin: false, loading: false, manages: false }))

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1', email: 'a@b.test', isAdmin: state.isAdmin, isActive: true } }),
}))

vi.mock('../projects/ProjectsContext', () => ({
  useProjects: () => ({ projects: [], loading: state.loading, reload: vi.fn() }),
  useManagesAnyProject: () => state.manages,
}))

vi.mock('react-router', () => ({
  Navigate: ({ to }: { to: string }) => <div data-testid="navigate" data-to={to} />,
  Outlet: () => <div data-testid="outlet" />,
}))

afterEach(() => {
  cleanup()
  Object.assign(state, { isAdmin: false, loading: false, manages: false })
})

describe('RequireProjectManager', () => {
  it('administrator wchodzi od razu', () => {
    state.isAdmin = true
    state.loading = true

    render(<RequireProjectManager />)

    expect(screen.getByTestId('outlet')).toBeDefined()
  })

  it('czeka na liste projektow', () => {
    state.loading = true

    render(<RequireProjectManager />)

    expect(screen.getByText('Ładowanie widoku...')).toBeDefined()
  })

  it('maintainer wchodzi', () => {
    state.manages = true

    render(<RequireProjectManager />)

    expect(screen.getByTestId('outlet')).toBeDefined()
  })

  it('reszta wraca na strone glowna', () => {
    render(<RequireProjectManager />)

    expect(screen.getByTestId('navigate').getAttribute('data-to')).toBe('/')
  })
})
