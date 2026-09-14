export type CsvValue = string | number | null

// przecinek jako separator zgodnie z RFC 4180 i pole w cudzysłowie gdy zawiera separator cudzysłów albo nową linię
export function toCsv(header: string[], rows: CsvValue[][]) {
  return [header, ...rows].map((row) => row.map(csvField).join(',')).join('\r\n')
}

function csvField(value: CsvValue) {
  let text = value === null ? '' : String(value)

  // nazwy stron pochodzą od użytkowników a tekst zaczynający się od = + - @ Excel wykonałby jako formułę
  if (typeof value === 'string' && /^[=+\-@]/.test(text)) {
    text = `'${text}`
  }

  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

export function downloadCsv(fileName: string, csv: string) {
  // BOM na początku bo bez niego Excel czyta polskie znaki w złym kodowaniu
  const url = URL.createObjectURL(new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')

  link.href = url
  link.download = fileName
  link.click()

  URL.revokeObjectURL(url)
}
