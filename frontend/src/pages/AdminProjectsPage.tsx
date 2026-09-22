import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import {
  addProjectOrigin,
  createProject,
  deleteProject,
  getProjects,
  removeProjectOrigin,
  renameProject,
} from '../api/projects'
import type { Project } from '../types'

function AdminProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [key, setKey] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

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

  async function handleRename(project: Project) {
    const nextName = window.prompt('Nowa nazwa projektu', project.name)

    if (!nextName || !nextName.trim() || nextName === project.name) return

    try {
      const updated = await renameProject(project.id, nextName.trim())
      setProjects((current) => current.map((p) => (p.id === project.id ? updated : p)))
    } catch (cause) {
      window.alert((cause as Error).message)
    }
  }

  async function handleDelete(project: Project) {
    const confirmed = window.confirm(`Czy na pewno chcesz usunąć projekt "${project.name}"?`)

    if (!confirmed) return

    try {
      await deleteProject(project.id)
      setProjects((current) => current.filter((p) => p.id !== project.id))
    } catch (cause) {
      // np. projekt ma zgloszenia, backend oddaje 409 z komunikatem
      window.alert((cause as Error).message)
    }
  }

  async function handleAddOrigin(project: Project) {
    const origin = window.prompt('Dozwolony origin, np. https://acme.example')

    if (!origin || !origin.trim()) return

    try {
      const added = await addProjectOrigin(project.id, origin.trim())

      setProjects((current) =>
        current.map((p) => (p.id === project.id ? { ...p, origins: [...p.origins, added] } : p)),
      )
    } catch (cause) {
      window.alert((cause as Error).message)
    }
  }

  async function handleRemoveOrigin(project: Project, originId: string) {
    try {
      await removeProjectOrigin(project.id, originId)

      setProjects((current) =>
        current.map((p) =>
          p.id === project.id ? { ...p, origins: p.origins.filter((o) => o.id !== originId) } : p,
        ),
      )
    } catch (cause) {
      window.alert((cause as Error).message)
    }
  }

  return (
    <>
      <div className="list-heading">
        <h2>Zarządzanie projektami</h2>
        <Link to="/admin/sanitization-rules">Reguły sanityzacji</Link>
      </div>

      <form className="admin-form" onSubmit={handleCreate}>
        <label>
          <span>Nazwa</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            disabled={creating}
            required
          />
        </label>

        <label>
          <span>Klucz</span>
          <input
            value={key}
            onChange={(event) => setKey(event.target.value)}
            disabled={creating}
            required
          />
        </label>

        <button type="submit" disabled={creating || !name.trim() || !key.trim()}>
          {creating ? 'Zakładanie...' : 'Nowy projekt'}
        </button>

        {createError && <span role="alert">{createError}</span>}
      </form>

      {error && <p role="alert">Nie udało się pobrać projektów. {error}</p>}

      {loading ? (
        <p>Ładowanie...</p>
      ) : projects.length === 0 ? (
        <p>Brak projektów.</p>
      ) : (
        <ul className="admin-project-list">
          {projects.map((project) => (
            <li key={project.id}>
              <div className="admin-project-header">
                <strong>{project.name}</strong>
                <code>{project.key}</code>
                <Link to={`/projects/${project.id}/tickets`}>Zgłoszenia</Link>
                <Link to={`/admin/projects/${project.id}/notifications`}>Powiadomienia</Link>
                <button type="button" onClick={() => handleRename(project)}>
                  Zmień nazwę
                </button>
                <button type="button" onClick={() => handleDelete(project)}>
                  Usuń
                </button>
              </div>

              <div className="admin-origins">
                <span>Dozwolone originy</span>
                <ul className="admin-origin-list">
                  {project.origins.map((origin) => (
                    <li key={origin.id}>
                      {origin.origin}
                      <button type="button" onClick={() => handleRemoveOrigin(project, origin.id)}>
                        Usuń
                      </button>
                    </li>
                  ))}
                </ul>
                <button type="button" onClick={() => handleAddOrigin(project)}>
                  Dodaj origin
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

export default AdminProjectsPage

