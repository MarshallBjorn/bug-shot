import { tmpdir } from 'node:os'
import { join } from 'node:path'

// osobna baza zeby uruchomienie testow nie kasowalo danych z docker compose
export const postgres = {
  host: process.env.E2E_POSTGRES_HOST ?? '127.0.0.1',
  port: Number(process.env.E2E_POSTGRES_PORT ?? 5433),
  user: process.env.E2E_POSTGRES_USER ?? 'bugshot',
  password: process.env.E2E_POSTGRES_PASSWORD ?? 'change-me-dev-only',
  database: process.env.E2E_POSTGRES_DB ?? 'bugshot_e2e',
}

export const connectionString =
  `Host=${postgres.host};Port=${postgres.port};Database=${postgres.database};` +
  `Username=${postgres.user};Password=${postgres.password}`

// porty inne niz w compose zeby dalo sie odpalic testy przy chodzacym srodowisku
const apiPort = Number(process.env.E2E_API_PORT ?? 8085)
const dashboardPort = Number(process.env.E2E_DASHBOARD_PORT ?? 5175)

// oba adresy musza byc na tym samym hoscie bo inaczej cookie z refreshem jest cross-site
// i SameSite=Lax slusznie go nie wysyla. localhost i 127.0.0.1 to dla przegladarki dwie rozne witryny
export const apiBaseUrl = `http://localhost:${apiPort}`
export const dashboardBaseUrl = `http://localhost:${dashboardPort}`
export const dashboardPortNumber = dashboardPort

export const attachmentsPath = join(tmpdir(), 'bugshot-e2e-attachments')

// konto administratora seeduje API przy starcie z tych samych zmiennych co w compose
export const admin = {
  email: 'admin@bug-shot.test',
  password: process.env.E2E_ADMIN_PASSWORD ?? 'e2e-admin-not-a-real-password',
}

export const signingKey =
  process.env.E2E_JWT_SIGNING_KEY ?? 'e2e-signing-key-with-at-least-32-bytes'

// projekt i origin zaseedowane migracja InitialCreate
export const demoProjectId = '11111111-1111-1111-1111-111111111111'
export const widgetOrigin = 'http://127.0.0.1:5500'
