import { describe, expect, it } from 'vitest'
import { minPasswordLength, passwordProblem } from './passwordPolicy'

describe('polityka hasla w panelu', () => {
  it('poprawne i powtorzone haslo przechodzi', () => {
    expect(passwordProblem('wystarczajaco-dlugie', 'wystarczajaco-dlugie')).toBeNull()
  })

  it('za krotkie haslo', () => {
    const short = 'a'.repeat(minPasswordLength - 1)

    expect(passwordProblem(short, short)).toContain(String(minPasswordLength))
  })

  it('limit liczy bajty jak bcrypt w API', () => {
    const polish = 'ą'.repeat(40)

    expect(passwordProblem(polish, polish)).toContain('za długie')
  })

  it('niezgodne powtorzenie', () => {
    expect(passwordProblem('wystarczajaco-dlugie', 'wystarczajaco-dlugiE')).toContain('nie zgadza')
  })
})
