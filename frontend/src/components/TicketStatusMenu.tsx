import type { ReactNode } from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { formatStatus } from '../format'
import { allowedStatusesFrom } from '../ticketTransitions'
import type { TicketStatus } from '../types'

interface TicketStatusMenuProps {
  status: TicketStatus
  open?: boolean
  onOpenChange?: (open: boolean) => void
  onPick: (status: TicketStatus) => void
  children: ReactNode
}

// menu pokazuje tylko legalne przejscia, a backend odrzuca kazde inne
function TicketStatusMenu({
  status,
  open,
  onOpenChange,
  onPick,
  children,
}: TicketStatusMenuProps) {
  const targets = allowedStatusesFrom(status)

  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          {targets.length > 0 ? `Z ${formatStatus(status)} przejdź do` : 'Brak przejść'}
        </DropdownMenuLabel>
        {targets.map((target) => (
          <DropdownMenuItem key={target} onSelect={() => onPick(target)}>
            {formatStatus(target)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default TicketStatusMenu
