import { Link, Outlet, useNavigate } from 'react-router'
import { useAuth } from '../auth/AuthContext'

function AppLayout() {
  const { user, logOut } = useAuth()
  const navigate = useNavigate()

  async function leave() {
    await logOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="app">
      <header className="app-header">
        <Link to="/">Bug-shot</Link>
        <span className="app-user">
          {user?.email}
          <button onClick={leave} type="button">
            Wyloguj
          </button>
        </span>
      </header>
      <main className="app-content">
        <Outlet />
      </main>
    </div>
  )
}

export default AppLayout
