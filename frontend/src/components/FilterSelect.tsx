import { useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Check, ChevronDown, Search } from 'lucide-react'
import { cn } from 'cn'
import { fold } from '../fold'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export interface SelectOption {
  value: string
  label: string
}

interface FilterSelectProps {
  label: string
  value: string
  options: SelectOption[]
  onChange: (value: string) => void
  // dluga lista na przyklad projektow dostaje pole szukania
  searchable?: boolean
  className?: string
}

// Radix nie przyjmuje pustej wartosci pozycji a u nas pusta oznacza brak filtra
const emptyValue = '__empty__'

const triggerClass =
  'h-9 w-full justify-between gap-2 rounded-md border border-input bg-card px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring'

function FilterSelect({ label, value, options, onChange, searchable, className }: FilterSelectProps) {
  const labelId = useId()

  return (
    <div className={cn('flex min-w-0 flex-col gap-1', className)}>
      <span id={labelId} className="text-xs font-medium text-muted-foreground">
        {label}
      </span>
      {searchable ? (
        <SearchableSelect labelId={labelId} value={value} options={options} onChange={onChange} />
      ) : (
        <Select
          value={value || emptyValue}
          onValueChange={(next) => onChange(next === emptyValue ? '' : next)}
        >
          <SelectTrigger aria-labelledby={labelId} className={triggerClass}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper" className="max-h-72">
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value || emptyValue}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  )
}

interface SearchableSelectProps {
  labelId: string
  value: string
  options: SelectOption[]
  onChange: (value: string) => void
}

function SearchableSelect({ labelId, value, options, onChange }: SearchableSelectProps) {
  const listId = useId()
  const valueId = useId()
  const [open, setOpen] = useState(false)
  const [phrase, setPhrase] = useState('')
  const [active, setActive] = useState(0)
  // lista zamykana po wyborze trzyma stare pozycje do konca animacji
  // bo rodzic potrafi od razu usunac wybrana pozycje i mignelby pusty wynik
  const [closing, setClosing] = useState<SelectOption[] | null>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const shown = open ? options : (closing ?? options)

  const matches = useMemo(() => {
    const needle = fold(phrase.trim())

    return needle ? shown.filter((option) => fold(option.label).includes(needle)) : shown
  }, [shown, phrase])

  const selected = options.find((option) => option.value === value)

  function openChange(next: boolean) {
    setOpen(next)
    setClosing(null)
    setPhrase('')
    // lista startuje na wybranej pozycji zeby strzalki szly od niej
    setActive(Math.max(0, options.findIndex((option) => option.value === value)))
  }

  function pick(option: SelectOption) {
    setClosing(options)
    onChange(option.value)
    setOpen(false)
  }

  function moveTo(index: number) {
    setActive(index)
    listRef.current?.children[index]?.scrollIntoView?.({ block: 'nearest' })
  }

  function handleKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      moveTo(Math.min(matches.length - 1, active + 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      moveTo(Math.max(0, active - 1))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const option = matches[active]
      if (option) pick(option)
    }
  }

  return (
    <Popover open={open} onOpenChange={openChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          // czytnik ma uslyszec obok etykiety tez biezacy wybor
          aria-labelledby={`${labelId} ${valueId}`}
          aria-haspopup="listbox"
          aria-expanded={open}
          className={cn(triggerClass, 'flex items-center')}
        >
          <span id={valueId} className="truncate">
            {selected?.label ?? ''}
          </span>
          <ChevronDown aria-hidden="true" className="size-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-(--radix-popover-trigger-width) min-w-56 p-1">
        <div className="flex items-center gap-2 border-b px-2 pb-1">
          <Search aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
          <input
            role="combobox"
            aria-labelledby={labelId}
            aria-controls={listId}
            aria-expanded="true"
            aria-autocomplete="list"
            aria-activedescendant={matches[active] ? `${listId}-${active}` : undefined}
            value={phrase}
            placeholder="Szukaj..."
            className="h-8 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            onChange={(event) => {
              setPhrase(event.target.value)
              setActive(0)
            }}
            onKeyDown={handleKey}
          />
        </div>
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          aria-labelledby={labelId}
          className="max-h-64 overflow-y-auto pt-1"
        >
          {matches.map((option, index) => (
            <li
              key={option.value}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={option.value === value}
              className={cn(
                'relative flex cursor-default items-center rounded-sm py-1.5 pr-8 pl-2 text-sm select-none',
                index === active && 'bg-accent text-accent-foreground',
              )}
              onMouseMove={() => setActive(index)}
              onClick={() => pick(option)}
            >
              <span className="truncate">{option.label}</span>
              {option.value === value && (
                <Check aria-hidden="true" className="absolute right-2 size-4 text-muted-foreground" />
              )}
            </li>
          ))}
        </ul>
        {matches.length === 0 && (
          <p className="px-2 py-1.5 text-sm text-muted-foreground">Nic nie pasuje</p>
        )}
      </PopoverContent>
    </Popover>
  )
}

export default FilterSelect
