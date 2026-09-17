import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import SaveFilterDialog from './SaveFilterDialog'
import { saveFilter } from '../savedFilters'

vi.mock('../savedFilters', () => ({
  saveFilter: vi.fn(),
}))

const mocked = vi.mocked(saveFilter)

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  cleanup()
})

function open() {
  render(<SaveFilterDialog projectId="p1" search="status=New" onSaved={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', { name: 'Zapisz filtr' }))
}

describe('zapis filtra', () => {
  it('bez nazwy przycisk zapisu jest nieaktywny', () => {
    open()

    expect(screen.getByRole('button', { name: 'Zapisz' })).toHaveProperty('disabled', true)
  })

  it('zapisuje nazwe razem z obecnym adresem', () => {
    open()

    fireEvent.change(screen.getByLabelText('Nazwa'), { target: { value: 'Nowe' } })
    fireEvent.click(screen.getByRole('button', { name: 'Zapisz' }))

    expect(mocked).toHaveBeenCalledWith('p1', 'Nowe', 'status=New')
  })

  // enter w polu ma robic to samo co przycisk bo tak zachowuje sie kazdy formularz
  it('enter w polu zapisuje', () => {
    open()

    const input = screen.getByLabelText('Nazwa')
    fireEvent.change(input, { target: { value: 'Koszyk' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(mocked).toHaveBeenCalledWith('p1', 'Koszyk', 'status=New')
  })

  it('same spacje nie zapisuja niczego', () => {
    open()

    const input = screen.getByLabelText('Nazwa')
    fireEvent.change(input, { target: { value: '   ' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(mocked).not.toHaveBeenCalled()
  })
})
