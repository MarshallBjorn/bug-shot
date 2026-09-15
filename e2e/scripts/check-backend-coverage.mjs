import { readdir, readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'

const root = resolve(process.argv[2] ?? '.')
const threshold = Number(process.argv[3] ?? 70)

async function findCoverageFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const result = []

  for (const entry of entries) {
    const fullPath = join(directory, entry.name)

    if (entry.isDirectory()) {
      result.push(...await findCoverageFiles(fullPath))
      continue
    }

    if (entry.isFile() && entry.name === 'coverage.cobertura.xml') {
      result.push(fullPath)
    }
  }

  return result
}

const files = await findCoverageFiles(root)

if (files.length === 0) {
  throw new Error(`Nie znaleziono coverage.cobertura.xml w ${root}`)
}

if (files.length > 1) {
  throw new Error(
    `Znaleziono więcej niż jeden raport coverage.cobertura.xml:\n${files.join('\n')}`,
  )
}

const xml = await readFile(files[0], 'utf8')
const match = xml.match(/<coverage\b[^>]*\bline-rate="([^"]+)"/)

if (!match) {
  throw new Error(`Brak line-rate w raporcie ${files[0]}`)
}

const coverage = Number(match[1]) * 100

if (!Number.isFinite(coverage)) {
  throw new Error(`Nieprawidłowy line-rate w ${files[0]}`)
}

console.log(`Backend line coverage: ${coverage.toFixed(2)}%`)
console.log(`Required minimum: ${threshold.toFixed(2)}%`)

if (coverage < threshold) {
  throw new Error(
    `BACKEND COVERAGE GATE FAILED: ${coverage.toFixed(2)}% < ${threshold.toFixed(2)}%`,
  )
}

console.log('BACKEND COVERAGE GATE = PASS')
