import type { FormEventHandler, ReactNode } from 'react'
import { Bug } from 'lucide-react'
import ThemeToggle from './ThemeToggle'

interface AuthScreenProps {
  title: string
  description?: ReactNode
  onSubmit?: FormEventHandler<HTMLFormElement>
  children: ReactNode
}

// ekrany przed zalogowaniem wygladaja jak logowanie zeby link z maila nie wygladal obco
function AuthScreen({ title, description, onSubmit, children }: AuthScreenProps) {
  return (
    <main className="relative flex min-h-svh items-center justify-center px-4 py-12">
      <div className="absolute top-2 right-3">
        <ThemeToggle />
      </div>
      <form className="w-full max-w-sm space-y-4 rounded-lg border bg-card p-6" onSubmit={onSubmit}>
        <div className="space-y-1">
          <p className="flex items-center gap-2 text-sm font-semibold tracking-tight">
            <Bug aria-hidden="true" className="size-4 text-primary" />
            Bug-shot
          </p>
          <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        {children}
      </form>
    </main>
  )
}

export default AuthScreen
