import { describe, expect, it } from 'vitest'
import { tokenizeJson } from './jsonTokens'

function kinds(text: string) {
  return tokenizeJson(text)
    .filter((token) => token.kind !== 'plain')
    .map((token) => [token.kind, token.text])
}

describe('tokenizacja JSON', () => {
  it('rozpoznaje klucz po dwukropku a napis bez niego', () => {
    expect(kinds('{\n  "name": "TypeError"\n}')).toEqual([
      ['key', '"name"'],
      ['string', '"TypeError"'],
    ])
  })

  it('rozpoznaje liczby wartosci logiczne i null', () => {
    expect(kinds('{\n  "line": 12,\n  "ok": true,\n  "stack": null\n}')).toEqual([
      ['key', '"line"'],
      ['number', '12'],
      ['key', '"ok"'],
      ['boolean', 'true'],
      ['key', '"stack"'],
      ['null', 'null'],
    ])
  })

  it('liczba ujemna i wykladnicza zostaja liczba', () => {
    expect(kinds('[-1, 2.5e10]')).toEqual([
      ['number', '-1'],
      ['number', '2.5e10'],
    ])
  })

  // cudzyslow w napisie nie moze konczyc tokenu
  it('escape w napisie nie urywa tokenu', () => {
    expect(kinds('{"msg": "on powiedzial \\"nie\\" i wyszedl"}')).toEqual([
      ['key', '"msg"'],
      ['string', '"on powiedzial \\"nie\\" i wyszedl"'],
    ])
  })

  it('slowo true w napisie nie jest wartoscia logiczna', () => {
    expect(kinds('{"msg": "true story"}')).toEqual([
      ['key', '"msg"'],
      ['string', '"true story"'],
    ])
  })

  it('caly tekst da sie zlozyc z tokenow bez zmiany', () => {
    const text = '{\n  "a": [1, false, null],\n  "b": "x"\n}'

    expect(tokenizeJson(text).map((token) => token.text).join('')).toBe(text)
  })

  it('puste wejscie daje brak tokenow', () => {
    expect(tokenizeJson('')).toEqual([])
  })
})
