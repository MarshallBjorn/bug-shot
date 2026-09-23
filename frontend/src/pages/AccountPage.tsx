import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { changeOwnPassword } from '../api/users'
import { useAuth } from '../auth/AuthContext'
import NewPasswordFields from '../components/NewPasswordFields'
import { passwordProblem } from '../passwordPolicy'

function AccountPage() {
  const { user } = useAuth()
  const [current, setCurrent] = useState('')
  const [password, setPassword] = useState('')
  const [repeated, setRepeated] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [sending, setSending] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaved(false)

    const problem = passwordProblem(password, repeated)

    if (problem) {
      setError(problem)
      return
    }

    setSending(true)
    setError(null)

    try {
      await changeOwnPassword(current, password)
      setCurrent('')
      setPassword('')
      setRepeated('')
      setSaved(true)
    } catch (cause) {
      setError((cause as Error).message)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="max-w-md space-y-4">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold tracking-tight">Moje konto</h2>
        <p className="text-sm text-muted-foreground">{user?.email}</p>
      </div>

      <form className="space-y-4 rounded-lg border bg-card p-4" onSubmit={submit}>
        <h3 className="text-sm font-semibold">Zmiana hasła</h3>

        {/* menedzer hasel zapisuje haslo pod tym adresem */}
        <input type="email" autoComplete="username" value={user?.email ?? ''} readOnly hidden />

        <div className="space-y-1.5">
          <Label htmlFor="account-current">Obecne hasło</Label>
          <Input
            id="account-current"
            type="password"
            autoComplete="current-password"
            required
            value={current}
            disabled={sending}
            onChange={(event) => setCurrent(event.target.value)}
          />
        </div>

        <NewPasswordFields
          idPrefix="account"
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

        {saved && (
          <p role="status" className="text-sm">
            Hasło zmienione. Pozostałe sesje tego konta zostały wylogowane.
          </p>
        )}

        <Button type="submit" disabled={sending}>
          {sending ? 'Zapisywanie...' : 'Zmień hasło'}
        </Button>
      </form>
    </div>
  )
}

export default AccountPage
