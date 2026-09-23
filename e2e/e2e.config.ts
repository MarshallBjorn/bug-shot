import { tmpdir } from 'node:os'
import { join } from 'node:path'

export const postgres = {
  host: process.env.E2E_POSTGRES_HOST ?? '127.0.0.1',
  port: Number(process.env.E2E_POSTGRES_PORT ?? 5434),
  user: process.env.E2E_POSTGRES_USER ?? 'bugshot',
  password: process.env.E2E_POSTGRES_PASSWORD ?? 'bugshot_e2e',
  database: process.env.E2E_POSTGRES_DB ?? 'bugshot_e2e',
}

export const connectionString =
  `Host=${postgres.host};Port=${postgres.port};Database=${postgres.database};` +
  `Username=${postgres.user};Password=${postgres.password}`

export const apiBaseUrl =
  process.env.E2E_API_BASE_URL ?? 'http://localhost:8085'

export const dashboardBaseUrl =
  process.env.E2E_DASHBOARD_BASE_URL ?? 'http://localhost:5175'

export const mailpitApiUrl =
  process.env.E2E_MAILPIT_API_URL ?? 'http://localhost:8026'

export const dashboardPortNumber = 5175

export const attachmentsPath =
  join(tmpdir(), 'bugshot-e2e-attachments')

export const admin = {
  email: process.env.E2E_ADMIN_EMAIL ?? 'admin@bug-shot.test',
  password:
    process.env.E2E_ADMIN_PASSWORD ??
    'e2e-admin-not-a-real-password',
}

export const signingKey = process.env.E2E_JWT_SIGNING_KEY

if (!signingKey) {
  throw new Error('E2E_JWT_SIGNING_KEY is required.')
}

export const demoProjectId =
  '11111111-1111-1111-1111-111111111111'

export const widgetOrigin = 'http://127.0.0.1:5500'
