import type { ReactNode } from 'react'
import { cn } from 'cn'

interface FilterSelectProps {
  label: string
  value: string
  onChange: (value: string) => void
  className?: string
  children: ReactNode
}

// natywny select zamiast odpowiednika z Radixa: daje picker systemowy na telefonie
// i obsluge klawiatury bez naszego kodu, a dla jednokrotnego wyboru nie tracimy niczego
function FilterSelect({ label, value, onChange, className, children }: FilterSelectProps) {
  return (
    <label className={cn('flex flex-col gap-1', className)}>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 rounded-md border border-input bg-card px-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring"
      >
        {children}
      </select>
    </label>
  )
}

export default FilterSelect
