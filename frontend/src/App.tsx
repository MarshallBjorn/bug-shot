import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router'
import AppLayout from './components/AppLayout'
import RequireAdmin from './components/RequireAdmin'
import RequireAuth from './components/RequireAuth'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import NotFoundPage from './pages/NotFoundPage'
import TicketDetailsPage from './pages/TicketDetailsPage'
import TicketListPage from './pages/TicketListPage'

// analityka i ekrany administracyjne wchodzi sie rzadko, wiec nie musza jechac w pierwszej paczce
const ProjectAnalyticsPage = lazy(() => import('./pages/ProjectAnalyticsPage'))
const AdminProjectsPage = lazy(() => import('./pages/AdminProjectsPage'))
const AdminSanitizationRulesPage = lazy(() => import('./pages/AdminSanitizationRulesPage'))

function Loading() {
  return <p className="text-sm text-muted-foreground">Ładowanie widoku...</p>
}

function App() {
  return (
    <Routes>
      <Route path="login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route index element={<HomePage />} />
          <Route path="projects/:projectId/tickets" element={<TicketListPage />} />
          <Route path="projects/:projectId/tickets/:ticketId" element={<TicketDetailsPage />} />
          <Route
            path="projects/:projectId/analytics"
            element={
              <Suspense fallback={<Loading />}>
                <ProjectAnalyticsPage />
              </Suspense>
            }
          />
          <Route element={<RequireAdmin />}>
            <Route
              path="admin/projects"
              element={
                <Suspense fallback={<Loading />}>
                  <AdminProjectsPage />
                </Suspense>
              }
            />
            <Route
              path="admin/sanitization-rules"
              element={
                <Suspense fallback={<Loading />}>
                  <AdminSanitizationRulesPage />
                </Suspense>
              }
            />
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  )
}

export default App
