import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { getProjects } from '../api/projects'
import { useAuth } from '../auth/AuthContext'
import type { Project } from '../types'

function HomePage() {
  const { user } = useAuth()
  const [projects, setProjects] = useState<Project[] | null>(null)
  const [error, setError] = useState<string | null>(null)

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

    return () => controller.abort()
  }, [])

  if (error) {
    return <p role="alert">Nie udało się pobrać projektów. {error}</p>
  }

  if (!projects) {
    return <p>Ładowanie...</p>
  }

  if (projects.length === 0) {
    return user?.isAdmin ? (
      <p>
        Brak projektów. Załóż pierwszy w <Link to="/admin/projects">panelu projektów</Link>.
      </p>
    ) : (
      <p>Brak projektów. Zakłada je administrator.</p>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-semibold tracking-tight">Projekty</h2>
        {user?.isAdmin && (
          <Link
            to="/admin/projects"
            className="ml-auto text-sm text-muted-foreground hover:text-foreground"
          >
            Zarządzaj projektami
          </Link>
        )}
      </div>
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((project) => (
          <li key={project.id}>
            <Link
              to={`/projects/${project.id}/tickets`}
              className="block rounded-lg border bg-card px-4 py-3 font-medium transition-colors hover:bg-accent"
            >
              {project.name}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default HomePage
