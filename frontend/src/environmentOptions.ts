// wartosci sa zamkniete i pochodza z Analytics/UserAgentParser.cs po stronie API
// zmiana tam wymaga zmiany tutaj, dlatego listy siedza w jednym miejscu a nie w komponencie
export const browserOptions = ['Chrome', 'Firefox', 'Safari', 'Edge', 'Opera', 'Other'] as const

export const osOptions = ['Windows', 'macOS', 'Linux', 'Android', 'iOS', 'ChromeOS', 'Other'] as const

export const deviceOptions = ['desktop', 'mobile', 'tablet'] as const

const deviceLabels: Record<string, string> = {
  desktop: 'Komputer',
  mobile: 'Telefon',
  tablet: 'Tablet',
}

export function formatDevice(value: string) {
  return deviceLabels[value] ?? value
}
