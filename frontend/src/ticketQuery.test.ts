import { describe, expect, it } from 'vitest'
import {
  defaultPageSize,
  defaultSort,
  isFiltered,
  parseTicketQuery,
  ticketQueryToParams,
} from './ticketQuery'

describe('parseTicketQuery', () => {
  it('zwraca wartości domyślne dla pustych parametrów', () => {
    expect(parseTicketQuery(new URLSearchParams())).toEqual({
      status: null,
      search: '',
      sort: defaultSort,
      page: 1,
      pageSize: defaultPageSize,
    })
  })

  it('parsuje poprawne wartości', () => {
    expect(
      parseTicketQuery(
        new URLSearchParams(
          'status=Resolved&search=%20bug%20&sort=reportedAt%3Aasc&page=3&pageSize=50',
        ),
      ),
    ).toEqual({
      status: 'Resolved',
      search: 'bug',
      sort: 'reportedAt:asc',
      page: 3,
      pageSize: 50,
    })
  })

  it('odrzuca niepoprawny status i sortowanie', () => {
    expect(
      parseTicketQuery(
        new URLSearchParams('status=Unknown&sort=invalid'),
      ),
    ).toEqual({
      status: null,
      search: '',
      sort: defaultSort,
      page: 1,
      pageSize: defaultPageSize,
    })
  })

  it('odrzuca niepoprawne numery stron', () => {
    expect(
      parseTicketQuery(
        new URLSearchParams('page=0&pageSize=-5'),
      ),
    ).toEqual({
      status: null,
      search: '',
      sort: defaultSort,
      page: 1,
      pageSize: defaultPageSize,
    })
  })

  it('ogranicza pageSize do 100', () => {
    expect(
      parseTicketQuery(new URLSearchParams('pageSize=500')).pageSize,
    ).toBe(100)
  })

  it('odrzuca liczby niecałkowite', () => {
    expect(
      parseTicketQuery(
        new URLSearchParams('page=2.5&pageSize=10.5'),
      ),
    ).toEqual({
      status: null,
      search: '',
      sort: defaultSort,
      page: 1,
      pageSize: defaultPageSize,
    })
  })
})

describe('isFiltered', () => {
  it('rozpoznaje filtr statusu', () => {
    const query = parseTicketQuery(new URLSearchParams('status=Resolved'))
    expect(isFiltered(query)).toBe(true)
  })

  it('rozpoznaje filtr wyszukiwania', () => {
    const query = parseTicketQuery(new URLSearchParams('search=bug'))
    expect(isFiltered(query)).toBe(true)
  })

  it('nie uznaje samego sortowania i paginacji za filtr', () => {
    const query = parseTicketQuery(
      new URLSearchParams('sort=reportedAt:asc&page=2&pageSize=50'),
    )
    expect(isFiltered(query)).toBe(false)
  })
})

describe('ticketQueryToParams', () => {
  it('pomija wartości domyślne', () => {
    expect(
      ticketQueryToParams({
        status: null,
        search: '',
        sort: defaultSort,
        page: 1,
        pageSize: defaultPageSize,
      }).toString(),
    ).toBe('')
  })

  it('serializuje wszystkie niestandardowe wartości', () => {
    expect(
      ticketQueryToParams({
        status: 'Resolved',
        search: 'login bug',
        sort: 'reportedAt:asc',
        page: 3,
        pageSize: 50,
      }).toString(),
    ).toBe(
      'status=Resolved&search=login+bug&sort=reportedAt%3Aasc&page=3&pageSize=50',
    )
  })
})
