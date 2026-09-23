import { ApiError } from '../api/error'
import { apiBaseUrl } from '../config'
import type { AccountTokenPurpose, AuthenticatedUser } from '../types'

export interface Session {
  accessToken: string
  expiresAt: string
  user: AuthenticatedUser
}

// token siedzi w pamięci a nie w localStorage żeby nie dało się go wyczytać skryptem z obcej strony
let current: Session | null = null
let renewal: Promise<Session | null> | null = null

const listeners = new Set<(session: Session | null) => void>()

export function accessToken() {
  return current?.accessToken ?? null
}

export function watchSession(listener: (session: Session | null) => void) {
  listeners.add(listener)

  return () => {
    listeners.delete(listener)
  }
}

export async function signIn(email: string, password: string) {
  const response = await post('/login', { email, password })

  if (!response.ok) {
    throw new ApiError(
      response.status,
      response.status === 401
        ? 'Nieprawidłowy e-mail albo hasło.'
        : `Logowanie zakończyło się kodem ${response.status}`,
    )
  }

  return publish((await response.json()) as Session)
}

export interface AccountLinkInfo {
  email: string
  purpose: AccountTokenPurpose
}

export async function setupRequired() {
  try {
    const response = await fetch(`${apiBaseUrl}/api/v1/auth/setup`)

    return response.ok && ((await response.json()) as { required: boolean }).required
  } catch {
    // bez odpowiedzi API zostaje zwykly ekran logowania z jego wlasnym bledem
    return false
  }
}

// kreator i link z maila koncza sie od razu sesja tak jak logowanie
export async function completeSetup(token: string, email: string, password: string) {
  return publish(await sessionFrom(await post('/setup', { token, email, password })))
}

// null znaczy ze link jest nieznany zuzyty albo wygasl, API nie mowi ktore
export async function inspectAccountLink(token: string) {
  const response = await post('/account-token', { token })

  if (response.status === 404) {
    return null
  }

  if (!response.ok) {
    throw new ApiError(response.status, await problemTitle(response))
  }

  return (await response.json()) as AccountLinkInfo
}

export async function acceptAccountLink(token: string, password: string) {
  return publish(await sessionFrom(await post('/set-password', { token, password })))
}

async function sessionFrom(response: Response) {
  if (!response.ok) {
    throw new ApiError(response.status, await problemTitle(response))
  }

  return (await response.json()) as Session
}

// walidacja hasla przychodzi w errors a reszta odmow w samym title
async function problemTitle(response: Response) {
  try {
    const problem = (await response.json()) as { title?: string; errors?: Record<string, string[]> }
    const fields = Object.values(problem.errors ?? {}).flat()

    return fields.length > 0 ? fields.join(' ') : (problem.title ?? `Kod odpowiedzi ${response.status}`)
  } catch {
    return `Kod odpowiedzi ${response.status}`
  }
}

export async function signOut() {
  try {
    await post('/logout')
  } finally {
    publish(null)
  }
}

// StrictMode i równoległe 401 potrafią zawołać to kilka razy naraz
// a token odświeżający rotuje przy każdym użyciu więc drugie wywołanie musi poczekać na pierwsze
export function renewSession() {
  renewal ??= withLock(renew).finally(() => {
    renewal = null
  })

  return renewal
}

// karty panelu dziela jedno cookie wiec odswiezaja sesje po kolei
// bez tego druga karta trafia w token zuzyty przez pierwsza i laduje na ekranie logowania
function withLock(run: () => Promise<Session | null>) {
  return navigator.locks
    ? navigator.locks.request('bugshot-refresh', run)
    : run()
}

async function renew(): Promise<Session | null> {
  // padnięta sieć jest dla panelu tym samym co brak sesji więc nie ma tu czego rzucać dalej
  try {
    const response = await post('/refresh')

    return response.ok ? publish((await response.json()) as Session) : publish(null)
  } catch {
    return publish(null)
  }
}

function publish<T extends Session | null>(session: T) {
  current = session

  for (const listener of listeners) {
    listener(session)
  }

  return session
}

// cookie z tokenem odświeżającym jest HttpOnly więc trzeba o nie poprosić jawnie
function post(path: string, body?: unknown) {
  return fetch(`${apiBaseUrl}/api/v1/auth${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  })
}
