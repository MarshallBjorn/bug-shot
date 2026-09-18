import { useState } from 'react'
import { Link, Outlet, useMatch, useNavigate, useParams } from 'react-router'
import { Bug, Keyboard, PanelLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { useAuth } from '../auth/AuthContext'
import { hasSidebarItems } from '../navigation'
import AppSidebar from './AppSidebar'
import ShortcutsDialog from './ShortcutsDialog'
import ThemeToggle from './ThemeToggle'

function AppLayout() {
  const { user, logOut } = useAuth()
  const { projectId = '' } = useParams()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  // skroty dzialaja tylko na liscie zgloszen wiec tylko tam je podpowiadamy
  const onTicketList = useMatch('/projects/:projectId/tickets') !== null
  const isAdmin = Boolean(user?.isAdmin)
  const withSidebar = hasSidebarItems(projectId, isAdmin)

  async function leave() {
    await logOut()
    navigate('/login', { replace: true })
  }

  function sidebar(onNavigate?: () => void) {
    return <AppSidebar projectId={projectId} isAdmin={isAdmin} onNavigate={onNavigate} />
  }

  return (
    <div className="min-h-svh">
      <header className="sticky top-0 z-30 flex h-12 items-center gap-2 border-b bg-card px-3">
        {withSidebar && (
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
        )}

        <Link
          to="/"
          className="flex shrink-0 items-center gap-2 font-semibold tracking-tight whitespace-nowrap"
        >
          <Bug aria-hidden="true" className="size-4 text-primary" />
          Bug-shot
        </Link>

        <div className="ml-auto flex items-center gap-2">
          {onTicketList && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Skróty klawiszowe"
              title="Skróty klawiszowe (?)"
              onClick={() => setHelpOpen(true)}
            >
              <Keyboard aria-hidden="true" />
            </Button>
          )}
          <ThemeToggle />
          {/* na waskim ekranie adres konta ustepuje miejsca przyciskowi wylogowania */}
          <span className="hidden truncate text-sm text-muted-foreground sm:inline">
            {user?.email}
          </span>
          <Button type="button" variant="outline" size="sm" onClick={leave}>
            Wyloguj
          </Button>
        </div>
      </header>

      {/* wysokosc wiersza z okna a nie z tresci, inaczej kreska przy belce urywa sie w polowie ekranu */}
      <div
        className={
          withSidebar
            ? 'min-h-[calc(100svh-3rem)] md:grid md:grid-cols-[15rem_minmax(0,1fr)]'
            : 'min-h-[calc(100svh-3rem)]'
        }
      >
        {withSidebar && (
          <aside className="hidden border-r md:block">
            <div className="sticky top-12">{sidebar()}</div>
          </aside>
        )}
        <main className="min-w-0 px-4 py-5">
          <Outlet />
        </main>
      </div>

      <ShortcutsDialog open={helpOpen} onOpenChange={setHelpOpen} />
    </div>
  )
}

export default AppLayout
