import { Navigate, Outlet } from 'react-router'
import { useAuth } from '../auth/AuthContext'

function RequireAdmin() {
  const { user } = useAuth()

  if (!user?.isAdmin) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}

export default RequireAdmin
