import { createContext, useContext } from 'react'
import type { AuthenticatedUser } from '../types'

export type SessionStatus = 'checking' | 'authenticated' | 'anonymous'

export interface AuthValue {
  status: SessionStatus
  user: AuthenticatedUser | null
  logIn: (email: string, password: string) => Promise<void>
  logOut: () => Promise<void>
}

export const AuthContext = createContext<AuthValue | null>(null)

export function useAuth() {
  const value = useContext(AuthContext)

  if (!value) {
    throw new Error('useAuth wymaga AuthProvider wyżej w drzewie.')
  }

  return value
}
