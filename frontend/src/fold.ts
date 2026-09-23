// porownanie bez wielkosci liter i ogonkow bo nazwy projektow wpisuje sie jak leci
// l z kreska nie rozklada sie w NFD wiec idzie osobno
export function fold(text: string) {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/ł/g, 'l')
}
