import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from '../auth/AuthContext'

function RequireAuth() {
  const { status } = useAuth()
  const location = useLocation()

  if (status === 'checking') {
    return <p>Sprawdzanie sesji...</p>
  }

  // adres zapamiętany w stanie trasy żeby po zalogowaniu wrócić tam gdzie kliknął użytkownik
  if (status === 'anonymous') {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  }

  return <Outlet />
}

export default RequireAuth
