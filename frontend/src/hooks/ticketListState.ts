import type { TicketEvent } from '../live/ticketEvents'
import { defaultSort, matchesQuery, type TicketQuery } from '../ticketQuery'
import type { CursorPage, TicketListItem } from '../types'

export interface TicketListState {
  items: TicketListItem[]
  nextCursor: string | null
  // ile zgłoszeń pasuje do filtra, null gdy backend nie podał liczby
  total: number | null
  loading: boolean
  loadingMore: boolean
  error: string | null
}

export const initialTicketListState: TicketListState = {
  items: [],
  nextCursor: null,
  total: null,
  loading: true,
  loadingMore: false,
  error: null,
}

export type TicketListAction =
  | { type: 'restart'; keepItems: boolean }
  | { type: 'loadingMore' }
  | { type: 'loaded'; page: CursorPage<TicketListItem>; append: boolean }
  | { type: 'failed'; message: string }
  | { type: 'live'; event: TicketEvent; query: TicketQuery }

export function ticketListReducer(
  state: TicketListState,
  action: TicketListAction,
): TicketListState {
  switch (action.type) {
    case 'restart':
      // wyniki poprzedniego filtra zostają na ekranie żeby tabela nie mrugała
      // ale wyniki innego projektu już nie
      return action.keepItems
        ? { ...initialTicketListState, items: state.items, total: state.total }
        : initialTicketListState

    case 'loadingMore':
      return { ...state, loadingMore: true }

    case 'loaded':
      return {
        items: action.append ? append(state.items, action.page.items) : action.page.items,
        nextCursor: action.page.nextCursor,
        // kolejne strony nie niosą licznika więc zostaje ten z wejścia w listę
        total: action.append ? state.total : action.page.total,
        loading: false,
        loadingMore: false,
        error: null,
      }

    case 'failed':
      return { ...state, loading: false, loadingMore: false, error: action.message }

    case 'live':
      return applyEvent(state, action.event, action.query)
  }
}

// kolejna strona nie powinna powtórzyć wiersza, który wskoczył na listę kanałem live
function append(items: TicketListItem[], next: TicketListItem[]) {
  const known = new Set(items.map((item) => item.id))

  return [...items, ...next.filter((item) => !known.has(item.id))]
}

function applyEvent(
  state: TicketListState,
  event: TicketEvent,
  query: TicketQuery,
): TicketListState {
  if (event.type === 'deleted') {
    return withItems(
      state,
      state.items.filter((item) => item.id !== event.ticketId),
    )
  }

  const position = state.items.findIndex((item) => item.id === event.ticket.id)

  if (event.type === 'created') {
    // nowe zgłoszenie na pewno należy na górę tylko przy domyślnym sortowaniu
    // przy pozostałych trafi na listę dopiero przy doładowaniu
    if (query.sort !== defaultSort || position !== -1 || !matchesQuery(event.ticket, query)) {
      return state
    }

    return withItems(state, [event.ticket, ...state.items])
  }

  // wiersza spoza załadowanego kawałka listy nie ma gdzie wstawić bo nie znamy jego miejsca
  if (position === -1) {
    return state
  }

  // zmiana statusu potrafi wypchnąć zgłoszenie poza aktywny filtr
  if (!matchesQuery(event.ticket, query)) {
    return withItems(
      state,
      state.items.filter((item) => item.id !== event.ticket.id),
    )
  }

  const items = [...state.items]
  items[position] = event.ticket

  return { ...state, items }
}

// licznik idzie za tym samym zdarzeniem co lista, więc wiersz dołożony kanałem podnosi go o jeden
// a zdjęty obniża. Zgłoszenia spoza załadowanego kawałka listy nie widzimy, więc licznik może
// się rozjechać do najbliższej zmiany filtra
function withItems(state: TicketListState, items: TicketListItem[]): TicketListState {
  if (items.length === state.items.length) {
    return state
  }

  return {
    ...state,
    items,
    total: state.total === null ? null : state.total + items.length - state.items.length,
  }
}
