import { useEffect, useState } from 'react'
import { MoreHorizontal, UserPlus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import AccountLinkNotice, { type LinkNotice } from '../components/AccountLinkNotice'
import ConfirmDialog, { type ConfirmRequest } from '../components/ConfirmDialog'
import UserAccessDialog, { type AccessDraft } from '../components/UserAccessDialog'
import {
  activateUser,
  deactivateUser,
  deleteUser,
  getUsers,
  inviteUser,
  resendInvitation,
  sendPasswordReset,
  setUserAdmin,
  setUserProjects,
} from '../api/users'
import { useAuth } from '../auth/AuthContext'
import { formatDateTime } from '../format'
import { useProjects } from '../projects/ProjectsContext'
import { roleLabels } from '../roles'
import type { ProjectAccess, UserAccount, UserAccountState } from '../types'

const stateLabels: Record<UserAccountState, string> = {
  Active: 'Aktywne',
  Invited: 'Zaproszone',
  Disabled: 'Wyłączone',
}

const stateVariants: Record<UserAccountState, 'secondary' | 'outline' | 'destructive'> = {
  Active: 'secondary',
  Invited: 'outline',
  Disabled: 'destructive',
}

type Editing = { account: UserAccount | null } | null

type Pending = { kind: 'deactivate' | 'delete'; account: UserAccount } | null

function sameAccess(a: ProjectAccess[], b: ProjectAccess[]) {
  const key = (items: ProjectAccess[]) =>
    items
      .map((item) => `${item.projectId}:${item.role}`)
      .sort()
      .join(',')

  return key(a) === key(b)
}

function AdminUsersPage() {
  const { user } = useAuth()
  const { projects } = useProjects()

  const [accounts, setAccounts] = useState<UserAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [notice, setNotice] = useState<LinkNotice | null>(null)
  const [editing, setEditing] = useState<Editing>(null)
  const [pending, setPending] = useState<Pending>(null)

  useEffect(() => {
    const controller = new AbortController()

    getUsers(controller.signal)
      .then((items) => {
        setAccounts(items)
        setError(null)
      })
      .catch((cause: Error) => {
        if (controller.signal.aborted) return
        setError(cause.message)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [])

  function replace(account: UserAccount) {
    setAccounts((current) => {
      const others = current.filter((a) => a.id !== account.id)

      return [...others, account].sort((a, b) => a.email.localeCompare(b.email))
    })
  }

  function patchState(id: string, state: UserAccountState) {
    setAccounts((current) => current.map((a) => (a.id === id ? { ...a, state } : a)))
  }

  async function run(action: () => Promise<void>) {
    setActionError(null)

    try {
      await action()
    } catch (cause) {
      setActionError((cause as Error).message)
    }
  }

  async function save(draft: AccessDraft) {
    const account = editing?.account ?? null

    if (account === null) {
      const created = await inviteUser(draft.email, draft.isAdmin, draft.projects)

      replace(created.user)
      setNotice({ ...created, email: created.user.email, kind: 'invitation' })
      setEditing(null)
      return
    }

    let updated = account

    if (draft.isAdmin !== account.isAdmin) {
      updated = await setUserAdmin(account.id, draft.isAdmin)
    }

    if (!sameAccess(draft.projects, account.projects)) {
      updated = await setUserProjects(account.id, draft.projects)
    }

    replace(updated)
    setEditing(null)
  }

  async function resend(account: UserAccount) {
    await run(async () => {
      const result = await resendInvitation(account.id)
      setNotice({ ...result, email: account.email, kind: 'invitation' })
    })
  }

  async function reset(account: UserAccount) {
    await run(async () => {
      const result = await sendPasswordReset(account.id)
      setNotice({ ...result, email: account.email, kind: 'reset' })
    })
  }

  async function activate(account: UserAccount) {
    await run(async () => {
      await activateUser(account.id)
      patchState(account.id, 'Active')
    })
  }

  async function confirmPending() {
    if (!pending) return

    const { kind, account } = pending
    setPending(null)

    await run(async () => {
      if (kind === 'deactivate') {
        await deactivateUser(account.id)
        patchState(account.id, 'Disabled')
        return
      }

      await deleteUser(account.id)
      setAccounts((current) => current.filter((a) => a.id !== account.id))
      // komunikat o zaproszeniu cofnietego konta tylko by mylil
      setNotice((current) => (current?.email === account.email ? null : current))
    })
  }

  const confirm: ConfirmRequest | null =
    pending?.kind === 'deactivate'
      ? {
          title: 'Wyłączyć konto?',
          description: `${pending.account.email} zostanie od razu wylogowane i nie zaloguje się, dopóki nie włączysz konta z powrotem. Historia zgłoszeń zostaje.`,
          confirmLabel: 'Wyłącz konto',
          destructive: true,
        }
      : pending?.kind === 'delete'
        ? {
            title: 'Cofnąć zaproszenie?',
            description: `Konto ${pending.account.email} zniknie, a link z maila przestanie działać.`,
            confirmLabel: 'Cofnij zaproszenie',
            destructive: true,
          }
        : null

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-semibold tracking-tight">Konta</h2>
        <Button type="button" className="ml-auto" onClick={() => setEditing({ account: null })}>
          <UserPlus aria-hidden="true" />
          Zaproś osobę
        </Button>
      </div>

      {notice && <AccountLinkNotice notice={notice} onDismiss={() => setNotice(null)} />}

      {error && (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          Nie udało się pobrać kont. {error}
        </p>
      )}

      {actionError && (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {actionError}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Ładowanie...</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table aria-label="Konta panelu" className="w-full border-collapse text-sm">
            <thead className="border-b text-left text-xs text-muted-foreground">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">E-mail</th>
                <th scope="col" className="px-3 py-2 font-medium">Stan</th>
                <th scope="col" className="px-3 py-2 font-medium">Dostęp</th>
                <th scope="col" className="hidden px-3 py-2 font-medium md:table-cell">Założone</th>
                <th scope="col" className="px-3 py-2">
                  <span className="sr-only">Akcje</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) => {
                const isSelf = account.id === user?.id

                return (
                  <tr key={account.id} className="border-b align-top last:border-0">
                    <td className="px-3 py-2.5">
                      <span className="font-medium">{account.email}</span>
                      {isSelf && <span className="ml-2 text-xs text-muted-foreground">(Ty)</span>}
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge variant={stateVariants[account.state]}>{stateLabels[account.state]}</Badge>
                    </td>
                    <td className="px-3 py-2.5">
                      {account.isAdmin ? (
                        <span>Administrator, wszystkie projekty</span>
                      ) : account.projects.length === 0 ? (
                        <span className="text-muted-foreground">Bez projektów</span>
                      ) : (
                        <ul className="space-y-0.5">
                          {account.projects.map((project) => (
                            <li key={project.projectId}>
                              {project.projectName}
                              <span className="text-muted-foreground"> · {roleLabels[project.role]}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                    <td className="hidden px-3 py-2.5 whitespace-nowrap text-muted-foreground md:table-cell">
                      {formatDateTime(account.createdAt)}
                    </td>
                    <td className="px-3 py-1.5 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            aria-label={`Akcje konta ${account.email}`}
                          >
                            <MoreHorizontal aria-hidden="true" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-60">
                          <DropdownMenuItem onSelect={() => setEditing({ account })}>
                            Zmień dostęp
                          </DropdownMenuItem>
                          {account.state === 'Invited' && (
                            <DropdownMenuItem onSelect={() => void resend(account)}>
                              Wyślij zaproszenie ponownie
                            </DropdownMenuItem>
                          )}
                          {account.state === 'Active' && (
                            <DropdownMenuItem onSelect={() => void reset(account)}>
                              Wyślij link do zmiany hasła
                            </DropdownMenuItem>
                          )}
                          {!isSelf && <DropdownMenuSeparator />}
                          {!isSelf && account.state === 'Disabled' && (
                            <DropdownMenuItem onSelect={() => void activate(account)}>
                              Włącz konto
                            </DropdownMenuItem>
                          )}
                          {!isSelf && account.state === 'Invited' && (
                            <DropdownMenuItem
                              variant="destructive"
                              onSelect={() => setPending({ kind: 'delete', account })}
                            >
                              Cofnij zaproszenie
                            </DropdownMenuItem>
                          )}
                          {!isSelf && account.state !== 'Disabled' && (
                            <DropdownMenuItem
                              variant="destructive"
                              onSelect={() => setPending({ kind: 'deactivate', account })}
                            >
                              Wyłącz konto
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <UserAccessDialog
          account={editing.account}
          projects={projects}
          isSelf={editing.account?.id === user?.id}
          onCancel={() => setEditing(null)}
          onSubmit={save}
        />
      )}

      <ConfirmDialog request={confirm} onCancel={() => setPending(null)} onConfirm={confirmPending} />
    </div>
  )
}

export default AdminUsersPage
