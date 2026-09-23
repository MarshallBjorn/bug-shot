import type { ProjectRole } from './types'

const rank: Record<ProjectRole, number> = { Viewer: 0, Member: 1, Maintainer: 2 }

export const roleLabels: Record<ProjectRole, string> = {
  Viewer: 'Tylko odczyt',
  Member: 'Obsługa zgłoszeń',
  Maintainer: 'Zarządzanie projektem',
}

export const roleDescriptions: Record<ProjectRole, string> = {
  Viewer: 'Przegląda zgłoszenia, komentarze i analitykę.',
  Member: 'Zmienia statusy, komentuje i kasuje zgłoszenia.',
  Maintainer: 'Do tego zmienia nazwę projektu, originy i powiadomienia.',
}

export function hasRole(role: ProjectRole | null | undefined, minimum: ProjectRole) {
  return role != null && rank[role] >= rank[minimum]
}

// status komentarze i kasowanie
export function canWorkOnTickets(role: ProjectRole | null | undefined) {
  return hasRole(role, 'Member')
}

export function canManageProject(role: ProjectRole | null | undefined) {
  return hasRole(role, 'Maintainer')
}
