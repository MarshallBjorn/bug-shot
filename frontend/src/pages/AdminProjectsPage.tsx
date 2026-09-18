import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import ConfirmDialog from '../components/ConfirmDialog'
import PromptDialog, { type PromptRequest } from '../components/PromptDialog'
import {
  addProjectOrigin,
  createProject,
  deleteProject,
  getProjects,
  removeProjectOrigin,
  renameProject,
} from '../api/projects'
import type { Project } from '../types'

type Pending =
  | { kind: 'rename' | 'origin' | 'delete'; project: Project }
  | null

const prompts: Record<'rename' | 'origin', (project: Project) => PromptRequest> = {
  rename: (project) => ({
    title: 'Zmień nazwę projektu',
    label: 'Nazwa',
    initialValue: project.name,
    confirmLabel: 'Zmień nazwę',
  }),
  origin: () => ({
    title: 'Dodaj dozwolony origin',
    description: 'Widget może zgłaszać błędy tylko z adresów wpisanych na tę listę.',
    label: 'Origin',
    placeholder: 'https://acme.example',
    confirmLabel: 'Dodaj',
  }),
}

function AdminProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [key, setKey] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [pending, setPending] = useState<Pending>(null)

  useEffect(() => {
    const controller = new AbortController()

    getProjects(controller.signal)
      .then((items) => {
        setProjects(items)
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

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const trimmedName = name.trim()
    const trimmedKey = key.trim()

    if (!trimmedName || !trimmedKey || creating) return

    setCreating(true)
    setCreateError(null)

    try {
      const project = await createProject(trimmedName, trimmedKey)

      setProjects((current) => [...current, project].sort((a, b) => a.name.localeCompare(b.name)))
      setName('')
      setKey('')
    } catch (cause) {
      setCreateError((cause as Error).message)
    } finally {
      setCreating(false)
    }
  }

  // bledy akcji ida do komunikatu na stronie, bo window.alert nie da sie odczytac czytnikiem
  // ani zamknac klawiatura, a przy okazji blokuje cala karte
  async function run(action: () => Promise<void>) {
    setActionError(null)

    try {
      await action()
    } catch (cause) {
      setActionError((cause as Error).message)
    }
  }

  function askRename(project: Project) {
    setPending({ kind: 'rename', project })
  }

  function askOrigin(project: Project) {
    setPending({ kind: 'origin', project })
  }

  function askDelete(project: Project) {
    setPending({ kind: 'delete', project })
  }

  async function confirmPrompt(value: string) {
    if (!pending || pending.kind === 'delete') return

    const { kind, project } = pending
    setPending(null)

    await run(async () => {
      if (kind === 'rename') {
        if (value === project.name) return

        const updated = await renameProject(project.id, value)
        setProjects((current) => current.map((p) => (p.id === project.id ? updated : p)))
        return
      }

      const added = await addProjectOrigin(project.id, value)

      setProjects((current) =>
        current.map((p) => (p.id === project.id ? { ...p, origins: [...p.origins, added] } : p)),
      )
    })
  }

  async function confirmDelete() {
    if (pending?.kind !== 'delete') return

    const { project } = pending
    setPending(null)

    // projekt ze zgloszeniami jest zablokowany kluczem obcym, backend oddaje 409 z komunikatem
    await run(async () => {
      await deleteProject(project.id)
      setProjects((current) => current.filter((p) => p.id !== project.id))
    })
  }

  async function handleRemoveOrigin(project: Project, originId: string) {
    await run(async () => {
      await removeProjectOrigin(project.id, originId)

      setProjects((current) =>
        current.map((p) =>
          p.id === project.id ? { ...p, origins: p.origins.filter((o) => o.id !== originId) } : p,
        ),
      )
    })
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold tracking-tight">Zarządzanie projektami</h2>

      <form
        className="flex flex-wrap items-end gap-2 rounded-lg border bg-card p-4"
        onSubmit={handleCreate}
      >
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Nazwa</span>
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            disabled={creating}
            required
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Klucz</span>
          <Input
            value={key}
            onChange={(event) => setKey(event.target.value)}
            disabled={creating}
            required
          />
        </label>

        <Button type="submit" disabled={creating || !name.trim() || !key.trim()}>
          {creating ? 'Zakładanie...' : 'Nowy projekt'}
        </Button>

        {createError && (
          <span role="alert" className="text-sm text-destructive">
            {createError}
          </span>
        )}
      </form>

      {error && (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          Nie udało się pobrać projektów. {error}
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
      ) : projects.length === 0 ? (
        <p className="text-sm text-muted-foreground">Brak projektów.</p>
      ) : (
        <ul className="space-y-3">
          {projects.map((project) => (
            <li key={project.id} className="space-y-3 rounded-lg border bg-card p-4">
              <div className="flex flex-wrap items-center gap-3">
                <strong className="font-semibold">{project.name}</strong>
                <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                  {project.key}
                </code>
                <Link
                  to={`/projects/${project.id}/tickets`}
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  Zgłoszenia
                </Link>
                <span className="ml-auto flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    aria-label={`Zmień nazwę projektu ${project.name}`}
                    onClick={() => askRename(project)}
                  >
                    Zmień nazwę
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    aria-label={`Usuń projekt ${project.name}`}
                    onClick={() => askDelete(project)}
                  >
                    Usuń
                  </Button>
                </span>
              </div>

              <div className="space-y-1.5 border-t pt-3">
                <span className="text-xs text-muted-foreground">Dozwolone originy</span>
                {project.origins.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Bez originu widget nie może zgłaszać do tego projektu.
                  </p>
                ) : (
                  <ul className="flex flex-wrap gap-1.5">
                    {project.origins.map((origin) => (
                      <li
                        key={origin.id}
                        className="inline-flex items-center gap-1 rounded-full border py-0.5 pr-1 pl-2.5 font-mono text-xs"
                      >
                        {origin.origin}
                        <button
                          type="button"
                          aria-label={`Usuń origin ${origin.origin}`}
                          onClick={() => handleRemoveOrigin(project, origin.id)}
                          className="rounded-full p-0.5 text-muted-foreground hover:text-destructive"
                        >
                          <X aria-hidden="true" className="size-3" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={`Dodaj origin do projektu ${project.name}`}
                  onClick={() => askOrigin(project)}
                >
                  Dodaj origin
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <PromptDialog
        request={
          pending && pending.kind !== 'delete' ? prompts[pending.kind](pending.project) : null
        }
        onCancel={() => setPending(null)}
        onConfirm={confirmPrompt}
      />

      <ConfirmDialog
        request={
          pending?.kind === 'delete'
            ? {
                title: `Usunąć projekt ${pending.project.name}?`,
                description:
                  'Projekt ze zgłoszeniami jest chroniony i backend odmówi. Usunąć da się tylko pusty projekt.',
                confirmLabel: 'Usuń projekt',
                destructive: true,
              }
            : null
        }
        onCancel={() => setPending(null)}
        onConfirm={confirmDelete}
      />
    </div>
  )
}

export default AdminProjectsPage
