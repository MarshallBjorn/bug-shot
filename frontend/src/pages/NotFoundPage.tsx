import { Link } from 'react-router'

function NotFoundPage() {
  return (
    <>
      <h2>Nie ma takiej strony</h2>
      <Link to="/">Wróć na start</Link>
    </>
  )
}

export default NotFoundPage
