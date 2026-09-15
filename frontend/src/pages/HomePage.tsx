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
    <>
      <div className="list-heading">
        <h2>Projekty</h2>
        {user?.isAdmin && <Link to="/admin/projects">Zarządzaj projektami</Link>}
      </div>
      <ul className="admin-project-list">
        {projects.map((project) => (
          <li key={project.id}>
            <Link to={`/projects/${project.id}/tickets`}>{project.name}</Link>
          </li>
        ))}
      </ul>
    </>
  )
}

export default HomePage
