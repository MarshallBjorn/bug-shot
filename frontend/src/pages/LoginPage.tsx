import { useState } from 'react'
import { Bug } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router'
import { useAuth } from '../auth/AuthContext'

function readReturnPath(state: unknown) {
  const candidate = state as { from?: unknown } | null

  return typeof candidate?.from === 'string' ? candidate.from : '/'
}

function LoginPage() {
  const { status, logIn } = useAuth()
  const { state } = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  if (status === 'checking') {
    return <p>Sprawdzanie sesji...</p>
  }

  if (status === 'authenticated') {
    return <Navigate to={readReturnPath(state)} replace />
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSending(true)
    setError(null)

    try {
      await logIn(email, password)
    } catch (cause) {
      setError((cause as Error).message)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center px-4 py-12">
      <form
        className="w-full max-w-sm space-y-4 rounded-lg border bg-card p-6"
        onSubmit={submit}
      >
        <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <Bug aria-hidden="true" className="size-5 text-primary" />
          Bug-shot
        </h1>

        <div className="space-y-1.5">
          <Label htmlFor="login-email">E-mail</Label>
          <Input
            id="login-email"
            autoComplete="username"
            autoFocus
            onChange={(event) => setEmail(event.target.value)}
            required
            type="email"
            value={email}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="login-password">Hasło</Label>
          <Input
            id="login-password"
            autoComplete="current-password"
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {error}
          </p>
        )}

        <Button className="w-full" disabled={sending} type="submit">
          {sending ? 'Logowanie...' : 'Zaloguj'}
        </Button>
      </form>
    </div>
  )
}

export default LoginPage
