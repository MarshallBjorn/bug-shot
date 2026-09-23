import { Navigate, Outlet } from 'react-router'
import { useAuth } from '../auth/AuthContext'

function RequireAdmin() {
  const { user } = useAuth()

  if (!user?.isAdmin) {
    return <Navigate to="/" replace state={{ notice: 'Ta sekcja jest dostępna tylko dla administratora.' }} />
  }

  return <Outlet />
}

export default RequireAdmin
