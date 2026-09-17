import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import HorizontalBars from './HorizontalBars'
import TimelineChart from './TimelineChart'

afterEach(() => {
  cleanup()
})

describe('slupki poziome', () => {
  const data = [
    { label: 'sklep.example/koszyk', value: 61 },
    { label: 'sklep.example/kasa', value: 20 },
  ]

  it('kazdy slupek ma etykiete i liczbe obok', () => {
    render(<HorizontalBars data={data} caption="Najczęstsze strony" />)

    expect(screen.getByText('sklep.example/koszyk')).toBeDefined()
    expect(screen.getByText('61')).toBeDefined()
    expect(screen.getByText('20')).toBeDefined()
  })

  // kolor per slupek malowalby range a nie tozsamosc, wiec seria ma jeden hue
  it('cala seria idzie jednym kolorem', () => {
    const { container } = render(<HorizontalBars data={data} caption="Strony" />)

    const fills = Array.from(container.querySelectorAll('li span span')).map(
      (node) => (node as HTMLElement).style.backgroundColor,
    )

    expect(new Set(fills).size).toBe(1)
  })

  it('status dostaje wlasny zastrzezony ton', () => {
    const { container } = render(
      <HorizontalBars
        data={[
          { label: 'Nowe', value: 3, tone: 'var(--color-primary)' },
          { label: 'Rozwiązane', value: 5, tone: 'var(--color-success)' },
        ]}
        caption="Statusy"
      />,
    )

    const fills = Array.from(container.querySelectorAll('li span span')).map(
      (node) => (node as HTMLElement).style.backgroundColor,
    )

    expect(new Set(fills).size).toBe(2)
  })

  it('brak danych mowi o tym zamiast rysowac pusty wykres', () => {
    render(<HorizontalBars data={[]} caption="Strony" />)

    expect(screen.getByText('Brak danych w tym zakresie.')).toBeDefined()
  })

  it('niezerowa wartosc zawsze zostawia widoczny slad', () => {
    const { container } = render(
      <HorizontalBars data={[{ label: 'a', value: 1000 }, { label: 'b', value: 1 }]} caption="x" />,
    )

    const widths = Array.from(container.querySelectorAll('li span span')).map(
      (node) => (node as HTMLElement).style.width,
    )

    expect(widths[1]).not.toBe('0%')
  })
})

describe('wykres osi czasu', () => {
  const points = [
    { date: '2026-09-15', created: 4, resolved: 1 },
    { date: '2026-09-16', created: 7, resolved: 5 },
    { date: '2026-09-17', created: 2, resolved: 6 },
  ]

  it('opisuje sie dla czytnika ekranu', () => {
    render(<TimelineChart points={points} bucket="day" />)

    expect(screen.getByRole('img', { name: /3 punktów w czasie/ })).toBeDefined()
  })

  // serie sa etykietowane przy koncach, bo sam kolor nie wystarcza przy tritanie
  it('serie maja etykiety przy koncach linii', () => {
    render(<TimelineChart points={points} bucket="day" />)

    expect(screen.getByText('nowe')).toBeDefined()
    expect(screen.getByText('rozwiązane')).toBeDefined()
  })

  it('bez najechania zaprasza do interakcji', () => {
    render(<TimelineChart points={points} bucket="day" />)

    expect(screen.getByText(/Najedź na wykres/)).toBeDefined()
  })

  // liczby musza byc dostepne takze bez myszki, dlatego leca w obszarze aria-live
  it('najechanie oglasza liczby z danego dnia', () => {
    const { container } = render(<TimelineChart points={points} bucket="day" />)

    const overlay = container.querySelector('rect[fill="transparent"]')!

    fireEvent.mouseMove(overlay, { clientX: 0 })

    expect(screen.getByText(/nowe 4, rozwiązane 1/)).toBeDefined()

    fireEvent.mouseLeave(overlay)

    expect(screen.getByText(/Najedź na wykres/)).toBeDefined()
  })

  it('tygodniowy kubelek zmienia jednostke w opisie', () => {
    const { container } = render(<TimelineChart points={points} bucket="week" />)

    fireEvent.mouseMove(container.querySelector('rect[fill="transparent"]')!, { clientX: 0 })

    expect(screen.getByText(/Tydzień 2026-09-15/)).toBeDefined()
  })

  it('pusty zakres nie wywraca wykresu', () => {
    render(<TimelineChart points={[]} bucket="day" />)

    expect(screen.getByRole('img', { name: /0 punktów/ })).toBeDefined()
  })
})
