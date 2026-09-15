import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import Pagination from './Pagination'

afterEach(() => {
  cleanup()
})

describe('Pagination', () => {
  it('blokuje poprzednia na pierwszej stronie', () => {
    render(
      <Pagination
        page={1}
        pageSize={20}
        total={45}
        onPageChange={vi.fn()}
      />,
    )

    const previous = screen.getByRole('button', { name: 'Poprzednia' })
    const next = screen.getByRole('button', { name: 'Następna' })

    expect((previous as HTMLButtonElement).disabled).toBe(true)
    expect((next as HTMLButtonElement).disabled).toBe(false)
    expect(screen.getByText(/Strona 1 z 3/)).toBeDefined()
  })

  it('wywoluje zmiane strony', () => {
    const onPageChange = vi.fn()

    render(
      <Pagination
        page={2}
        pageSize={20}
        total={45}
        onPageChange={onPageChange}
      />,
    )

    fireEvent.click(
      screen.getByRole('button', { name: 'Poprzednia' }),
    )

    fireEvent.click(
      screen.getByRole('button', { name: 'Następna' }),
    )

    expect(onPageChange).toHaveBeenNthCalledWith(1, 1)
    expect(onPageChange).toHaveBeenNthCalledWith(2, 3)
  })

  it('blokuje nastepna na ostatniej stronie', () => {
    render(
      <Pagination
        page={3}
        pageSize={20}
        total={45}
        onPageChange={vi.fn()}
      />,
    )

    const next = screen.getByRole('button', { name: 'Następna' })

    expect((next as HTMLButtonElement).disabled).toBe(true)
  })

  it('dla zera wynikow pokazuje jedna strone', () => {
    render(
      <Pagination
        page={1}
        pageSize={20}
        total={0}
        onPageChange={vi.fn()}
      />,
    )

    expect(screen.getByText(/Strona 1 z 1/)).toBeDefined()
  })
})
