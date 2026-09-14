import { useEffect, useState } from 'react'
import { getProjectAnalytics, type AnalyticsRange, type ProjectAnalytics } from '../api/analytics'

interface AnalyticsState {
  analytics: ProjectAnalytics | null
  error: string | null
  loading: boolean
}

interface Answer {
  projectId: string
  range: AnalyticsRange | null
  includeToday: boolean
  analytics: ProjectAnalytics | null
  error: string | null
}

// pusty zakres nie zgadza się z żadnym więc pierwszy render wychodzi jako ładowanie
const noAnswer: Answer = { projectId: '', range: null, includeToday: true, analytics: null, error: null }

// dni na osi i "dzisiaj" mają zgadzać się z kalendarzem oglądającego a nie serwera
function browserTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
}

export function useProjectAnalytics(
  projectId: string,
  range: AnalyticsRange,
  includeToday: boolean,
): AnalyticsState {
  const [answer, setAnswer] = useState<Answer>(noAnswer)

  useEffect(() => {
    const controller = new AbortController()

    getProjectAnalytics(projectId, range, includeToday, browserTimeZone(), controller.signal)
      .then((analytics) => setAnswer({ projectId, range, includeToday, analytics, error: null }))
      .catch((cause: Error) => {
        if (controller.signal.aborted) return
        setAnswer({ projectId, range, includeToday, analytics: null, error: cause.message })
      })

    return () => controller.abort()
  }, [projectId, range, includeToday])

  const loading =
    answer.projectId !== projectId || answer.range !== range || answer.includeToday !== includeToday

  return {
    // dane poprzedniego zakresu zostają na ekranie żeby zmiana zakresu nie przeładowywała widoku
    analytics: answer.projectId === projectId ? answer.analytics : null,
    error: loading ? null : answer.error,
    loading,
  }
}
