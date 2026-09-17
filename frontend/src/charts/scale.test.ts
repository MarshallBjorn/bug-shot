import { describe, expect, it } from 'vitest'
import {
  axisTicks,
  linePath,
  nearestIndex,
  niceCeiling,
  scaleX,
  scaleY,
  separateLabels,
} from './scale'

describe('gorna granica osi', () => {
  it('zaokragla w gore do czytelnego kroku', () => {
    expect(niceCeiling(7)).toBe(10)
    expect(niceCeiling(23)).toBe(25)
    expect(niceCeiling(140)).toBe(200)
    expect(niceCeiling(1)).toBe(1)
  })

  it('brak danych daje jedynke zamiast zera', () => {
    expect(niceCeiling(0)).toBe(1)
    expect(niceCeiling(-5)).toBe(1)
  })
})

describe('podzialka osi', () => {
  it('dzieli zakres na rowne kroki', () => {
    expect(axisTicks(100)).toEqual([0, 25, 50, 75, 100])
  })

  // ulamek zgloszenia nie istnieje wiec przy malym zakresie os idzie po jedynce
  it('maly zakres idzie krokiem jednostkowym', () => {
    expect(axisTicks(2)).toEqual([0, 1, 2])
    expect(axisTicks(0)).toEqual([0, 1])
  })
})

describe('skalowanie', () => {
  it('wartosc zerowa siedzi na dole a maksymalna u gory', () => {
    expect(scaleY(0, 10, 200)).toBe(200)
    expect(scaleY(10, 10, 200)).toBe(0)
    expect(scaleY(5, 10, 200)).toBe(100)
  })

  it('jeden punkt idzie na srodek', () => {
    expect(scaleX(0, 1, 300)).toBe(150)
  })

  it('punkty rozkladaja sie od krawedzi do krawedzi', () => {
    expect(scaleX(0, 3, 300)).toBe(0)
    expect(scaleX(2, 3, 300)).toBe(300)
  })
})

describe('punkt pod kursorem', () => {
  it('trafia w najblizszy punkt danych', () => {
    expect(nearestIndex(0, 5, 400)).toBe(0)
    expect(nearestIndex(240, 5, 400)).toBe(2)
    expect(nearestIndex(400, 5, 400)).toBe(4)
  })

  it('poza wykresem przywiera do krawedzi', () => {
    expect(nearestIndex(-50, 5, 400)).toBe(0)
    expect(nearestIndex(9999, 5, 400)).toBe(4)
  })

  it('jeden punkt zawsze trafia w siebie', () => {
    expect(nearestIndex(123, 1, 400)).toBe(0)
  })
})

describe('sciezka linii', () => {
  it('zaczyna sie od M i idzie przez L', () => {
    const path = linePath([0, 5, 10], 10, 200, 100)

    expect(path.startsWith('M')).toBe(true)
    expect(path.split('L')).toHaveLength(3)
  })
})

describe('rozsuwanie etykiet', () => {
  it('daleko od siebie zostaja na miejscu', () => {
    expect(separateLabels(10, 60)).toEqual([10, 60])
  })

  // bez tego dwie etykiety serii zlewaja sie w jedna plame przy prawej krawedzi
  it('blisko siebie rozchodza sie do minimalnego odstepu', () => {
    const [first, second] = separateLabels(50, 54, 12)

    expect(second - first).toBe(12)
    expect((first + second) / 2).toBe(52)
  })

  it('zachowuja kolejnosc gdy pierwsza jest nizej', () => {
    const [first, second] = separateLabels(54, 50, 12)

    expect(first).toBeGreaterThan(second)
    expect(first - second).toBe(12)
  })

  it('identyczna wysokosc tez sie rozchodzi', () => {
    const [first, second] = separateLabels(40, 40, 12)

    expect(Math.abs(first - second)).toBe(12)
  })
})
