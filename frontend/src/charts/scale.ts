// skale i osie licza sie czystymi funkcjami, wiec da sie je sprawdzic testem bez renderu
export function niceCeiling(value: number): number {
  if (value <= 0) {
    return 1
  }

  const magnitude = 10 ** Math.floor(Math.log10(value))
  const steps = [1, 2, 2.5, 5, 10]

  for (const step of steps) {
    const candidate = step * magnitude

    if (candidate >= value) {
      return candidate
    }
  }

  return 10 * magnitude
}

// krok podzialki jest calkowity bo na osi licznikow ulamek zgloszenia nic nie znaczy
// gora osi to pierwsza wielokrotnosc kroku nad maksimum wiec podzialka nie zawsze ma count odcinkow
export function axisTicks(max: number, count = 4): number[] {
  const raw = niceCeiling(max / count)
  // ponizej jedynki krok bylby ulamkiem a jedyny ulamkowy krok powyzej to 2.5 wiec idzie na 5
  const step = raw <= 1 ? 1 : Number.isInteger(raw) ? raw : raw * 2
  const top = Math.max(1, Math.ceil(max / step)) * step

  return Array.from({ length: top / step + 1 }, (_, index) => index * step)
}

// top przychodzi z ostatniej kreski podzialki zeby linie i kreski liczyly sie od tej samej gory
export function scaleY(value: number, top: number, height: number): number {
  return top <= 0 ? height : height - (value / top) * height
}

export function scaleX(index: number, count: number, width: number): number {
  return count <= 1 ? width / 2 : (index / (count - 1)) * width
}

// punkt najblizszy kursorowi, zeby krzyzyk trzymal sie danych a nie piksela
export function nearestIndex(offsetX: number, count: number, width: number): number {
  if (count <= 1) {
    return 0
  }

  const step = width / (count - 1)

  return Math.min(count - 1, Math.max(0, Math.round(offsetX / step)))
}

export function linePath(values: number[], max: number, width: number, height: number): string {
  return values
    .map((value, index) => {
      const x = scaleX(index, values.length, width)
      const y = scaleY(value, max, height)

      return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`
    })
    .join(' ')
}

// dwie etykiety na tej samej wysokosci zlewaja sie w jedna plame, wiec rozsuwamy je
// o minimalny odstep zachowujac kolejnosc, ktora wynika z danych
export function separateLabels(first: number, second: number, gap = 12): [number, number] {
  const distance = Math.abs(first - second)

  if (distance >= gap) {
    return [first, second]
  }

  const shift = (gap - distance) / 2

  return first <= second ? [first - shift, second + shift] : [first + shift, second - shift]
}
