import { Link, Outlet } from 'react-router'

function AppLayout() {
  return (
    <div className="app">
      <header className="app-header">
        <Link to="/">Bug-shot</Link>
      </header>
      <main className="app-content">
        <Outlet />
      </main>
    </div>
  )
}

export default AppLayout
