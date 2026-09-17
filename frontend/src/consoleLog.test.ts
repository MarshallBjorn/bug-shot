import { describe, expect, it } from 'vitest'
import {
  countByLevel,
  filterEntries,
  logSources,
  offsetFromStart,
  parseConsoleLog,
  splitStack,
} from './consoleLog'

// dokladnie taka tresc leży w wolumenie zalacznikow, razem z polskimi znakami
const realLog = [
  '[2026-07-09T11:42:14.623Z] ERROR window.onerror: Uncaught ReferenceError: dataLayer is not defined | stack=at analytics.js:12:5',
  '[2026-07-09T11:42:21.623Z] WARN console.warn: Brak ceny w odpowiedzi /api/cart, używam poprzedniej',
  "[2026-07-09T11:42:28.623Z] ERROR console.error: TypeError: Cannot read properties of undefined (reading 'price')",
].join('\n')

describe('parsowanie logu z widgetu', () => {
  it('rozbija wpisy na czas poziom zrodlo i tresc', () => {
    const entries = parseConsoleLog(realLog)

    expect(entries).toHaveLength(3)
    expect(entries[0].timestamp).toBe('2026-07-09T11:42:14.623Z')
    expect(entries[0].level).toBe('ERROR')
    expect(entries[0].source).toBe('window.onerror')
    expect(entries[0].message).toBe('Uncaught ReferenceError: dataLayer is not defined')
    expect(entries[1].message).toBe('Brak ceny w odpowiedzi /api/cart, używam poprzedniej')
  })

  it('stack wychodzi z tresci do wlasnego pola', () => {
    const [first] = parseConsoleLog(realLog)

    expect(first.stack).toEqual(['at analytics.js:12:5'])
    expect(first.message).not.toContain('stack=')
  })

  it('pary key wartosc z window.onerror ida do pol', () => {
    const [entry] = parseConsoleLog(
      '[2026-09-17T10:00:00.000Z] ERROR window.onerror: Blad | source=app.js | line=12 | column=5',
    )

    expect(entry.message).toBe('Blad')
    expect(entry.fields).toEqual([
      { name: 'source', value: 'app.js' },
      { name: 'line', value: '12' },
      { name: 'column', value: '5' },
    ])
  })

  // widget pakuje bledy przez JSON.stringify wiec czytelny zapis trzeba odtworzyc
  it('tresc bedaca JSON wraca sformatowana', () => {
    const [entry] = parseConsoleLog(
      '[2026-09-17T10:00:00.000Z] ERROR console.error: {"name":"TypeError","message":"x is not a function","stack":null}',
    )

    expect(entry.json).toContain('"name": "TypeError"')
    expect(entry.json?.split('\n').length).toBeGreaterThan(1)
  })

  it('tresc ktora tylko wyglada na JSON zostaje tekstem', () => {
    const [entry] = parseConsoleLog('[2026-09-17T10:00:00.000Z] INFO console.log: {niedomkniety')

    expect(entry.json).toBeNull()
  })

  it('zwykly tekst nie jest brany za JSON', () => {
    const [entry] = parseConsoleLog('[2026-09-17T10:00:00.000Z] INFO console.log: widok gotowy')

    expect(entry.json).toBeNull()
  })

  // to jest przypadek, na ktorym naiwny parser linia po linii sie rozjezdza
  it('linia bez naglowka dokleja sie do poprzedniego wpisu', () => {
    const entries = parseConsoleLog(
      [
        '[2026-09-17T10:00:00.000Z] ERROR console.error: Pierwsza linia',
        'druga linia tego samego wpisu',
        'trzecia linia',
        '[2026-09-17T10:00:05.000Z] INFO console.log: osobny wpis',
      ].join('\n'),
    )

    expect(entries).toHaveLength(2)
    expect(entries[0].message).toBe('Pierwsza linia\ndruga linia tego samego wpisu\ntrzecia linia')
    expect(entries[1].message).toBe('osobny wpis')
  })

  it('tekst przed pierwszym naglowkiem jest pomijany', () => {
    const entries = parseConsoleLog(
      ['smiec bez naglowka', '[2026-09-17T10:00:00.000Z] INFO console.log: ok'].join('\n'),
    )

    expect(entries).toHaveLength(1)
    expect(entries[0].message).toBe('ok')
  })

  it('pusty log daje pusta liste', () => {
    expect(parseConsoleLog('')).toEqual([])
  })

  // widget dokleja ten sufiks przy limicie 32 KiB na wpis
  it('sufiks o przycieciu zdejmuje sie z tresci i zostaje flaga', () => {
    const [entry] = parseConsoleLog(
      '[2026-09-17T10:00:00.000Z] INFO console.log: dluga tresc [truncated]',
    )

    expect(entry.truncated).toBe(true)
    expect(entry.message).toBe('dluga tresc')
  })
})

describe('ramki stosu', () => {
  it('dziela sie po slowie at nawet w jednej linii', () => {
    expect(splitStack('at a.js:1:1 at b.js:2:2')).toEqual(['at a.js:1:1', 'at b.js:2:2'])
  })

  it('dziela sie tez po zlamaniu wiersza', () => {
    expect(splitStack('at a.js:1:1\nat b.js:2:2')).toEqual(['at a.js:1:1', 'at b.js:2:2'])
  })

  it('puste wejscie daje pusta liste', () => {
    expect(splitStack('   ')).toEqual([])
  })
})

describe('podsumowania logu', () => {
  it('liczy wpisy per poziom', () => {
    expect(countByLevel(parseConsoleLog(realLog))).toEqual({
      ERROR: 2,
      WARN: 1,
      INFO: 0,
      DEBUG: 0,
    })
  })

  it('zrodla wychodza bez powtorzen i po kolei', () => {
    expect(logSources(parseConsoleLog(realLog))).toEqual([
      'console.error',
      'console.warn',
      'window.onerror',
    ])
  })

  it('odstep liczy sie wzgledem pierwszego wpisu', () => {
    const entries = parseConsoleLog(realLog)

    expect(offsetFromStart(entries, entries[0])).toBe('+0.00s')
    expect(offsetFromStart(entries, entries[1])).toBe('+7.00s')
  })

  it('zepsuty czas nie wywraca odstepu', () => {
    const entries = parseConsoleLog('[nie data] INFO console.log: x')

    expect(offsetFromStart(entries, entries[0])).toBe('')
    expect(offsetFromStart([], entries[0])).toBe('')
  })
})

describe('filtrowanie logu', () => {
  const entries = parseConsoleLog(realLog)
  const none = { levels: [], source: '', search: '' }

  it('bez filtra przechodzi wszystko', () => {
    expect(filterEntries(entries, none)).toHaveLength(3)
  })

  it('poziomy zawezaja do wybranych', () => {
    expect(filterEntries(entries, { ...none, levels: ['ERROR'] })).toHaveLength(2)
    expect(filterEntries(entries, { ...none, levels: ['WARN', 'ERROR'] })).toHaveLength(3)
  })

  it('zrodlo zaweza do jednego kanalu', () => {
    expect(filterEntries(entries, { ...none, source: 'console.warn' })).toHaveLength(1)
  })

  it('szukanie idzie po tresci zrodle polach i stosie', () => {
    expect(filterEntries(entries, { ...none, search: 'DATALAYER' })).toHaveLength(1)
    expect(filterEntries(entries, { ...none, search: 'console.warn' })).toHaveLength(1)
    expect(filterEntries(entries, { ...none, search: 'analytics.js' })).toHaveLength(1)
    expect(filterEntries(entries, { ...none, search: 'nie ma tego' })).toHaveLength(0)
  })

  it('szukanie obejmuje pola z window.onerror', () => {
    const withFields = parseConsoleLog(
      '[2026-09-17T10:00:00.000Z] ERROR window.onerror: Blad | source=checkout.js',
    )

    expect(filterEntries(withFields, { ...none, search: 'checkout.js' })).toHaveLength(1)
  })
})
