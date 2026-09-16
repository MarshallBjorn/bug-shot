import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useAuth } from './AuthContext'

describe('useAuth', () => {
  it('rzuca blad poza AuthProviderem', () => {
    expect(() => renderHook(() => useAuth())).toThrow(
      'useAuth wymaga AuthProvider wyżej w drzewie.',
    )
  })
})
