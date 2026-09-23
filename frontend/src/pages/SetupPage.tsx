import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ApiError } from '../api/error'
import { useAuth } from '../auth/AuthContext'
import { completeSetup, setupRequired } from '../auth/session'
import AuthScreen from '../components/AuthScreen'
import NewPasswordFields from '../components/NewPasswordFields'
import { passwordProblem } from '../passwordPolicy'

function setupError(cause: unknown) {
  if (cause instanceof ApiError && cause.status === 403) {
    return 'Token nie pasuje. Skopiuj go jeszcze raz z logu API, po restarcie API token jest nowy.'
  }

  if (cause instanceof ApiError && cause.status === 409) {
    return 'Pierwsze konto już istnieje. Zaloguj się nim albo poproś administratora o zaproszenie.'
  }

  return (cause as Error).message
}

// pierwsze konto instancji ktora wystartowala bez ADMIN_EMAIL
function SetupPage() {
  const { status } = useAuth()
  const navigate = useNavigate()
  const [required, setRequired] = useState<boolean | null>(null)
  const [token, setToken] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [repeated, setRepeated] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  useEffect(() => {
    let active = true

    void setupRequired().then((value) => {
      if (active) setRequired(value)
    })

    return () => {
      active = false
    }
  }, [])

  if (status === 'authenticated') {
    return <Navigate to="/" replace />
  }

  if (required === null) {
    return <p className="p-4 text-sm text-muted-foreground">Sprawdzanie instancji...</p>
  }

  if (!required) {
    return (
      <AuthScreen title="Instancja jest już skonfigurowana" description="Konto administratora już istnieje.">
        <Button asChild className="w-full">
          <Link to="/login">Przejdź do logowania</Link>
        </Button>
      </AuthScreen>
    )
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const problem = passwordProblem(password, repeated)

    if (problem) {
      setError(problem)
      return
    }

    setSending(true)
    setError(null)

    try {
      await completeSetup(token.trim(), email.trim(), password)
      navigate('/', { replace: true })
    } catch (cause) {
      setError(setupError(cause))
      setSending(false)
    }
  }

  return (
    <AuthScreen
      title="Pierwsze konto administratora"
      description="API wystartowało bez ADMIN_EMAIL. Token jednorazowy znajdziesz w logu API przy ostatnim starcie."
      onSubmit={submit}
    >
      <div className="space-y-1.5">
        <Label htmlFor="setup-token">Token z logu API</Label>
        <Input
          id="setup-token"
          autoComplete="off"
          autoFocus
          required
          spellCheck={false}
          className="font-mono"
          value={token}
          disabled={sending}
          onChange={(event) => setToken(event.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="setup-email">E-mail</Label>
        <Input
          id="setup-email"
          type="email"
          autoComplete="username"
          required
          value={email}
          disabled={sending}
          onChange={(event) => setEmail(event.target.value)}
        />
      </div>

      <NewPasswordFields
        idPrefix="setup"
        password={password}
        repeated={repeated}
        disabled={sending}
        onPasswordChange={setPassword}
        onRepeatedChange={setRepeated}
      />

      {error && (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </p>
      )}

      <Button className="w-full" type="submit" disabled={sending}>
        {sending ? 'Zakładanie...' : 'Załóż konto'}
      </Button>
    </AuthScreen>
  )
}

export default SetupPage
