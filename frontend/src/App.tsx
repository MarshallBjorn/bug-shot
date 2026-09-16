import { Route, Routes } from 'react-router'
import AppLayout from './components/AppLayout'
import RequireAdmin from './components/RequireAdmin'
import RequireAuth from './components/RequireAuth'
import AdminProjectNotificationsPage from './pages/AdminProjectNotificationsPage'
import AdminProjectsPage from './pages/AdminProjectsPage'
import AdminSanitizationRulesPage from './pages/AdminSanitizationRulesPage'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import NotFoundPage from './pages/NotFoundPage'
import ProjectAnalyticsPage from './pages/ProjectAnalyticsPage'
import TicketDetailsPage from './pages/TicketDetailsPage'
import TicketListPage from './pages/TicketListPage'

function App() {
  return (
    <Routes>
      <Route path="login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route index element={<HomePage />} />
          <Route path="projects/:projectId/tickets" element={<TicketListPage />} />
          <Route path="projects/:projectId/tickets/:ticketId" element={<TicketDetailsPage />} />
          <Route path="projects/:projectId/analytics" element={<ProjectAnalyticsPage />} />
          <Route element={<RequireAdmin />}>
            <Route path="admin/projects" element={<AdminProjectsPage />} />
            <Route path="admin/projects/:projectId/notifications" element={<AdminProjectNotificationsPage />} />
            <Route path="admin/sanitization-rules" element={<AdminSanitizationRulesPage />} />
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  )
}

export default App

