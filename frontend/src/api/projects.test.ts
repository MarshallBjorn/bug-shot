import { describe, expect, it, vi } from 'vitest'
import { apiDelete, apiGet, apiPatch, apiPost } from './client'
import {
  addProjectOrigin,
  createProject,
  deleteProject,
  getProjects,
  removeProjectOrigin,
  renameProject,
} from './projects'

vi.mock('./client', () => ({
  apiDelete: vi.fn(),
  apiGet: vi.fn(),
  apiPatch: vi.fn(),
  apiPost: vi.fn(),
}))

describe('projects api', () => {
  it('pobiera projekty', async () => {
    const projects = [{ id: 'p1', name: 'Demo', key: 'demo', createdAt: '2026-01-01', origins: [] }]
    vi.mocked(apiGet).mockResolvedValue(projects)

    await expect(getProjects()).resolves.toEqual(projects)
    expect(apiGet).toHaveBeenCalledWith('/api/v1/projects', undefined)
  })

  it('pobiera projekty z sygnałem abort', async () => {
    const signal = new AbortController().signal
    vi.mocked(apiGet).mockResolvedValue([])

    await getProjects(signal)

    expect(apiGet).toHaveBeenCalledWith('/api/v1/projects', signal)
  })

  it('tworzy projekt', async () => {
    const project = { id: 'p1', name: 'Demo', key: 'demo', createdAt: '2026-01-01', origins: [] }
    vi.mocked(apiPost).mockResolvedValue(project)

    await expect(createProject('Demo', 'demo')).resolves.toEqual(project)
    expect(apiPost).toHaveBeenCalledWith('/api/v1/projects', {
      name: 'Demo',
      key: 'demo',
    })
  })

  it('zmienia nazwe projektu', async () => {
    const project = { id: 'p1', name: 'Nowa nazwa', key: 'demo', createdAt: '2026-01-01', origins: [] }
    vi.mocked(apiPatch).mockResolvedValue(project)

    await expect(renameProject('p1', 'Nowa nazwa')).resolves.toEqual(project)
    expect(apiPatch).toHaveBeenCalledWith('/api/v1/projects/p1', {
      name: 'Nowa nazwa',
    })
  })

  it('usuwa projekt', async () => {
    vi.mocked(apiDelete).mockResolvedValue(undefined)

    await deleteProject('p1')

    expect(apiDelete).toHaveBeenCalledWith('/api/v1/projects/p1')
  })

  it('dodaje origin projektu', async () => {
    const origin = { id: 'o1', origin: 'https://acme.example' }
    vi.mocked(apiPost).mockResolvedValue(origin)

    await expect(addProjectOrigin('p1', 'https://acme.example')).resolves.toEqual(origin)
    expect(apiPost).toHaveBeenCalledWith('/api/v1/projects/p1/origins', {
      origin: 'https://acme.example',
    })
  })

  it('usuwa origin projektu', async () => {
    vi.mocked(apiDelete).mockResolvedValue(undefined)

    await removeProjectOrigin('p1', 'o1')

    expect(apiDelete).toHaveBeenCalledWith('/api/v1/projects/p1/origins/o1')
  })
})
