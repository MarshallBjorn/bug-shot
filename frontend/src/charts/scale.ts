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

export function axisTicks(max: number, count = 4): number[] {
  const top = niceCeiling(max)
  const ticks: number[] = []

  for (let index = 0; index <= count; index += 1) {
    ticks.push((top / count) * index)
  }

  // ulamki na osi liczb calkowitych tylko myla, wiec przy malych wartosciach schodzimy na krok jednostkowy
  return top <= count ? Array.from({ length: top + 1 }, (_, index) => index) : ticks
}

export function scaleY(value: number, max: number, height: number): number {
  const top = niceCeiling(max)

  return top === 0 ? height : height - (value / top) * height
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
