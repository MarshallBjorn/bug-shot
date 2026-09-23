import { useEffect, useRef, useState, type RefObject } from 'react'
import { ChevronDown, Search, SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { formatStatus } from '../format'
import { browserOptions, deviceOptions, formatDevice, osOptions } from '../environmentOptions'
import { ticketSorts, ticketStatuses, type TicketQuery, type TicketSort } from '../ticketQuery'
import type { TicketStatus } from '../types'
import FilterSelect from './FilterSelect'

const sortLabels: Record<TicketSort, string> = {
  'receivedAt:desc': 'Przyjęte, od najnowszych',
  'receivedAt:asc': 'Przyjęte, od najstarszych',
  'reportedAt:desc': 'Zgłoszone, od najnowszych',
  'reportedAt:asc': 'Zgłoszone, od najstarszych',
}

interface TicketFiltersProps {
  query: TicketQuery
  onChange: (patch: Partial<TicketQuery>, replace?: boolean) => void
  // skrot / oddaje focus temu polu
  searchRef?: RefObject<HTMLInputElement | null>
}

// trzy stany zamiast pola wyboru bo filtr moze byc wylaczony, wlaczony albo odwrocony
function flagValue(flag: boolean | null) {
  return flag === null ? '' : String(flag)
}

function parseFlagValue(value: string): boolean | null {
  return value === '' ? null : value === 'true'
}

function TicketFilters({ query, onChange, searchRef }: TicketFiltersProps) {
  const [search, setSearch] = useState(query.search)
  const pushed = useRef(query.search)

  // adres moze zmienic sie poza polem na przyklad przy czyszczeniu filtrow
  useEffect(() => {
    if (query.search === pushed.current) return
    pushed.current = query.search
    setSearch(query.search)
  }, [query.search])

  // pole nadaza za pisaniem a adres dostaje zmiane dopiero po chwili bezczynnosci
  useEffect(() => {
    if (search === pushed.current) return

    const timer = setTimeout(() => {
      pushed.current = search
      onChange({ search }, true)
    }, 300)

    return () => clearTimeout(timer)
  }, [search, onChange])

  function toggleStatus(status: TicketStatus, checked: boolean) {
    const next = checked
      ? [...query.statuses, status]
      : query.statuses.filter((candidate) => candidate !== status)

    onChange({ statuses: next })
  }

  const extraCount = [
    query.browser,
    query.os,
    query.device,
    query.dateFrom,
    query.dateTo,
  ].filter(Boolean).length + [query.hasScreenshot, query.hasComments].filter((f) => f !== null).length

  return (
    <form
      className="flex flex-wrap items-end gap-2"
      role="search"
      onSubmit={(event) => event.preventDefault()}
    >
      <label className="relative flex min-w-56 flex-1 flex-col gap-1">
        <span className="text-xs font-medium text-muted-foreground">Szukaj</span>
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute bottom-2.5 left-2 size-4 text-muted-foreground"
        />
        <Input
          ref={searchRef}
          type="search"
          value={search}
          placeholder="Opis albo adres strony"
          className="bg-card pl-8"
          onChange={(event) => setSearch(event.target.value)}
        />
      </label>

      <Popover>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" className="bg-card">
            Status
            {query.statuses.length > 0 && (
              <span className="rounded bg-primary px-1.5 text-xs text-primary-foreground">
                {query.statuses.length}
              </span>
            )}
            <ChevronDown aria-hidden="true" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-56">
          <fieldset className="space-y-2">
            <legend className="mb-2 text-xs font-medium text-muted-foreground">
              Pokaż statusy
            </legend>
            {ticketStatuses.map((status) => (
              <label key={status} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={query.statuses.includes(status)}
                  onCheckedChange={(checked) => toggleStatus(status, checked === true)}
                />
                {formatStatus(status)}
              </label>
            ))}
          </fieldset>
        </PopoverContent>
      </Popover>

      <Popover>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" className="bg-card">
            <SlidersHorizontal aria-hidden="true" />
            Więcej filtrów
            {extraCount > 0 && (
              <span className="rounded bg-primary px-1.5 text-xs text-primary-foreground">
                {extraCount}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        {/* fokus na panelu a nie na pierwszym selekcie bo ten po kliknieciu mysza swieci obwodka */}
        <PopoverContent
          align="start"
          className="w-80 space-y-3"
          onOpenAutoFocus={(event) => {
            event.preventDefault()
            ;(event.currentTarget as HTMLElement).focus()
          }}
        >
          <FilterSelect
            label="Przeglądarka"
            value={query.browser}
            onChange={(browser) => onChange({ browser })}
          >
            <option value="">Wszystkie</option>
            {browserOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </FilterSelect>

          <div className="grid grid-cols-2 gap-3">
            <FilterSelect label="System" value={query.os} onChange={(os) => onChange({ os })}>
              <option value="">Wszystkie</option>
              {osOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </FilterSelect>

            <FilterSelect
              label="Urządzenie"
              value={query.device}
              onChange={(device) => onChange({ device })}
            >
              <option value="">Wszystkie</option>
              {deviceOptions.map((option) => (
                <option key={option} value={option}>
                  {formatDevice(option)}
                </option>
              ))}
            </FilterSelect>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FilterSelect
              label="Zrzut ekranu"
              value={flagValue(query.hasScreenshot)}
              onChange={(value) => onChange({ hasScreenshot: parseFlagValue(value) })}
            >
              <option value="">Bez znaczenia</option>
              <option value="true">Ze zrzutem</option>
              <option value="false">Bez zrzutu</option>
            </FilterSelect>

            <FilterSelect
              label="Komentarze"
              value={flagValue(query.hasComments)}
              onChange={(value) => onChange({ hasComments: parseFlagValue(value) })}
            >
              <option value="">Bez znaczenia</option>
              <option value="true">Skomentowane</option>
              <option value="false">Bez komentarzy</option>
            </FilterSelect>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">Zgłoszone od</span>
              <Input
                type="date"
                value={query.dateFrom}
                max={query.dateTo || undefined}
                onChange={(event) => onChange({ dateFrom: event.target.value })}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">Zgłoszone do</span>
              <Input
                type="date"
                value={query.dateTo}
                min={query.dateFrom || undefined}
                onChange={(event) => onChange({ dateTo: event.target.value })}
              />
            </label>
          </div>
        </PopoverContent>
      </Popover>

      <FilterSelect
        label="Sortowanie"
        value={query.sort}
        onChange={(sort) => onChange({ sort: sort as TicketSort })}
      >
        {ticketSorts.map((sort) => (
          <option key={sort} value={sort}>
            {sortLabels[sort]}
          </option>
        ))}
      </FilterSelect>
    </form>
  )
}

export default TicketFilters
