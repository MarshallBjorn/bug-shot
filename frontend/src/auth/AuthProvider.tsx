import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { AuthContext, type AuthValue } from './AuthContext'
import { renewSession, signIn, signOut, watchSession, type Session } from './session'

// sesja odnawia się minutę przed wygaśnięciem tokena
const beforeExpiryMs = 60_000
const minimumDelayMs = 5_000

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => watchSession(setSession), [])

  // cookie z refreshem przeżywa odświeżenie strony więc sesję odtwarzamy zanim pokażemy cokolwiek
  useEffect(() => {
    renewSession().finally(() => setChecking(false))
  }, [])

  // access token wygasa po kwadransie a panel ma nie wyrzucać na login w środku pracy
  useEffect(() => {
    if (!session) {
      return
    }

    const delay = Math.max(
      new Date(session.expiresAt).getTime() - Date.now() - beforeExpiryMs,
      minimumDelayMs,
    )

    const timer = setTimeout(() => void renewSession(), delay)

    return () => clearTimeout(timer)
  }, [session])

  const logIn = useCallback(async (email: string, password: string) => {
    await signIn(email, password)
  }, [])

  const logOut = useCallback(async () => {
    await signOut()
  }, [])

  const value = useMemo<AuthValue>(
    () => ({
      status: checking ? 'checking' : session ? 'authenticated' : 'anonymous',
      user: session?.user ?? null,
      logIn,
      logOut,
    }),
    [checking, session, logIn, logOut],
  )

  return <AuthContext value={value}>{children}</AuthContext>
}
