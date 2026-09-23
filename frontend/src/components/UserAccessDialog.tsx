import { useMemo, useState, type FormEvent } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import FilterSelect, { type SelectOption } from './FilterSelect'
import { fold } from '../fold'
import { roleDescriptions, roleLabels } from '../roles'
import type { Project, ProjectAccess, ProjectRole, UserAccount } from '../types'

export interface AccessDraft {
  email: string
  isAdmin: boolean
  projects: ProjectAccess[]
}

interface UserAccessDialogProps {
  // bez konta dialog zaprasza nowa osobe
  account: UserAccount | null
  projects: Project[]
  // wlasnej roli administratora nie da sie zmienic, API i tak odpowie 409
  isSelf: boolean
  onCancel: () => void
  onSubmit: (draft: AccessDraft) => Promise<void>
}

const roles = Object.keys(roleLabels) as ProjectRole[]

const roleOptions: SelectOption[] = roles.map((role) => ({ value: role, label: roleLabels[role] }))

// przy kilku projektach filtr tylko zawadza
const filterFrom = 7

// nowy dostep startuje od najmniejszej roli, podniesc ja to jeden klik
const defaultRole: ProjectRole = 'Viewer'

function UserAccessDialog({ account, projects, isSelf, onCancel, onSubmit }: UserAccessDialogProps) {
  const [email, setEmail] = useState(account?.email ?? '')
  const [isAdmin, setIsAdmin] = useState(account?.isAdmin ?? false)
  const [access, setAccess] = useState<Record<string, ProjectRole>>(() =>
    Object.fromEntries((account?.projects ?? []).map((p) => [p.projectId, p.role])),
  )
  const [newRole, setNewRole] = useState<ProjectRole>(defaultRole)
  const [filter, setFilter] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const inviting = account === null

  // przy setkach projektow lista pokazuje tylko te z dostepem a reszta czeka w wyszukiwarce
  const assigned = useMemo(() => projects.filter((project) => project.id in access), [projects, access])

  const available = useMemo<SelectOption[]>(
    () => projects.filter((project) => !(project.id in access)).map((p) => ({ value: p.id, label: p.name })),
    [projects, access],
  )

  const visible = useMemo(() => {
    const needle = fold(filter.trim())

    return needle ? assigned.filter((project) => fold(project.name).includes(needle)) : assigned
  }, [assigned, filter])

  function setRole(projectId: string, role: ProjectRole) {
    setAccess((current) => ({ ...current, [projectId]: role }))
  }

  function add(projectId: string) {
    if (projectId) setRole(projectId, newRole)
  }

  function addAll() {
    setAccess((current) => ({
      ...Object.fromEntries(available.map((option) => [option.value, newRole])),
      ...current,
    }))
  }

  function remove(projectId: string) {
    setAccess((current) => {
      const next = { ...current }
      delete next[projectId]
      return next
    })
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError(null)

    try {
      await onSubmit({
        email: email.trim(),
        isAdmin,
        projects: Object.entries(access).map(([projectId, role]) => ({ projectId, role })),
      })
    } catch (cause) {
      setError((cause as Error).message)
      setBusy(false)
    }
  }

  return (
    <Dialog open onOpenChange={(next) => !next && !busy && onCancel()}>
      <DialogContent className="sm:max-w-lg">
        <form className="space-y-4" onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>{inviting ? 'Zaproś osobę' : `Dostęp konta ${account.email}`}</DialogTitle>
            <DialogDescription>
              {inviting
                ? 'Na podany adres pójdzie link, przez który osoba sama ustawi hasło. Link działa 72 godziny.'
                : 'Zmiana roli i projektów działa od następnego kliknięcia tej osoby, bez ponownego logowania.'}
            </DialogDescription>
          </DialogHeader>

          {inviting && (
            <div className="space-y-1.5">
              <Label htmlFor="invite-email">E-mail</Label>
              <Input
                id="invite-email"
                type="email"
                autoComplete="off"
                autoFocus
                required
                value={email}
                disabled={busy}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
          )}

          <div className="flex items-start gap-2">
            <Checkbox
              id="access-admin"
              checked={isAdmin}
              disabled={busy || isSelf}
              onCheckedChange={(checked) => setIsAdmin(checked === true)}
              className="mt-0.5"
            />
            <div className="space-y-0.5">
              <Label htmlFor="access-admin">Administrator</Label>
              <p className="text-xs text-muted-foreground">
                {isSelf
                  ? 'Własnej roli administratora nie możesz zmienić.'
                  : 'Zarządza kontami i regułami sanityzacji, ma pełny dostęp do każdego projektu.'}
              </p>
            </div>
          </div>

          <fieldset className="space-y-3" disabled={busy}>
            <legend className="flex w-full items-baseline justify-between text-sm font-medium">
              Projekty
              <span className="text-xs font-normal text-muted-foreground">
                {assigned.length} z {projects.length}
              </span>
            </legend>

            {isAdmin && (
              <p className="text-xs text-muted-foreground">
                Administrator widzi wszystkie projekty niezależnie od tej listy. Zostaje ona na wypadek odebrania roli.
              </p>
            )}

            {projects.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nie ma jeszcze żadnego projektu.</p>
            ) : (
              <>
                {available.length > 0 && (
                  <div className="grid grid-cols-[minmax(0,1fr)_11rem] items-end gap-2">
                    <FilterSelect
                      label="Dodaj projekt"
                      value=""
                      options={[{ value: '', label: 'Wybierz projekt...' }, ...available]}
                      onChange={add}
                      searchable
                    />
                    <FilterSelect
                      label="z rolą"
                      value={newRole}
                      options={roleOptions}
                      onChange={(value) => setNewRole(value as ProjectRole)}
                    />
                  </div>
                )}

                {available.length > 1 && (
                  <Button type="button" variant="ghost" size="sm" className="-mt-1 px-2" onClick={addAll}>
                    Dodaj wszystkie pozostałe ({available.length}) z rolą {roleLabels[newRole].toLowerCase()}
                  </Button>
                )}

                {assigned.length >= filterFrom && (
                  <Input
                    type="search"
                    aria-label="Szukaj wśród przypisanych projektów"
                    placeholder="Szukaj wśród przypisanych..."
                    value={filter}
                    onChange={(event) => setFilter(event.target.value)}
                  />
                )}

                {assigned.length === 0 ? (
                  <p className="rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
                    Brak dostępu do projektów. {isAdmin ? '' : 'Po zalogowaniu konto zobaczy pustą listę.'}
                  </p>
                ) : (
                  <ul aria-label="Projekty z dostępem" className="max-h-60 divide-y overflow-y-auto rounded-md border">
                    {visible.map((project) => (
                      <li key={project.id} className="flex items-center gap-2 px-3 py-1.5">
                        <span className="min-w-0 flex-1 truncate text-sm">{project.name}</span>
                        <FilterSelect
                          label={`Rola w ${project.name}`}
                          value={access[project.id]}
                          options={roleOptions}
                          onChange={(value) => setRole(project.id, value as ProjectRole)}
                          className="w-44 [&>span]:sr-only"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8 shrink-0"
                          aria-label={`Odbierz dostęp do ${project.name}`}
                          onClick={() => remove(project.id)}
                        >
                          <X aria-hidden="true" />
                        </Button>
                      </li>
                    ))}
                    {visible.length === 0 && (
                      <li className="px-3 py-2 text-sm text-muted-foreground">Nic nie pasuje.</li>
                    )}
                  </ul>
                )}
              </>
            )}

            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer select-none">Co oznaczają role?</summary>
              <ul className="mt-1 space-y-0.5">
                {roles.map((role) => (
                  <li key={role}>
                    <span className="font-medium text-foreground">{roleLabels[role]}:</span> {roleDescriptions[role]}
                  </li>
                ))}
              </ul>
            </details>
          </fieldset>

          {error && (
            <p
              role="alert"
              className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" disabled={busy} onClick={onCancel}>
              Anuluj
            </Button>
            <Button type="submit" disabled={busy || (inviting && !email.trim())}>
              {busy ? 'Zapisywanie...' : inviting ? 'Wyślij zaproszenie' : 'Zapisz'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default UserAccessDialog
