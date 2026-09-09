// Baza musi istniec i miec schemat zanim Playwright wystartuje API,
// bo webServer rusza przed globalSetup.
import { execFileSync } from 'node:child_process'
import { Client } from 'pg'
import { connectionString, postgres } from '../e2e.config.ts'

async function ensureDatabase() {
  const client = new Client({ ...postgres, database: 'postgres' })
  await client.connect()

  try {
    const existing = await client.query('select 1 from pg_database where datname = $1', [
      postgres.database,
    ])

    if (existing.rowCount === 0) {
      // nazwa bazy pochodzi z konfiguracji a nie z zadania wiec cudzyslow wystarczy
      await client.query(`create database "${postgres.database}"`)
      console.log(`utworzono baze ${postgres.database}`)
    }
  } finally {
    await client.end()
  }
}

function migrate() {
  execFileSync(
    'dotnet',
    [
      'ef',
      'database',
      'update',
      '--project',
      'backend/BugShot.Api/BugShot.Api.csproj',
      '--startup-project',
      'backend/BugShot.Api/BugShot.Api.csproj',
    ],
    {
      cwd: '..',
      stdio: 'inherit',
      env: { ...process.env, ConnectionStrings__DefaultConnection: connectionString },
    },
  )
}

async function resetUsers() {
  const client = new Client({ ...postgres })
  await client.connect()

  try {
    // pusta tabela sprawia ze API zaseeduje administratora ze zmiennych srodowiskowych
    await client.query('delete from users')
  } finally {
    await client.end()
  }
}

await ensureDatabase()
migrate()
await resetUsers()
