import { Navigate } from 'react-router'
import { defaultProjectId } from '../config'

function HomePage() {
  if (!defaultProjectId) {
    return <p>Ustaw VITE_PROJECT_ID żeby otworzyć listę zgłoszeń.</p>
  }

  return <Navigate to={`/projects/${defaultProjectId}/tickets`} replace />
}

export default HomePage
