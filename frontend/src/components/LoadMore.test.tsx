import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import LoadMore from './LoadMore'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

// jsdom nie ma IntersectionObserver wiec test sam decyduje kiedy dol listy jest widoczny
function stubObserver() {
  const observers: Array<{ fire: () => void; disconnected: boolean }> = []

  vi.stubGlobal(
    'IntersectionObserver',
    class {
      private record: { fire: () => void; disconnected: boolean }

      constructor(callback: (entries: Array<{ isIntersecting: boolean }>) => void) {
        this.record = { fire: () => callback([{ isIntersecting: true }]), disconnected: false }
        observers.push(this.record)
      }

      observe() {}

      disconnect() {
        this.record.disconnected = true
      }
    },
  )

  return observers
}

describe('LoadMore', () => {
  it('pokazuje ile zaladowano z licznika', () => {
    render(
      <LoadMore
        loaded={20}
        total={45}
        hasMore
        busy={false}
        onLoadMore={vi.fn()}
      />,
    )

    expect(screen.getByText('Pokazano 20 z 45')).toBeDefined()
  })

  // doladowanie nie prosi backendu o licznik
  it('bez licznika pokazuje sama liczbe zaladowanych', () => {
    render(
      <LoadMore
        loaded={20}
        total={null}
        hasMore
        busy={false}
        onLoadMore={vi.fn()}
      />,
    )

    expect(screen.getByText('Pokazano 20 wyników')).toBeDefined()
  })

  it('wywoluje doladowanie', () => {
    const onLoadMore = vi.fn()

    render(
      <LoadMore
        loaded={20}
        total={45}
        hasMore
        busy={false}
        onLoadMore={onLoadMore}
      />,
    )

    fireEvent.click(
      screen.getByRole('button', { name: 'Załaduj więcej' }),
    )

    expect(onLoadMore).toHaveBeenCalledTimes(1)
  })

  it('blokuje przycisk w trakcie ladowania', () => {
    render(
      <LoadMore
        loaded={20}
        total={45}
        hasMore
        busy
        onLoadMore={vi.fn()}
      />,
    )

    const button = screen.getByRole('button', { name: 'Ładowanie...' })

    expect((button as HTMLButtonElement).disabled).toBe(true)
  })

  it('na koncu listy chowa przycisk', () => {
    render(
      <LoadMore
        loaded={3}
        total={3}
        hasMore={false}
        busy={false}
        onLoadMore={vi.fn()}
      />,
    )

    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByText('Koniec listy, 3 wyniki')).toBeDefined()
  })

  it('na koncu listy bez licznika liczy zaladowane', () => {
    render(
      <LoadMore
        loaded={1}
        total={null}
        hasMore={false}
        busy={false}
        onLoadMore={vi.fn()}
      />,
    )

    expect(screen.getByText('Koniec listy, 1 wynik')).toBeDefined()
  })

  it('doladowuje sam gdy dol listy wjedzie w widok', () => {
    const observers = stubObserver()
    const onLoadMore = vi.fn()

    render(<LoadMore loaded={20} total={45} hasMore busy={false} onLoadMore={onLoadMore} />)

    observers[0].fire()

    expect(onLoadMore).toHaveBeenCalledTimes(1)
  })

  it('nie obserwuje w trakcie ladowania po bledzie ani na koncu listy', () => {
    const observers = stubObserver()

    const view = render(
      <LoadMore loaded={20} total={45} hasMore busy onLoadMore={vi.fn()} />,
    )
    view.rerender(<LoadMore loaded={20} total={45} hasMore busy={false} paused onLoadMore={vi.fn()} />)
    view.rerender(<LoadMore loaded={45} total={45} hasMore={false} busy={false} onLoadMore={vi.fn()} />)

    expect(observers).toHaveLength(0)
  })

  it('przycisk zostaje jako reczna proba po bledzie', () => {
    stubObserver()
    const onLoadMore = vi.fn()

    render(<LoadMore loaded={20} total={45} hasMore busy={false} paused onLoadMore={onLoadMore} />)

    fireEvent.click(screen.getByRole('button', { name: 'Załaduj więcej' }))

    expect(onLoadMore).toHaveBeenCalledTimes(1)
  })
})
