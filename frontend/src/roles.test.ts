import { describe, expect, it } from 'vitest'
import { canManageProject, canWorkOnTickets, hasRole } from './roles'

describe('role w projekcie', () => {
  it('wyzsza rola zawiera nizsza', () => {
    expect(hasRole('Maintainer', 'Viewer')).toBe(true)
    expect(hasRole('Member', 'Maintainer')).toBe(false)
  })

  it('brak roli nie pozwala na nic', () => {
    expect(hasRole(null, 'Viewer')).toBe(false)
    expect(canWorkOnTickets(undefined)).toBe(false)
  })

  it('zgloszenia obrabia member a projekt zmienia maintainer', () => {
    expect(canWorkOnTickets('Viewer')).toBe(false)
    expect(canWorkOnTickets('Member')).toBe(true)
    expect(canManageProject('Member')).toBe(false)
    expect(canManageProject('Maintainer')).toBe(true)
  })
})
