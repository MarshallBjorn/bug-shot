import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import UserAccessDialog from './UserAccessDialog'
import type { Project, UserAccount } from '../types'

const projects: Project[] = Array.from({ length: 12 }, (_, index) => ({
  id: `p${index}`,
  name: index === 3 ? 'Łódź portal' : `Projekt ${index}`,
  key: `k${index}`,
  createdAt: '2026-09-01',
  origins: [],
  role: 'Maintainer',
}))

const account: UserAccount = {
  id: 'u1',
  email: 'dev@acme.example',
  isAdmin: false,
  state: 'Active',
  createdAt: '2026-09-01',
  projects: projects.slice(0, 8).map((p) => ({ projectId: p.id, projectName: p.name, role: 'Member' })),
}

beforeAll(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
})

afterAll(() => {
  vi.unstubAllGlobals()
})

afterEach(() => {
  cleanup()
})

describe('UserAccessDialog', () => {
  it('przy dlugiej liscie filtruje przypisane bez ogonkow', () => {
    render(
      <UserAccessDialog account={account} projects={projects} isSelf={false} onCancel={vi.fn()} onSubmit={vi.fn()} />,
    )

    const list = screen.getByRole('list', { name: 'Projekty z dostępem' })
    expect(list.children).toHaveLength(8)

    fireEvent.change(screen.getByLabelText('Szukaj wśród przypisanych projektów'), { target: { value: 'lodz' } })
    expect(list.textContent).toContain('Łódź portal')
    expect(list.children).toHaveLength(1)

    fireEvent.change(screen.getByLabelText('Szukaj wśród przypisanych projektów'), { target: { value: 'zzz' } })
    expect(list.textContent).toContain('Nic nie pasuje.')
  })

  it('krotka lista nie ma filtra a pusta mowi co zobaczy konto', () => {
    render(
      <UserAccessDialog account={null} projects={projects} isSelf={false} onCancel={vi.fn()} onSubmit={vi.fn()} />,
    )

    expect(screen.queryByLabelText('Szukaj wśród przypisanych projektów')).toBeNull()
    expect(screen.getByText(/konto zobaczy pustą listę/)).toBeDefined()
  })

  it('bez projektow nie ma czego wybierac', () => {
    render(<UserAccessDialog account={null} projects={[]} isSelf={false} onCancel={vi.fn()} onSubmit={vi.fn()} />)

    expect(screen.getByText('Nie ma jeszcze żadnego projektu.')).toBeDefined()
  })
})
