import React from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AppLayout from './AppLayout'
import { useAuth } from '../auth/AuthContext'

const navigate = vi.fn()
const logOut = vi.fn()

vi.mock('../auth/AuthContext', () => ({
  useAuth: vi.fn(),
}))

vi.mock('react-router', () => ({
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => (
    <a href={to}>{children}</a>
  ),
  Outlet: () => <div data-testid="outlet">Outlet</div>,
  useNavigate: () => navigate,
}))

const mockedUseAuth = vi.mocked(useAuth)

beforeEach(() => {
  vi.clearAllMocks()
  logOut.mockResolvedValue(undefined)
})

afterEach(() => {
  cleanup()
})

describe('AppLayout', () => {
  it('pokazuje uzytkownika i linki administracyjne dla admina', () => {
    mockedUseAuth.mockReturnValue({
      status: 'authenticated',
      user: {
        id: 'admin',
        email: 'admin@test.local',
        isAdmin: true,
        isActive: true,
      },
      logIn: vi.fn(),
      logOut,
    })

    render(<AppLayout />)

    expect(screen.getByText('Bug-shot')).toBeDefined()
    expect(screen.getByText('admin@test.local')).toBeDefined()
    expect(screen.getByRole('link', { name: 'Zarządzanie projektami' })).toBeDefined()
    expect(screen.getByRole('link', { name: 'Sanityzacja' })).toBeDefined()
    expect(screen.getByTestId('outlet')).toBeDefined()
  })

  it('ukrywa linki administracyjne dla zwyklego uzytkownika', () => {
    mockedUseAuth.mockReturnValue({
      status: 'authenticated',
      user: {
        id: 'user',
        email: 'user@test.local',
        isAdmin: false,
        isActive: true,
      },
      logIn: vi.fn(),
      logOut,
    })

    render(<AppLayout />)

    expect(screen.getByText('user@test.local')).toBeDefined()
    expect(screen.queryByRole('link', { name: 'Zarządzanie projektami' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Sanityzacja' })).toBeNull()
  })

  it('wylogowuje i przechodzi do logowania', async () => {
    mockedUseAuth.mockReturnValue({
      status: 'authenticated',
      user: {
        id: 'user',
        email: 'user@test.local',
        isAdmin: false,
        isActive: true,
      },
      logIn: vi.fn(),
      logOut,
    })

    render(<AppLayout />)

    fireEvent.click(screen.getByRole('button', { name: 'Wyloguj' }))

    await vi.waitFor(() => {
      expect(logOut).toHaveBeenCalledTimes(1)
      expect(navigate).toHaveBeenCalledWith('/login', { replace: true })
    })
  })
})


