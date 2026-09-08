import { ApiError } from '../api/error'
import { apiBaseUrl } from '../config'
import type { AuthenticatedUser } from '../types'

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
  renewal ??= renew().finally(() => {
    renewal = null
  })

  return renewal
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
