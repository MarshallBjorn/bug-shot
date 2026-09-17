import { ChartColumn, Inbox, ShieldCheck, SlidersHorizontal } from 'lucide-react'
import { NavLink } from 'react-router'
import type { ReactNode } from 'react'

interface AppSidebarProps {
  projectId: string
  isAdmin: boolean
  onNavigate?: () => void
}

function Item({
  to,
  icon,
  onNavigate,
  children,
}: {
  to: string
  icon: ReactNode
  onNavigate?: () => void
  children: ReactNode
}) {
  return (
    <NavLink
      to={to}
      end
      onClick={onNavigate}
      className={({ isActive }) =>
        [
          'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
          isActive
            ? 'bg-accent text-accent-foreground font-medium'
            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
        ].join(' ')
      }
    >
      <span aria-hidden="true" className="[&>svg]:size-4 shrink-0">
        {icon}
      </span>
      <span className="truncate">{children}</span>
    </NavLink>
  )
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="px-2 text-xs font-medium text-muted-foreground">{label}</p>
      {children}
    </div>
  )
}

function AppSidebar({ projectId, isAdmin, onNavigate }: AppSidebarProps) {
  return (
    <nav aria-label="Nawigacja panelu" className="flex flex-col gap-5 p-3">
      {projectId && (
        <Section label="Projekt">
          <Item to={`/projects/${projectId}/tickets`} icon={<Inbox />} onNavigate={onNavigate}>
            Zgłoszenia
          </Item>
          <Item to={`/projects/${projectId}/analytics`} icon={<ChartColumn />} onNavigate={onNavigate}>
            Analityka
          </Item>
        </Section>
      )}

      {isAdmin && (
        <Section label="Administracja">
          <Item to="/admin/projects" icon={<ShieldCheck />} onNavigate={onNavigate}>
            Zarządzanie projektami
          </Item>
          <Item to="/admin/sanitization-rules" icon={<SlidersHorizontal />} onNavigate={onNavigate}>
            Sanityzacja
          </Item>
        </Section>
      )}
    </nav>
  )
}

export default AppSidebar
