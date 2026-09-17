import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import SidebarProject from './SidebarProject'
import { useProjectPages } from '../hooks/useProjectPages'
import { removeSavedFilter, savedFiltersSnapshot } from '../savedFilters'

const navigate = vi.fn()
const routerState = { pathname: '/projects/p1/tickets', search: '' }

vi.mock('react-router', () => ({
  useNavigate: () => navigate,
  useLocation: () => routerState,
  useSearchParams: () => [new URLSearchParams(routerState.search)],
}))

vi.mock('../hooks/useProjectPages', () => ({
  useProjectPages: vi.fn(),
}))

vi.mock('../savedFilters', () => ({
  savedFiltersSnapshot: vi.fn(),
  subscribeSavedFilters: () => () => {},
  removeSavedFilter: vi.fn(),
}))

vi.mock('./PagesTree', () => ({
  default: ({
    selected,
    onSelect,
  }: {
    selected: string
    onSelect: (page: string, status: string | null) => void
  }) => (
    <div>
      <span data-testid="selected">{selected}</span>
      <button type="button" onClick={() => onSelect('acme.example/cart', null)}>
        Wybierz strone
      </button>
      <button type="button" onClick={() => onSelect('acme.example/cart', 'New')}>
        Wybierz strone ze statusem
      </button>
    </div>
  ),
}))

beforeEach(() => {
  vi.clearAllMocks()
  routerState.pathname = '/projects/p1/tickets'
  routerState.search = ''
  vi.mocked(useProjectPages).mockReturnValue({ pages: [], loading: false, error: null })
  vi.mocked(savedFiltersSnapshot).mockReturnValue([])
})

afterEach(() => {
  cleanup()
})

describe('sekcja projektu w panelu bocznym', () => {
  it('klik w strone ustawia filtr i aktualizuje adres', () => {
    render(<SidebarProject projectId="p1" />)

    fireEvent.click(screen.getByRole('button', { name: 'Wybierz strone' }))

    expect(navigate).toHaveBeenCalledWith({
      pathname: '/projects/p1/tickets',
      search: 'page=acme.example%2Fcart',
    })
  })

  it('klik w status dokłada go do filtra strony', () => {
    render(<SidebarProject projectId="p1" />)

    fireEvent.click(screen.getByRole('button', { name: 'Wybierz strone ze statusem' }))

    expect(navigate).toHaveBeenCalledWith({
      pathname: '/projects/p1/tickets',
      search: 'status=New&page=acme.example%2Fcart',
    })
  })

  // na liscie filtry zostaja, bo uzytkownik zaweza to co juz widzi
  it('na liscie zachowuje pozostale filtry', () => {
    routerState.search = 'search=koszyk'

    render(<SidebarProject projectId="p1" />)

    fireEvent.click(screen.getByRole('button', { name: 'Wybierz strone' }))

    expect(navigate).toHaveBeenCalledWith({
      pathname: '/projects/p1/tickets',
      search: 'search=koszyk&page=acme.example%2Fcart',
    })
  })

  // na detalu w adresie nie ma filtrow listy wiec zaczynamy od czystego zapytania
  it('poza lista zaczyna od czystego zapytania', () => {
    routerState.pathname = '/projects/p1/tickets/t1'
    routerState.search = 'cokolwiek=1'

    render(<SidebarProject projectId="p1" />)

    fireEvent.click(screen.getByRole('button', { name: 'Wybierz strone' }))

    expect(navigate).toHaveBeenCalledWith({
      pathname: '/projects/p1/tickets',
      search: 'page=acme.example%2Fcart',
    })
  })

  it('wybrana strona idzie z adresu tylko na liscie', () => {
    routerState.search = 'page=acme.example%2Fcart'

    render(<SidebarProject projectId="p1" />)

    expect(screen.getByTestId('selected').textContent).toBe('acme.example/cart')
  })

  it('zapisany filtr prowadzi pod swoj adres', () => {
    vi.mocked(savedFiltersSnapshot).mockReturnValue([{ name: 'Nowe', search: 'status=New' }])

    render(<SidebarProject projectId="p1" />)

    fireEvent.click(screen.getByRole('button', { name: 'Nowe' }))

    expect(navigate).toHaveBeenCalledWith({
      pathname: '/projects/p1/tickets',
      search: 'status=New',
    })
  })

  it('usuniecie zapisanego filtra zdejmuje go z listy', () => {
    vi.mocked(savedFiltersSnapshot).mockReturnValue([{ name: 'Nowe', search: 'status=New' }])
    vi.mocked(removeSavedFilter).mockReturnValue([])

    render(<SidebarProject projectId="p1" />)

    fireEvent.click(screen.getByRole('button', { name: 'Usuń zapisany filtr Nowe' }))

    expect(removeSavedFilter).toHaveBeenCalledWith('p1', 'Nowe')
  })
})
