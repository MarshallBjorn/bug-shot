import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router'
import AppLayout from './components/AppLayout'
import RequireAdmin from './components/RequireAdmin'
import RequireAuth from './components/RequireAuth'
import RequireProjectManager from './components/RequireProjectManager'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import NotFoundPage from './pages/NotFoundPage'
import SetPasswordPage from './pages/SetPasswordPage'
import TicketDetailsPage from './pages/TicketDetailsPage'
import TicketListPage from './pages/TicketListPage'

// analityka i ekrany administracyjne wchodzi sie rzadko, wiec nie musza jechac w pierwszej paczce
const ProjectAnalyticsPage = lazy(() => import('./pages/ProjectAnalyticsPage'))
const AdminProjectsPage = lazy(() => import('./pages/AdminProjectsPage'))
const AdminSanitizationRulesPage = lazy(() => import('./pages/AdminSanitizationRulesPage'))
const AdminProjectNotificationsPage = lazy(() => import('./pages/AdminProjectNotificationsPage'))
const AdminUsersPage = lazy(() => import('./pages/AdminUsersPage'))
const AccountPage = lazy(() => import('./pages/AccountPage'))
// kreator widzi tylko ten kto stawia instancje, raz w jej zyciu
const SetupPage = lazy(() => import('./pages/SetupPage'))

function Loading() {
  return <p className="text-sm text-muted-foreground">Ładowanie widoku...</p>
}

function App() {
  return (
    <Routes>
      <Route path="login" element={<LoginPage />} />
      <Route
        path="setup"
        element={
          <Suspense fallback={<Loading />}>
            <SetupPage />
          </Suspense>
        }
      />
      <Route path="set-password" element={<SetPasswordPage />} />
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
          <Route
            path="account"
            element={
              <Suspense fallback={<Loading />}>
                <AccountPage />
              </Suspense>
            }
          />
          <Route element={<RequireProjectManager />}>
            <Route
              path="admin/projects"
              element={
                <Suspense fallback={<Loading />}>
                  <AdminProjectsPage />
                </Suspense>
              }
            />
            <Route
              path="admin/projects/:projectId/notifications"
              element={
                <Suspense fallback={<Loading />}>
                  <AdminProjectNotificationsPage />
                </Suspense>
              }
            />
          </Route>
          <Route element={<RequireAdmin />}>
            <Route
              path="admin/users"
              element={
                <Suspense fallback={<Loading />}>
                  <AdminUsersPage />
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

