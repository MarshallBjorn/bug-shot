import { randomBytes } from 'node:crypto'
import { spawnSync } from 'node:child_process'

const e2eJwtSigningKey = randomBytes(32).toString('base64url')
process.env.E2E_JWT_SIGNING_KEY = e2eJwtSigningKey

const composeArgs = [
  '--project-name',
  'bugshot-e2e',
  '-f',
  '../docker-compose.e2e.yml',
  '-f',
  '../docker-compose.notifications.e2e.yml',
]

const run = (args, options = {}) => {
  const result = spawnSync(
    'docker',
    ['compose', ...composeArgs, ...args],
    {
      stdio: 'inherit',
      shell: process.platform === 'win32',
      ...options,
    },
  )

  if (result.status !== 0) {
    throw new Error(
      `docker compose ${args.join(' ')} failed with exit code ${result.status}`,
    )
  }
}

const sleep = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms))

async function waitForApi() {
  const url = 'http://localhost:8085/healthz'

  for (let attempt = 1; attempt <= 60; attempt += 1) {
    try {
      const response = await fetch(url)

      if (response.ok) {
        console.log(`E2E API healthy after ${attempt} attempt(s).`)
        return
      }
    } catch {
      // Backend jeszcze startuje.
    }

    await sleep(1000)
  }

  throw new Error('E2E API did not become healthy within 60 seconds.')
}

let exitCode = 0

try {
  console.log('=== START E2E DOCKER STACK ===')

  run([
    'up',
    '-d',
    '--build',
    'postgres-e2e',
    'minio-e2e',
    'mailpit-e2e',
    'backend-e2e',
    'frontend-e2e',
  ])

  console.log('=== WAIT FOR E2E API / MIGRATIONS ===')
  await waitForApi()

  console.log('=== RUN PLAYWRIGHT AGAINST DOCKER STACK ===')

  const result = spawnSync(
    'npx',
    ['playwright', 'test'],
    {
      stdio: 'inherit',
      shell: process.platform === 'win32',
      env: {
        ...process.env,
        E2E_JWT_SIGNING_KEY: e2eJwtSigningKey,
        E2E_POSTGRES_HOST: '127.0.0.1',
        E2E_POSTGRES_PORT: '5435',
        E2E_POSTGRES_USER: 'bugshot',
        E2E_POSTGRES_PASSWORD: 'bugshot_e2e',
        E2E_POSTGRES_DB: 'bugshot_e2e',
        E2E_API_BASE_URL: 'http://localhost:8085',
        E2E_DASHBOARD_BASE_URL: 'http://localhost:5175',
        E2E_MAILPIT_API_URL: 'http://localhost:8026',
      },
    },
  )

  exitCode = result.status ?? 1
} catch (error) {
  console.error(error)
  exitCode = 1
} finally {
  console.log('=== STOP ONLY E2E DOCKER STACK ===')

  try {
    run([
      'down',
      '--remove-orphans',
    ])
  } catch (error) {
    console.error(error)
    exitCode = exitCode || 1
  }
}

process.exit(exitCode)

