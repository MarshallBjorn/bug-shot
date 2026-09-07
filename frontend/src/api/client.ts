import { accessToken, renewSession } from '../auth/session'
import { apiBaseUrl } from '../config'
import { ApiError } from './error'

export { ApiError }

export async function apiRequest(path: string, signal?: AbortSignal) {
  let response = await send(path, signal)

  // access token żyje kwadrans więc pierwsze żądanie po jego wygaśnięciu odnawia sesję i idzie raz jeszcze
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
      ? { Accept: 'application/json', Authorization: `Bearer ${token}` }
      : { Accept: 'application/json' },
    signal,
  })
}

export async function apiPost<T>(path: string, body: unknown) {
  const response = await sendMutation<T>(path, 'POST', body)

  return response
}
