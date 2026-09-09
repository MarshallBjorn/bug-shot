import { useState } from 'react'
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
    <form className="login" onSubmit={submit}>
      <h1>Bug-shot</h1>

      <label>
        <span>E-mail</span>
        <input
          autoComplete="username"
          autoFocus
          onChange={(event) => setEmail(event.target.value)}
          required
          type="email"
          value={email}
        />
      </label>

      <label>
        <span>Hasło</span>
        <input
          autoComplete="current-password"
          onChange={(event) => setPassword(event.target.value)}
          required
          type="password"
          value={password}
        />
      </label>

      {error && <p role="alert">{error}</p>}

      <button disabled={sending} type="submit">
        {sending ? 'Logowanie...' : 'Zaloguj'}
      </button>
    </form>
  )
}

export default LoginPage
