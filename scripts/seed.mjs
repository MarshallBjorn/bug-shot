// Wrzuca do projektu seed realistyczne zgloszenia z ostatnich tygodni pod sprawdzanie panelu i analityki.
// Idzie przez prawdziwe API wiec zgloszenia przechodza sanityzacje i zapisuja pliki jak z widgetu.
// Daty stempluje serwer dlatego na koniec jedno zapytanie do bazy przesuwa je w przeszlosc.
// Uzycie: node scripts/seed.mjs [--count 600] [--days 90] [--reset]

import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, rmSync } from 'node:fs'
import { basename, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { crc32, deflateSync } from 'node:zlib'

const root = fileURLToPath(new URL('..', import.meta.url))

const { values: options } = parseArgs({
  options: {
    count: { type: 'string', default: '600' },
    days: { type: 'string', default: '90' },
    api: { type: 'string', default: 'http://localhost:8080' },
    'env-file': { type: 'string', default: '.env' },
    'compose-file': { type: 'string', default: 'docker-compose.dev.yml' },
    random: { type: 'string', default: '2026' },
    reset: { type: 'boolean', default: false },
  },
})

const count = Number(options.count)
const days = Number(options.days)
const api = options.api.replace(/\/$/, '')
const env = { ...readEnvFile(join(root, options['env-file'])), ...process.env }

const PROJECT_KEY = 'seed'
const PROJECT_NAME = 'Sklep demo (seed)'
const ORIGIN = 'https://sklep.example'
const TEAM = ['bartek@bug-shot.local', 'radek@bug-shot.local', 'olek@bug-shot.local']
const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const CONCURRENCY = 16

const pages = [
  ['/koszyk', 26],
  ['/checkout/dostawa', 10],
  ['/checkout/platnosc', 14],
  ['/', 10],
  ['/szukaj', 9],
  ['/produkt', 20],
  ['/konto/zamowienia', 7],
  ['/konto/ustawienia', 3],
  ['/kontakt', 2],
]

// w ostatnim tygodniu platnosci psuja sie czesciej zeby panel mial strone z wyraznym przyrostem
const recentPages = pages.map(([path, weight]) => [path, path === '/checkout/platnosc' ? weight * 4 : weight])

const products = ['buty-trekkingowe-4471', 'kurtka-softshell-208', 'plecak-30l-915', 'czolowka-led-77']

const problems = {
  '/koszyk': [
    'Koszyk gubi produkty po odświeżeniu strony',
    'Nie da się zmienić ilości w koszyku, plus nic nie robi',
    'Kod rabatowy przyjęty, ale cena się nie zmienia',
  ],
  '/checkout/dostawa': ['Nie ładuje się lista paczkomatów', 'Formularz adresu czyści się po wybraniu kuriera'],
  '/checkout/platnosc': [
    'Płatność BLIK kręci się w nieskończoność',
    'Po powrocie z banku jest błąd zamówienia, a pieniądze zeszły',
    'Przycisk Zapłać jest nieaktywny',
  ],
  '/': ['Baner zasłania menu na telefonie', 'Karuzela promocji przeskakuje sama'],
  '/szukaj': ['Wyszukiwarka nie znajduje produktów z polskimi znakami', 'Filtr rozmiaru resetuje wyniki'],
  '/produkt': ['Zdjęcia produktu się nie powiększają', 'Wybór rozmiaru nie zmienia dostępności', 'Opinie ładują się w kółko'],
  '/konto/zamowienia': ['Historia zamówień jest pusta', 'Nie da się pobrać faktury PDF'],
  '/konto/ustawienia': ['Zmiana hasła kończy się błędem 500'],
  '/kontakt': ['Formularz kontaktowy nie wysyła wiadomości'],
}

const details = ['Działało jeszcze wczoraj.', 'Próbowałem kilka razy.', 'Dzieje się tylko na telefonie.', '', '', '']

// fragmenty trafiajace w globalne reguly sanityzacji
const secrets = [
  'Kontakt do mnie: jan.kowalski@example.com',
  'login: jkowalski password: Lato2026!',
  'W konsoli jest Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.demo.podpis',
  'W adresie widzę api_key=sk_live_demo_51Hx',
  'Cookie: session=abc123; cart=77',
]

const commentBodies = [
  'Potwierdzam, u mnie to samo.',
  'Sprawdzam logi z tego dnia.',
  'Poprawka poszła na staging.',
  'Nie odtwarzam na Chrome, potrzebny zrzut z telefonu.',
  'Duplikat, zamykam.',
  'Wygląda na problem po stronie operatora płatności.',
]

const desktopScreens = [
  { width: 1920, height: 947, devicePixelRatio: 1 },
  { width: 1536, height: 730, devicePixelRatio: 1.25 },
  { width: 1366, height: 641, devicePixelRatio: 1 },
]

const macScreens = [
  { width: 1440, height: 789, devicePixelRatio: 2 },
  { width: 1512, height: 868, devicePixelRatio: 2 },
]

const phoneScreens = [
  { width: 393, height: 745, devicePixelRatio: 3 },
  { width: 412, height: 839, devicePixelRatio: 2.625 },
  { width: 360, height: 692, devicePixelRatio: 3 },
]

const browsers = [
  [{ agent: (v) => `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${v}.0.0.0 Safari/537.36`, screens: desktopScreens }, 30],
  [{ agent: (v) => `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${v}.0.0.0 Safari/537.36`, screens: macScreens }, 10],
  [{ agent: (v) => `Mozilla/5.0 (Linux; Android 15; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${v}.0.0.0 Mobile Safari/537.36`, screens: phoneScreens }, 15],
  [{ agent: (v) => `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${v}.0.0.0 Safari/537.36 Edg/${v}.0.0.0`, screens: desktopScreens }, 7],
  [{ agent: () => 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1', screens: phoneScreens }, 16],
  [{ agent: () => 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15', screens: macScreens }, 8],
  [{ agent: () => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:142.0) Gecko/20100101 Firefox/142.0', screens: desktopScreens }, 9],
  [{ agent: () => 'Mozilla/5.0 (Linux; Android 14; SAMSUNG SM-A546B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/28.0 Chrome/130.0.0.0 Mobile Safari/537.36', screens: phoneScreens }, 5],
]

const locales = [
  [{ language: 'pl-PL', timeZone: 'Europe/Warsaw' }, 80],
  [{ language: 'en-US', timeZone: 'Europe/Warsaw' }, 8],
  [{ language: 'en-GB', timeZone: 'Europe/London' }, 6],
  [{ language: 'de-DE', timeZone: 'Europe/Berlin' }, 4],
  [{ language: 'uk-UA', timeZone: 'Europe/Kyiv' }, 2],
]

const logEntries = [
  ['INFO', 'console.log', 'widok gotowy'],
  ['INFO', 'console.info', 'koszyk zsynchronizowany'],
  ['WARN', 'console.warn', 'Brak ceny w odpowiedzi /api/cart, używam poprzedniej'],
  ['WARN', 'console.warn', 'Slow network detected, fallback font used'],
  ['ERROR', 'console.error', "TypeError: Cannot read properties of undefined (reading 'price')"],
  ['ERROR', 'window.onerror', 'Uncaught ReferenceError: dataLayer is not defined | stack=at analytics.js:12:5'],
]

let state = Number(options.random) >>> 0

// mulberry32 bo to samo ziarno ma dawac te same dane
function random() {
  state = (state + 0x6d2b79f5) >>> 0
  let t = state
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

function between(min, max) {
  return min + random() * (max - min)
}

function pick(items) {
  return items[Math.floor(random() * items.length)]
}

function weighted(entries) {
  let roll = random() * entries.reduce((sum, [, weight]) => sum + weight, 0)

  for (const [value, weight] of entries) {
    roll -= weight
    if (roll <= 0) return value
  }

  return entries[entries.length - 1][0]
}

// czasy reakcji maja dlugi ogon wiec rozklad log-normalny zamiast rownomiernego
function logNormal(median, spread) {
  const normal = Math.sqrt(-2 * Math.log(1 - random())) * Math.cos(2 * Math.PI * random())
  return median * Math.exp(spread * normal)
}

// wiecej zgloszen blizej dzisiaj i mniej w nocy i w weekendy
function activity(at, now) {
  const recency = 1 - (now - at) / (days * DAY)
  const date = new Date(at)
  const weekend = date.getUTCDay() === 0 || date.getUTCDay() === 6 ? 0.55 : 1
  const night = (date.getUTCHours() + 2) % 24 < 7 ? 0.2 : 1

  return (0.5 + 0.5 * recency) * weekend * night
}

function pageUrl(path) {
  let url = `${ORIGIN}${path}`

  if (path === '/produkt') url += `/${pick(products)}`

  if (path === '/szukaj') {
    url += `?q=${pick(['buty', 'kurtka', 'namiot'])}`
  } else if (random() < 0.25) {
    url += `?utm_source=${pick(['newsletter', 'facebook', 'google'])}`
  }

  if (random() < 0.1) url += '#opinie'

  return url
}

// przegladarka wysyla czas lokalny z przesunieciem strefy i zegar bywa troche do tylu
function reportedAt(receivedAt) {
  const local = new Date(receivedAt - between(5, 90) * 1000 + 2 * HOUR)
  return local.toISOString().replace('Z', '+02:00')
}

function consoleLog(receivedAt) {
  const lines = Array.from({ length: 2 + Math.floor(random() * 6) }, (_, index) => {
    const [level, source, message] = pick(logEntries)
    return `[${new Date(receivedAt - 2 * MINUTE + index * 7000).toISOString()}] ${level} ${source}: ${message}`
  })

  return `${lines.join('\n')}\n`
}

function planChanges(receivedAt, now) {
  const changes = []
  let at = receivedAt

  // zmiana ktora wypadlaby w przyszlosci ucina reszte wiec swieze zgloszenia zostaja otwarte
  const change = (status, hours) => {
    at += hours * HOUR
    if (at > now - MINUTE) return false
    changes.push({ status, at, by: pick(TEAM) })
    return true
  }

  const outcome = weighted([['resolved', 58], ['rejected', 12], ['progress', 14], ['new', 16]])

  if (outcome === 'new') return changes

  if (outcome === 'rejected') {
    change('Rejected', logNormal(8, 1.2))
    return changes
  }

  if (!change('InProgress', logNormal(5, 1.1)) || outcome === 'progress') return changes
  if (!change('Resolved', logNormal(30, 1.1))) return changes

  // czesc poprawek wraca bo blad sie powtorzyl
  if (random() < 0.08 && change('InProgress', logNormal(48, 0.8))) change('Resolved', logNormal(20, 1))

  return changes
}

function planComments(receivedAt, lastChangeAt, now) {
  const end = Math.min(now - MINUTE, Math.max(lastChangeAt, receivedAt + 3 * DAY))

  if (random() > 0.35 || end <= receivedAt + MINUTE) return []

  return Array.from({ length: 1 + Math.floor(random() * 3) }, () => ({
    at: between(receivedAt + MINUTE, end),
    author: pick(TEAM),
    body: pick(commentBodies),
  })).sort((a, b) => a.at - b.at)
}

function planTicket(now) {
  let receivedAt

  do {
    receivedAt = now - 10 * MINUTE - random() * days * DAY
  } while (random() > activity(receivedAt, now))

  const path = weighted(now - receivedAt < 7 * DAY ? recentPages : pages)
  const parts = [`${pick(problems[path])}.`, pick(details)]

  if (random() < 0.12) parts.push(pick(secrets))

  const changes = planChanges(receivedAt, now)
  const lastChangeAt = changes.at(-1)?.at ?? receivedAt
  const comments = planComments(receivedAt, lastChangeAt, now)
  const lastAt = Math.max(lastChangeAt, comments.at(-1)?.at ?? receivedAt)
  const deletedAt =
    now - receivedAt > 3 * DAY && lastAt + 2 * MINUTE < now && random() < 0.02
      ? between(lastAt + MINUTE, now - MINUTE)
      : null

  const browser = weighted(browsers)
  const locale = weighted(locales)

  return {
    receivedAt,
    reportedAt: reportedAt(receivedAt),
    pageUrl: pageUrl(path),
    userAgent: browser.agent(pick([137, 138, 139])),
    viewport: pick(browser.screens),
    language: locale.language,
    timeZone: locale.timeZone,
    description: parts.filter(Boolean).join(' '),
    screenshot: random() < 0.85,
    consoleLog: random() < 0.55 ? consoleLog(receivedAt) : null,
    changes,
    comments,
    deletedAt,
    updatedAt: deletedAt ?? lastAt,
  }
}

// API sprawdza sygnature i domkniecie pliku wiec zrzut musi byc prawdziwym PNG
function png(width, height, rgb) {
  const chunk = (type, data) => {
    const body = Buffer.concat([Buffer.from(type), data])
    const size = Buffer.alloc(4)
    const checksum = Buffer.alloc(4)
    size.writeUInt32BE(data.length)
    checksum.writeUInt32BE(crc32(body))
    return Buffer.concat([size, body, checksum])
  }

  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header[8] = 8
  header[9] = 2

  const row = Buffer.concat([Buffer.from([0]), Buffer.from(Array.from({ length: width }, () => rgb).flat())])
  const pixels = deflateSync(Buffer.concat(Array.from({ length: height }, () => row)))

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', pixels),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const screenshot = png(320, 200, [0xd0, 0x30, 0x40])

function readEnvFile(path) {
  if (!existsSync(path)) return {}

  const values = {}

  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
    if (match) values[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2')
  }

  return values
}

function fail(message) {
  console.error(`[seed] ${message}`)
  process.exit(1)
}

async function request(method, path, { token, body, form, headers = {} } = {}) {
  const init = { method, headers: { ...headers } }

  if (token) init.headers.Authorization = `Bearer ${token}`

  if (form) {
    init.body = form
  } else if (body !== undefined) {
    init.headers['Content-Type'] = 'application/json'
    init.body = JSON.stringify(body)
  }

  const response = await fetch(`${api}${path}`, init)
  const text = await response.text()

  if (!response.ok) throw new Error(`${method} ${path} ${response.status} ${text.slice(0, 300)}`)

  return response.headers.get('content-type')?.includes('json') ? JSON.parse(text) : text
}

let session = null

// access token zyje kwadrans a duzy seed potrafi trwac dluzej
async function accessToken() {
  if (session && Date.now() - session.at < 10 * MINUTE) return session.token

  try {
    const response = await request('POST', '/api/v1/auth/login', {
      body: { email: env.ADMIN_EMAIL, password: env.ADMIN_PASSWORD },
    })
    session = { token: response.accessToken, at: Date.now() }
  } catch (error) {
    fail(`logowanie kontem z ${options['env-file']} nie wyszlo, po testach backendu trzeba zrestartowac API (${error.message})`)
  }

  return session.token
}

function psql(sql) {
  const result = spawnSync(
    'docker',
    [
      'compose', '--env-file', join(root, options['env-file']), '-f', join(root, options['compose-file']),
      'exec', '-T', 'postgres',
      'psql', '-v', 'ON_ERROR_STOP=1', '-q', '-At', '-U', env.POSTGRES_USER, '-d', env.POSTGRES_DB,
    ],
    { input: sql, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  )

  if (result.status !== 0) fail(`zapytanie do bazy nie wyszlo: ${result.stderr || result.error}`)

  return result.stdout
}

async function ensureProject() {
  const token = await accessToken()
  const projects = await request('GET', '/api/v1/projects', { token })
  let project = projects.find((p) => p.key === PROJECT_KEY)

  if (!project) {
    project = await request('POST', '/api/v1/projects', { token, body: { name: PROJECT_NAME, key: PROJECT_KEY } })
  }

  if (!project.origins.some((o) => o.origin === ORIGIN)) {
    await request('POST', `/api/v1/projects/${project.id}/origins`, { token, body: { origin: ORIGIN } })
  }

  return project
}

// pliki leza w katalogu montowanym do kontenera wiec kasujemy je prosto z dysku
function resetProject() {
  const uris = psql(`
    select a.uri from ticket_attachments a
    join tickets t on t.id = a.ticket_id
    join projects p on p.id = t.project_id
    where p.key = '${PROJECT_KEY}';
  `).split('\n').filter(Boolean)

  psql(`delete from tickets t using projects p where p.id = t.project_id and p.key = '${PROJECT_KEY}';`)

  for (const uri of uris) rmSync(join(root, 'bug-shot-attachments', basename(uri)), { force: true })

  console.log(`[seed] skasowane zgloszenia projektu ${PROJECT_KEY}, plikow: ${uris.length}`)
}

async function createTicket(plan) {
  const created = await request('POST', '/api/v1/tickets', {
    headers: { Origin: ORIGIN },
    body: {
      projectKey: PROJECT_KEY,
      description: plan.description,
      pageUrl: plan.pageUrl,
      userAgent: plan.userAgent,
      reportedAt: plan.reportedAt,
      viewport: plan.viewport,
      language: plan.language,
      timeZone: plan.timeZone,
    },
  })

  plan.id = created.id

  if (plan.screenshot || plan.consoleLog) {
    const form = new FormData()
    if (plan.screenshot) form.append('screenshot', new Blob([screenshot], { type: 'image/png' }), 'screenshot.png')
    if (plan.consoleLog) form.append('consoleLog', new Blob([plan.consoleLog], { type: 'text/plain' }), 'konsola.txt')

    await request('POST', `/api/v1/tickets/${created.id}/attachments`, {
      headers: { Origin: ORIGIN, 'X-Upload-Token': created.uploadToken },
      form,
    })
  }

  const token = await accessToken()

  for (const comment of plan.comments) {
    await request('POST', `/api/v1/tickets/${created.id}/comments`, {
      token,
      body: { author: comment.author, body: comment.body },
    })
  }

  if (plan.changes.length > 0) {
    let { rowVersion } = await request('GET', `/api/v1/tickets/${created.id}`, { token })

    for (const change of plan.changes) {
      ;({ rowVersion } = await request('PATCH', `/api/v1/tickets/${created.id}/status`, {
        token,
        headers: { 'If-Match': rowVersion },
        body: { status: change.status, changedBy: change.by },
      }))
    }
  }

  if (plan.deletedAt) await request('DELETE', `/api/v1/tickets/${created.id}`, { token })
}

function chunks(items, size) {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, (index + 1) * size))
}

// wiersze historii i komentarzy dopasowujemy po kolejnosci w ramach zgloszenia bo powstaly w tej samej kolejnosci co w planie
function backdate(plans) {
  const at = (ms) => `'${new Date(ms).toISOString()}'`
  const tickets = plans.map((p) => `('${p.id}', ${at(p.receivedAt)}, ${at(p.updatedAt)}, ${p.deletedAt ? at(p.deletedAt) : 'null'})`)
  const history = plans.flatMap((p) =>
    [...p.changes.map((c) => c.at), ...(p.deletedAt ? [p.deletedAt] : [])].map((ms, index) => `('${p.id}', ${index + 1}, ${at(ms)})`),
  )
  const comments = plans.flatMap((p) => p.comments.map((c, index) => `('${p.id}', ${index + 1}, ${at(c.at)})`))

  const inserts = (table, rows) => chunks(rows, 1000).map((batch) => `insert into ${table} values ${batch.join(',')};`)

  psql(`
    begin;
    create temp table seed_ticket (id uuid primary key, received_at timestamptz, updated_at timestamptz, deleted_at timestamptz) on commit drop;
    create temp table seed_history (ticket_id uuid, n int, at timestamptz) on commit drop;
    create temp table seed_comment (ticket_id uuid, n int, at timestamptz) on commit drop;
    ${inserts('seed_ticket', tickets).join('\n')}
    ${inserts('seed_history', history).join('\n')}
    ${inserts('seed_comment', comments).join('\n')}

    update tickets t
    set received_at = s.received_at, created_at = s.received_at, updated_at = s.updated_at,
        deleted_at = case when t.deleted_at is null then null else s.deleted_at end
    from seed_ticket s where t.id = s.id;

    update ticket_status_changes c set changed_at = s.at
    from (
      select id, ticket_id, row_number() over (partition by ticket_id order by changed_at, id) as n
      from ticket_status_changes where ticket_id in (select id from seed_ticket)
    ) r
    join seed_history s on s.ticket_id = r.ticket_id and s.n = r.n
    where c.id = r.id;

    update ticket_comments c set created_at = s.at
    from (
      select id, ticket_id, row_number() over (partition by ticket_id order by created_at, id) as n
      from ticket_comments where ticket_id in (select id from seed_ticket)
    ) r
    join seed_comment s on s.ticket_id = r.ticket_id and s.n = r.n
    where c.id = r.id;

    update ticket_attachments a set created_at = s.received_at + interval '20 seconds'
    from seed_ticket s where a.ticket_id = s.id;

    update sanitization_logs l set created_at = s.received_at
    from seed_ticket s where l.ticket_id = s.id;
    commit;
  `)
}

async function main() {
  if (!Number.isInteger(count) || count < 1) fail('--count musi byc dodatnia liczba calkowita')

  for (const key of ['ADMIN_EMAIL', 'ADMIN_PASSWORD', 'POSTGRES_USER', 'POSTGRES_DB']) {
    if (!env[key]) fail(`brak ${key} w ${options['env-file']}`)
  }

  try {
    await request('GET', '/healthz')
  } catch {
    fail(`API nie odpowiada pod ${api}, najpierw postaw ${options['compose-file']}`)
  }

  if (options.reset) resetProject()

  const project = await ensureProject()
  const now = Date.now()
  const plans = Array.from({ length: count }, () => planTicket(now)).sort((a, b) => a.receivedAt - b.receivedAt)

  let done = 0
  let next = 0

  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (next < plans.length) {
        await createTicket(plans[next++])
        done++
        if (done % 100 === 0 || done === plans.length) console.log(`[seed] ${done}/${plans.length}`)
      }
    }),
  )

  backdate(plans)

  const statuses = {}
  for (const plan of plans) {
    const status = plan.deletedAt ? 'Deleted' : (plan.changes.at(-1)?.status ?? 'New')
    statuses[status] = (statuses[status] ?? 0) + 1
  }

  console.log(`[seed] gotowe, statusy: ${JSON.stringify(statuses)}`)
  console.log(`[seed] panel: http://localhost:5173/projects/${project.id}/tickets`)
}

main().catch((error) => fail(error.message))
