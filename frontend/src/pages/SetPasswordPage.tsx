import { useEffect, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import { acceptAccountLink, inspectAccountLink, type AccountLinkInfo } from '../auth/session'
import AuthScreen from '../components/AuthScreen'
import NewPasswordFields from '../components/NewPasswordFields'
import { passwordProblem } from '../passwordPolicy'

type LinkState = { kind: 'checking' } | { kind: 'invalid' } | { kind: 'failed'; message: string } | ({ kind: 'valid' } & AccountLinkInfo)

function SetPasswordPage() {
  const navigate = useNavigate()
  // token siedzi we fragmencie adresu wiec nie trafia do logow serwera
  const { hash } = useLocation()
  const [token] = useState(() => hash.slice(1))
  const [link, setLink] = useState<LinkState>({ kind: 'checking' })
  const [password, setPassword] = useState('')
  const [repeated, setRepeated] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  // po odczytaniu token znika z paska adresu i z historii karty
  useEffect(() => {
    if (window.location.hash) {
      window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search)
    }
  }, [])

  useEffect(() => {
    let active = true

    const check = token
      ? inspectAccountLink(token).then<LinkState>((info) => (info ? { kind: 'valid', ...info } : { kind: 'invalid' }))
      : Promise.resolve<LinkState>({ kind: 'invalid' })

    check
      .catch((cause: Error): LinkState => ({ kind: 'failed', message: cause.message }))
      .then((state) => {
        if (active) setLink(state)
      })

    return () => {
      active = false
    }
  }, [token])

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
      await acceptAccountLink(token, password)
      navigate('/', { replace: true })
    } catch (cause) {
      setError((cause as Error).message)
      setSending(false)
    }
  }

  if (link.kind === 'checking') {
    return <p className="p-4 text-sm text-muted-foreground">Sprawdzanie linku...</p>
  }

  if (link.kind !== 'valid') {
    return (
      <AuthScreen
        title="Link nie działa"
        description={
          link.kind === 'failed'
            ? `Nie udało się sprawdzić linku. ${link.message}`
            : 'Link był już użyty, wygasł albo konto zostało wyłączone. Poproś administratora o nowy.'
        }
      >
        <Button asChild variant="outline" className="w-full">
          <Link to="/login">Przejdź do logowania</Link>
        </Button>
      </AuthScreen>
    )
  }

  const invitation = link.purpose === 'Invitation'

  return (
    <AuthScreen
      title={invitation ? 'Witaj w Bug-shot' : 'Ustaw nowe hasło'}
      description={
        <>
          {invitation ? 'Ustaw hasło do konta ' : 'Nowe hasło dla konta '}
          <strong className="font-medium text-foreground">{link.email}</strong>. Po zapisaniu od razu się zalogujesz.
        </>
      }
      onSubmit={submit}
    >
      {/* menedzer hasel zapisuje haslo pod tym adresem */}
      <input type="email" autoComplete="username" value={link.email} readOnly hidden />

      <NewPasswordFields
        idPrefix="link"
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
        {sending ? 'Zapisywanie...' : invitation ? 'Ustaw hasło i wejdź' : 'Zmień hasło'}
      </Button>
    </AuthScreen>
  )
}

export default SetPasswordPage
