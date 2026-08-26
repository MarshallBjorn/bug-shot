import { apiBaseUrl } from '../config'

export async function apiGet<T>(path: string, signal?: AbortSignal) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    headers: { Accept: 'application/json' },
    signal,
  })

  if (!response.ok) {
    throw new Error(`Żądanie ${path} zakończyło się kodem ${response.status}`)
  }

  return (await response.json()) as T
}
