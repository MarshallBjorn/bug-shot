// filtry listy jadą do szczegółów w stanie trasy żeby powrót nie gubił kontekstu
export interface TicketListState {
  listSearch: string
}

// stan trasy przetrwa odświeżenie ale przy wklejonym linku go nie ma
export function readListSearch(state: unknown) {
  const candidate = state as Partial<TicketListState> | null

  return typeof candidate?.listSearch === 'string' ? candidate.listSearch : ''
}
