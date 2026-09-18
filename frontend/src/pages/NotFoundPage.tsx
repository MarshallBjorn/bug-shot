import { Link } from 'react-router'

function NotFoundPage() {
  return (
    <div className="space-y-3">
      <h2 className="text-xl font-semibold tracking-tight">Nie ma takiej strony</h2>
      <p className="text-sm text-muted-foreground">
        Adres jest błędny albo zgłoszenie zostało usunięte.
      </p>
      <Link to="/" className="inline-flex text-sm text-primary hover:underline">
        Wróć na start
      </Link>
    </div>
  )
}

export default NotFoundPage
