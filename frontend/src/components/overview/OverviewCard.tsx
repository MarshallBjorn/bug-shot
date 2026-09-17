import type { ReactNode } from 'react'
import { ArrowRight } from 'lucide-react'
import { cn } from 'cn'

interface OverviewCardProps {
  label: string
  action?: string
  onClick?: () => void
  className?: string
  children: ReactNode
}

// bloki metadanych sa zwarte i rowne, bo wartosc tresci jest tu podobna
// screenshot i logi maja wlasne komponenty o wiekszej wadze, wiec nie ida przez ten kafel
function OverviewCard({ label, action, onClick, className, children }: OverviewCardProps) {
  const content = (
    <>
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="min-w-0 text-sm">{children}</span>
    </>
  )

  if (!onClick) {
    return (
      <div className={cn('flex min-w-0 flex-col gap-0.5 px-3 py-2', className)}>{content}</div>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={action}
      className={cn(
        'group flex min-w-0 flex-col gap-0.5 px-3 py-2 text-left transition-colors hover:bg-accent',
        className,
      )}
    >
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        {label}
        <ArrowRight
          aria-hidden="true"
          className="size-3 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
        />
      </span>
      <span className="min-w-0 text-sm">{children}</span>
    </button>
  )
}

export default OverviewCard
