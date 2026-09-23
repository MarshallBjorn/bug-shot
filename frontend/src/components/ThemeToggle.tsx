import { Monitor, Moon, Sun } from 'lucide-react'
import type { ComponentType } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useTheme, type ThemeMode } from '../theme/ThemeContext'

const modes: Array<{ mode: ThemeMode; label: string; icon: ComponentType<{ className?: string }> }> = [
  { mode: 'light', label: 'Jasny', icon: Sun },
  { mode: 'dark', label: 'Ciemny', icon: Moon },
  { mode: 'system', label: 'Systemowy', icon: Monitor },
]

function ThemeToggle() {
  const { mode, theme, setMode } = useTheme()
  const current = modes.find((item) => item.mode === mode) ?? modes[2]
  // w trybie systemowym ikona pokazuje monitor, w pozostalych kolor ktory jest wlaczony
  const Icon = mode === 'system' ? Monitor : theme === 'dark' ? Moon : Sun

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="icon" aria-label={`Motyw: ${current.label}`}>
          <Icon aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuRadioGroup value={mode} onValueChange={(next) => setMode(next as ThemeMode)}>
          {modes.map((item) => (
            <DropdownMenuRadioItem key={item.mode} value={item.mode}>
              <item.icon aria-hidden="true" className="size-4" />
              {item.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default ThemeToggle
