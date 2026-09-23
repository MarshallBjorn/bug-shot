// te same granice co PasswordPolicy w API, zeby blad pokazal sie przed wyslaniem
export const minPasswordLength = 12
const maxPasswordBytes = 72

export function passwordProblem(password: string, repeated: string) {
  if (password.length < minPasswordLength) {
    return `Hasło musi mieć co najmniej ${minPasswordLength} znaków.`
  }

  // bcrypt liczy bajty wiec polskie znaki zjadaja limit szybciej
  if (new TextEncoder().encode(password).length > maxPasswordBytes) {
    return 'Hasło jest za długie, polskie znaki liczą się podwójnie.'
  }

  if (password !== repeated) {
    return 'Powtórzone hasło się nie zgadza.'
  }

  return null
}
