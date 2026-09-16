import { accessToken, renewSession } from '../auth/session'
import { apiBaseUrl } from '../config'
import { ApiError } from './error'

export { ApiError }

export async function apiRequest(path: string, signal?: AbortSignal) {
  let response = await send(path, signal)

  if (response.status === 401 && (await renewSession())) {
    response = await send(path, signal)
  }

  if (!response.ok) {
    throw new ApiError(response.status, `Żądanie ${path} zakończyło się kodem ${response.status}`)
  }

  return response
}

export async function apiGet<T>(path: string, signal?: AbortSignal) {
  const response = await apiRequest(path, signal)

  return (await response.json()) as T
}

function send(path: string, signal?: AbortSignal) {
  const token = accessToken()

  return fetch(`${apiBaseUrl}${path}`, {
    headers: token
      ? {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        }
      : {
          Accept: 'application/json',
        },
    signal,
  })
}

async function sendMutation<T>(
  path: string,
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  body?: unknown,
  headers?: HeadersInit,
  retried = false,
) {
  const token = accessToken()

  const requestHeaders: HeadersInit = {
    Accept: 'application/json',
    ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...headers,
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    method,
    headers: requestHeaders,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })

  if (response.status === 401 && !retried) {
    const renewed = await renewSession()

    if (renewed) {
      return sendMutation<T>(path, method, body, headers, true)
    }
  }

  if (!response.ok) {
    throw new ApiError(response.status, await problemMessage(path, response))
  }

  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}

// ProblemDetails niesie prawdziwy powod bledu, np. zajety klucz projektu albo blokade kasowania
async function problemMessage(path: string, response: Response) {
  try {
    const problem = (await response.json()) as { title?: string; errors?: Record<string, string[]> }

    if (problem.errors) {
      const fields = Object.values(problem.errors).flat()

      if (fields.length > 0) {
        return fields.join(' ')
      }
    }

    if (problem.title) {
      return problem.title
    }
  } catch {
    // cialo nie jest JSON-em albo jest puste, zostaje ogolny opis
  }

  return `Żądanie ${path} zakończyło się kodem ${response.status}`
}

export async function apiPost<T>(path: string, body: unknown) {
  return sendMutation<T>(path, 'POST', body)
}

export async function apiPut<T>(path: string, body: unknown) {
  return sendMutation<T>(path, 'PUT', body)
}

export async function apiPatch<T>(
  path: string,
  body: unknown,
  headers?: HeadersInit,
) {
  return sendMutation<T>(path, 'PATCH', body, headers)
}

export async function apiDelete(path: string) {
  return sendMutation<void>(path, 'DELETE')
}

