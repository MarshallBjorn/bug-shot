import { Navigate, Outlet } from 'react-router'
import { useAuth } from '../auth/AuthContext'
import { useManagesAnyProject, useProjects } from '../projects/ProjectsContext'

// ustawienia projektow sa dla administratora i maintainerow a API i tak pilnuje kazdego projektu osobno
function RequireProjectManager() {
  const { user } = useAuth()
  const { loading } = useProjects()
  const managesProjects = useManagesAnyProject()

  if (user?.isAdmin) {
    return <Outlet />
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Ładowanie widoku...</p>
  }

  if (!managesProjects) {
    return <Navigate to="/" replace state={{ notice: 'Ta sekcja jest dostępna tylko dla opiekunów projektów.' }} />
  }

  return <Outlet />
}

export default RequireProjectManager
