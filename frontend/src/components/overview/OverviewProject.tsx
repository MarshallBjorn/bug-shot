import OverviewCard from './OverviewCard'

interface OverviewProjectProps {
  projectKey: string
  onOpenProject: () => void
}

function OverviewProject({ projectKey, onOpenProject }: OverviewProjectProps) {
  return (
    <OverviewCard
      label="Projekt"
      action={`Pokaż wszystkie zgłoszenia projektu ${projectKey}`}
      onClick={onOpenProject}
    >
      <span className="block truncate font-mono text-xs">{projectKey}</span>
    </OverviewCard>
  )
}

export default OverviewProject
