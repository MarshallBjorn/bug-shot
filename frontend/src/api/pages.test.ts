import { describe, expect, it, vi } from 'vitest'
import { apiGet } from './client'
import { getProjectPages } from './pages'

vi.mock('./client', () => ({
  apiGet: vi.fn(),
}))

describe('api stron', () => {
  it('rozpakowuje items z odpowiedzi', async () => {
    vi.mocked(apiGet).mockResolvedValue({
      items: [{ page: 'a', total: 1, new: 1, inProgress: 0, resolved: 0, rejected: 0 }],
    })

    const pages = await getProjectPages('p1')

    expect(apiGet).toHaveBeenCalledWith('/api/v1/projects/p1/pages', undefined)
    expect(pages).toHaveLength(1)
  })
})
