import { Route, Routes } from 'react-router'
import AppLayout from './components/AppLayout'
import HomePage from './pages/HomePage'
import NotFoundPage from './pages/NotFoundPage'
import TicketDetailsPage from './pages/TicketDetailsPage'
import TicketListPage from './pages/TicketListPage'

function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<HomePage />} />
        <Route path="projects/:projectId/tickets" element={<TicketListPage />} />
        <Route path="projects/:projectId/tickets/:ticketId" element={<TicketDetailsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}

export default App
