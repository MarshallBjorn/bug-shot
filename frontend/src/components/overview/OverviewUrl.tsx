import OverviewCard from './OverviewCard'

interface OverviewUrlProps {
  pageUrl: string
  page: string
  onFilterByPage: (page: string) => void
}

function OverviewUrl({ pageUrl, page, onFilterByPage }: OverviewUrlProps) {
  return (
    <OverviewCard
      label="Adres strony"
      action={`Pokaż wszystkie zgłoszenia ze strony ${page}`}
      onClick={page ? () => onFilterByPage(page) : undefined}
    >
      <span className="block truncate font-mono text-xs" title={pageUrl}>
        {pageUrl || 'Adres został skasowany'}
      </span>
    </OverviewCard>
  )
}

export default OverviewUrl
