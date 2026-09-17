import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import PagesTree from './PagesTree'
import type { ProjectPageCount } from '../types'

function page(patch: Partial<ProjectPageCount> = {}): ProjectPageCount {
  return {
    page: 'sklep.example/koszyk',
    total: 10,
    new: 4,
    inProgress: 3,
    resolved: 3,
    rejected: 0,
    ...patch,
  }
}

afterEach(() => {
  cleanup()
})

describe('drzewo stron', () => {
  it('pokazuje stan ladowania', () => {
    render(<PagesTree pages={[]} loading selected="" onSelect={vi.fn()} />)

    expect(screen.getByText('Ładowanie stron...')).toBeDefined()
  })

  it('pusta lista mowi ze nie ma stron', () => {
    render(<PagesTree pages={[]} loading={false} selected="" onSelect={vi.fn()} />)

    expect(screen.getByText('Brak stron ze zgłoszeniami.')).toBeDefined()
  })

  // pelny adres zostaje w tytule bo host powtarza sie w kazdym wierszu
  it('wiersz pokazuje sciezke a pelny adres trzyma w tytule', () => {
    render(<PagesTree pages={[page()]} loading={false} selected="" onSelect={vi.fn()} />)

    const row = screen.getByTitle('sklep.example/koszyk')

    expect(row.textContent).toContain('/koszyk')
    expect(row.textContent).toContain('10')
  })

  it('adres bez sciezki zostaje w calosci', () => {
    render(
      <PagesTree pages={[page({ page: 'sklep.example' })]} loading={false} selected="" onSelect={vi.fn()} />,
    )

    expect(screen.getByTitle('sklep.example').textContent).toContain('sklep.example')
  })

  it('klik w strone wybiera ja bez statusu', () => {
    const onSelect = vi.fn()

    render(<PagesTree pages={[page()]} loading={false} selected="" onSelect={onSelect} />)

    fireEvent.click(screen.getByTitle('sklep.example/koszyk'))

    expect(onSelect).toHaveBeenCalledWith('sklep.example/koszyk', null)
  })

  it('rozwiniecie pokazuje tylko statusy z niezerowym licznikiem', () => {
    render(<PagesTree pages={[page()]} loading={false} selected="" onSelect={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: /Rozwiń statusy/ }))

    expect(screen.getByRole('button', { name: /Nowe/ })).toBeDefined()
    expect(screen.queryByRole('button', { name: /Odrzucone/ })).toBeNull()
  })

  it('klik w status wybiera strone razem z nim', () => {
    const onSelect = vi.fn()

    render(<PagesTree pages={[page()]} loading={false} selected="" onSelect={onSelect} />)

    fireEvent.click(screen.getByRole('button', { name: /Rozwiń statusy/ }))
    fireEvent.click(screen.getByRole('button', { name: /W trakcie/ }))

    expect(onSelect).toHaveBeenCalledWith('sklep.example/koszyk', 'InProgress')
  })

  it('wybrana strona jest oznaczona dla czytnika ekranu', () => {
    render(
      <PagesTree
        pages={[page()]}
        loading={false}
        selected="sklep.example/koszyk"
        onSelect={vi.fn()}
      />,
    )

    expect(screen.getByTitle('sklep.example/koszyk').getAttribute('aria-current')).toBe('true')
  })
})
