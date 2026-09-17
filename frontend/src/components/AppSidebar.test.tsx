import React from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import AppSidebar from './AppSidebar'

vi.mock('react-router', () => ({
  NavLink: ({
    to,
    children,
    onClick,
  }: {
    to: string
    children: React.ReactNode
    onClick?: () => void
  }) => (
    <a href={to} onClick={onClick}>
      {children}
    </a>
  ),
}))

afterEach(() => {
  cleanup()
})

it('bez projektu pokazuje tylko sekcje administracyjna', () => {
  render(<AppSidebar projectId="" isAdmin />)

  expect(screen.queryByRole('link', { name: 'Zgłoszenia' })).toBeNull()
  expect(screen.getByRole('link', { name: 'Zarządzanie projektami' })).toBeDefined()
})

it('zwykly uzytkownik nie widzi administracji', () => {
  render(<AppSidebar projectId="p1" isAdmin={false} />)

  expect(screen.getByRole('link', { name: 'Zgłoszenia' })).toHaveProperty(
    'href',
    expect.stringContaining('/projects/p1/tickets'),
  )
  expect(screen.queryByRole('link', { name: 'Sanityzacja' })).toBeNull()
})

it('klik w pozycje zamyka wysuwana nawigacje', () => {
  const onNavigate = vi.fn()

  render(<AppSidebar projectId="p1" isAdmin onNavigate={onNavigate} />)

  fireEvent.click(screen.getByRole('link', { name: 'Analityka' }))

  expect(onNavigate).toHaveBeenCalledTimes(1)
})
