import { useState } from 'react'
import { Link, Outlet, useNavigate, useParams } from 'react-router'
import { Bug, PanelLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { useAuth } from '../auth/AuthContext'
import AppSidebar from './AppSidebar'
import ThemeToggle from './ThemeToggle'

function AppLayout() {
  const { user, logOut } = useAuth()
  const { projectId = '' } = useParams()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  async function leave() {
    await logOut()
    navigate('/login', { replace: true })
  }

  function sidebar(onNavigate?: () => void) {
    return (
      <AppSidebar projectId={projectId} isAdmin={Boolean(user?.isAdmin)} onNavigate={onNavigate} />
    )
  }

  return (
    <div className="min-h-svh">
      <header className="sticky top-0 z-30 flex h-12 items-center gap-2 border-b bg-card px-3">
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger asChild>
            <Button type="button" variant="ghost" size="icon" className="md:hidden" aria-label="Otwórz nawigację">
              <PanelLeft aria-hidden="true" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-60 p-0">
            <SheetTitle className="px-3 pt-3 text-sm">Nawigacja</SheetTitle>
            {sidebar(() => setMenuOpen(false))}
          </SheetContent>
        </Sheet>

        <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <Bug aria-hidden="true" className="size-4 text-primary" />
          Bug-shot
        </Link>

        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          <span className="max-w-[14ch] truncate text-sm text-muted-foreground sm:max-w-none">
            {user?.email}
          </span>
          <Button type="button" variant="outline" size="sm" onClick={leave}>
            Wyloguj
          </Button>
        </div>
      </header>

      <div className="md:grid md:grid-cols-[15rem_minmax(0,1fr)]">
        <aside className="hidden border-r md:block">
          <div className="sticky top-12">{sidebar()}</div>
        </aside>
        <main className="min-w-0 px-4 py-5">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default AppLayout
