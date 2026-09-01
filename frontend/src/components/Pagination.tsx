import { formatResultCount } from '../format'

interface PaginationProps {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
}

function Pagination({ page, pageSize, total, onPageChange }: PaginationProps) {
  const pageCount = Math.max(Math.ceil(total / pageSize), 1)

  return (
    <nav className="pagination" aria-label="Stronicowanie">
      <button type="button" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
        Poprzednia
      </button>

      <span aria-live="polite">
        Strona {page} z {pageCount}, {formatResultCount(total)}
      </span>

      <button type="button" disabled={page >= pageCount} onClick={() => onPageChange(page + 1)}>
        Następna
      </button>
    </nav>
  )
}

export default Pagination
