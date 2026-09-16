import { describe, expect, it } from 'vitest'
import { toCsv } from './analyticsCsv'

describe('toCsv', () => {
  it('sklada naglowek i wiersze liniami CRLF', () => {
    expect(toCsv(['Strona', 'Zgłoszenia'], [['sklep.example/koszyk', 61], ['sklep.example', 31]])).toBe(
      'Strona,Zgłoszenia\r\nsklep.example/koszyk,61\r\nsklep.example,31',
    )
  })

  it('bierze w cudzyslow pole z przecinkiem cudzyslowem albo nowa linia', () => {
    expect(toCsv(['Wzorzec'], [['a,b'], ['powiedział "tak"'], ['dwie\nlinie']])).toBe(
      'Wzorzec\r\n"a,b"\r\n"powiedział ""tak"""\r\n"dwie\nlinie"',
    )
  })

  it('zabezpiecza tekst ktory Excel wykonalby jako formule', () => {
    expect(toCsv(['Strona'], [['=HYPERLINK("x")'], ['@suma'], ['-1']])).toBe(
      'Strona\r\n"\'=HYPERLINK(""x"")"\r\n\'@suma\r\n\'-1',
    )
  })

  it('nie rusza liczb i zamienia brak wartosci na puste pole', () => {
    expect(toCsv(['Mediana', 'Liczba'], [[null, -0]])).toBe('Mediana,Liczba\r\n,0')
  })
})
