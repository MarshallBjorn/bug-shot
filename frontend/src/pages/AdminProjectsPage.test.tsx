import React from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AdminProjectsPage from './AdminProjectsPage'
import {
  addProjectOrigin,
  createProject,
  deleteProject,
  getProjects,
  removeProjectOrigin,
  renameProject,
} from '../api/projects'

vi.mock('../api/projects', () => ({
  addProjectOrigin: vi.fn(),
  createProject: vi.fn(),
  deleteProject: vi.fn(),
  getProjects: vi.fn(),
  removeProjectOrigin: vi.fn(),
  renameProject: vi.fn(),
}))

vi.mock('react-router', () => ({
  Link: ({
    to,
    children,
  }: {
    to: string
    children: React.ReactNode
  }) => <a href={to}>{children}</a>,
}))

const mockedGetProjects = vi.mocked(getProjects)
const mockedCreateProject = vi.mocked(createProject)
const mockedRenameProject = vi.mocked(renameProject)
const mockedDeleteProject = vi.mocked(deleteProject)
const mockedAddProjectOrigin = vi.mocked(addProjectOrigin)
const mockedRemoveProjectOrigin = vi.mocked(removeProjectOrigin)

const project = {
  id: 'p1',
  name: 'Acme',
  key: 'ACME',
  createdAt: '2026-09-14T10:00:00Z',
  origins: [
    { id: 'o1', origin: 'https://acme.example' },
  ],
}

beforeEach(() => {
  vi.clearAllMocks()
  mockedGetProjects.mockResolvedValue([project])
  mockedCreateProject.mockResolvedValue({
    ...project,
    id: 'p2',
    name: 'Beta',
    key: 'BETA',
    origins: [],
  })
  mockedRenameProject.mockResolvedValue({
    ...project,
    name: 'Acme Renamed',
  })
  mockedDeleteProject.mockResolvedValue(undefined)
  mockedAddProjectOrigin.mockResolvedValue({
    id: 'o2',
    origin: 'https://new.example',
  })
  mockedRemoveProjectOrigin.mockResolvedValue(undefined)
})

afterEach(() => {
  cleanup()
})

describe('AdminProjectsPage', () => {
  it('laduje i pokazuje projekty', async () => {
    render(<AdminProjectsPage />)

    expect(await screen.findByText('Acme')).toBeDefined()
    expect(screen.getByText('ACME')).toBeDefined()
    expect(screen.getByText('https://acme.example')).toBeDefined()
  })

  it('pokazuje pusty stan', async () => {
    mockedGetProjects.mockResolvedValueOnce([])

    render(<AdminProjectsPage />)

    expect(await screen.findByText('Brak projektów.')).toBeDefined()
  })

  it('pokazuje blad pobierania', async () => {
    mockedGetProjects.mockRejectedValueOnce(
      new Error('Brak dostępu'),
    )

    render(<AdminProjectsPage />)

    expect(
      await screen.findByRole('alert'),
    ).toBeDefined()
  })

  it('tworzy projekt', async () => {
    render(<AdminProjectsPage />)

    await screen.findByText('Acme')

    fireEvent.change(screen.getByLabelText('Nazwa'), {
      target: { value: 'Beta' },
    })

    fireEvent.change(screen.getByLabelText('Klucz'), {
      target: { value: 'BETA' },
    })

    fireEvent.submit(
      screen.getByRole('button', { name: 'Nowy projekt' }).closest('form')!,
    )

    await vi.waitFor(() => {
      expect(mockedCreateProject).toHaveBeenCalledWith(
        'Beta',
        'BETA',
      )
    })

    expect(await screen.findByText('Beta')).toBeDefined()
  })

  it('nie tworzy projektu bez wymaganych danych', async () => {
    render(<AdminProjectsPage />)

    await screen.findByText('Acme')

    const form = screen
      .getByRole('button', { name: 'Nowy projekt' })
      .closest('form')!

    fireEvent.submit(form)

    expect(mockedCreateProject).not.toHaveBeenCalled()
  })

  it('pokazuje blad tworzenia', async () => {
    mockedCreateProject.mockRejectedValueOnce(
      new Error('Klucz zajęty'),
    )

    render(<AdminProjectsPage />)
    await screen.findByText('Acme')

    fireEvent.change(screen.getByLabelText('Nazwa'), {
      target: { value: 'Beta' },
    })

    fireEvent.change(screen.getByLabelText('Klucz'), {
      target: { value: 'BETA' },
    })

    fireEvent.submit(
      screen.getByRole('button', { name: 'Nowy projekt' }).closest('form')!,
    )

    expect(
      await screen.findByRole('alert'),
    ).toBeDefined()
  })

  it('zmienia nazwe projektu', async () => {
    vi.spyOn(window, 'prompt').mockReturnValueOnce('Acme Renamed')

    render(<AdminProjectsPage />)
    await screen.findByText('Acme')

    fireEvent.click(screen.getByRole('button', { name: 'Zmień nazwę projektu Acme' }))

    await vi.waitFor(() => {
      expect(mockedRenameProject).toHaveBeenCalledWith(
        'p1',
        'Acme Renamed',
      )
    })
  })

  it('dodaje i usuwa origin', async () => {
    vi.spyOn(window, 'prompt')
      .mockReturnValueOnce('https://new.example')

    render(<AdminProjectsPage />)
    await screen.findByText('Acme')

    fireEvent.click(screen.getByRole('button', { name: 'Dodaj origin do projektu Acme' }))

    await vi.waitFor(() => {
      expect(mockedAddProjectOrigin).toHaveBeenCalledWith(
        'p1',
        'https://new.example',
      )
    })

    vi.spyOn(window, 'confirm').mockReturnValue(true)

    fireEvent.click(
      screen.getByRole('button', { name: 'Usuń origin https://acme.example' }),
    )

    await vi.waitFor(() => {
      expect(mockedRemoveProjectOrigin).toHaveBeenCalledWith('p1', 'o1')
    })
  })

  it('usuwa projekt po potwierdzeniu', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    render(<AdminProjectsPage />)
    await screen.findByText('Acme')

    fireEvent.click(
      screen.getByRole('button', { name: 'Usuń projekt Acme' }),
    )

    await vi.waitFor(() => {
      expect(mockedDeleteProject).toHaveBeenCalledWith('p1')
    })
  })
})






