import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useProjectPages } from './useProjectPages'
import { getProjectPages } from '../api/pages'

vi.mock('../api/pages', () => ({
  getProjectPages: vi.fn(),
}))

const mocked = vi.mocked(getProjectPages)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('strony projektu', () => {
  it('pierwszy render wychodzi jako ladowanie', () => {
    mocked.mockReturnValue(new Promise(() => {}))

    const { result } = renderHook(() => useProjectPages('p1'))

    expect(result.current.loading).toBe(true)
    expect(result.current.pages).toEqual([])
  })

  it('oddaje strony po odpowiedzi', async () => {
    mocked.mockResolvedValue([
      { page: 'a', total: 1, new: 1, inProgress: 0, resolved: 0, rejected: 0 },
    ])

    const { result } = renderHook(() => useProjectPages('p1'))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.pages).toHaveLength(1)
  })

  it('blad wychodzi komunikatem', async () => {
    mocked.mockRejectedValue(new Error('HTTP 500'))

    const { result } = renderHook(() => useProjectPages('p1'))

    await waitFor(() => expect(result.current.error).toBe('HTTP 500'))
    expect(result.current.pages).toEqual([])
  })

  // bez projektu nie ma o co pytac, a sam hook i tak siedzi w powloce
  it('pusty projekt nie odpytuje API', () => {
    renderHook(() => useProjectPages(''))

    expect(mocked).not.toHaveBeenCalled()
  })

  it('zmiana rewizji odpytuje ponownie', async () => {
    mocked.mockResolvedValue([])

    const { rerender } = renderHook(({ revision }) => useProjectPages('p1', revision), {
      initialProps: { revision: 0 },
    })

    await waitFor(() => expect(mocked).toHaveBeenCalledTimes(1))

    rerender({ revision: 1 })

    await waitFor(() => expect(mocked).toHaveBeenCalledTimes(2))
  })
})
