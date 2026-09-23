import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import FilterSelect from './FilterSelect'

const projects = [
  { value: '', label: 'Wszystkie' },
  { value: 'p1', label: 'Sklep demo' },
  { value: 'p2', label: 'Łódź portal' },
  { value: 'p3', label: 'Projekt QA' },
]

// jsdom nie ma API wskaznika ani przewijania z ktorych korzysta lista Radixa
beforeAll(() => {
  Element.prototype.hasPointerCapture ??= () => false
  Element.prototype.scrollIntoView ??= () => {}
})

afterEach(() => {
  cleanup()
})

describe('lista bez szukania', () => {
  it('pusta wartosc pokazuje pozycje bez filtra i wraca jako pusty tekst', () => {
    const onChange = vi.fn()

    render(<FilterSelect label="Projekt" value="p1" options={projects} onChange={onChange} />)

    const trigger = screen.getByRole('combobox', { name: 'Projekt' })

    expect(trigger.textContent).toContain('Sklep demo')

    fireEvent.keyDown(trigger, { key: 'Enter' })
    fireEvent.keyDown(screen.getByRole('option', { name: 'Wszystkie' }), { key: 'Enter' })

    expect(onChange).toHaveBeenCalledWith('')
  })
})

describe('lista z szukaniem', () => {
  function open(onChange = vi.fn()) {
    render(
      <FilterSelect label="Projekt" value="" options={projects} onChange={onChange} searchable />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Projekt Wszystkie' }))

    return screen.getByRole('combobox', { name: 'Projekt' })
  }

  it('szuka bez wielkosci liter i ogonkow', () => {
    const input = open()

    fireEvent.change(input, { target: { value: 'lodz' } })

    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
      'Łódź portal',
    ])
  })

  it('strzalki i Enter wybieraja pozycje', () => {
    const onChange = vi.fn()
    const input = open(onChange)

    fireEvent.change(input, { target: { value: 'o' } })
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onChange).toHaveBeenCalledWith('p3')
  })

  it('brak trafien mowi o tym zamiast pustej listy', () => {
    const input = open()

    fireEvent.change(input, { target: { value: 'nieistniejacy' } })

    expect(screen.queryAllByRole('option')).toHaveLength(0)
    expect(screen.getByText('Nic nie pasuje')).toBeDefined()
  })
})
