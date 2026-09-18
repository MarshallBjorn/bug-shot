import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { getProjects } from '../api/projects'
import { useAuth } from '../auth/AuthContext'
import type { Project } from '../types'

function readNotice(state: unknown) {
  const candidate = state as { notice?: unknown } | null

  return typeof candidate?.notice === 'string' ? candidate.notice : null
}

function HomePage() {
  const { user } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const incoming = readNotice(location.state)
  const [notice, setNotice] = useState(incoming)
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

  if (incoming && incoming !== notice) {
    setNotice(incoming)
  }

  // komunikat zostaje na ekranie ale znika z historii zeby nie wracal po odswiezeniu
  useEffect(() => {
    if (incoming) {
      navigate(location.pathname, { replace: true, state: null })
    }
  }, [incoming, location.pathname, navigate])

  const noticeBox = notice && (
    <p role="status" className="rounded-md border bg-card px-3 py-2 text-sm">
      {notice}
    </p>
  )

  if (error) {
    return (
      <div className="space-y-4">
        {noticeBox}
        <p role="alert">Nie udało się pobrać projektów. {error}</p>
      </div>
    )
  }

  if (!projects) {
    return (
      <div className="space-y-4">
        {noticeBox}
        <p>Ładowanie...</p>
      </div>
    )
  }

  if (projects.length === 0) {
    return (
      <div className="space-y-4">
        {noticeBox}
        {user?.isAdmin ? (
          <p>
            Brak projektów. Załóż pierwszy w <Link to="/admin/projects">panelu projektów</Link>.
          </p>
        ) : (
          <p>Brak projektów. Zakłada je administrator.</p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {noticeBox}
      {/* bez skrotu do zarzadzania projektami, admin ma je w nawigacji panelu */}
      <h2 className="text-xl font-semibold tracking-tight">Projekty</h2>
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
