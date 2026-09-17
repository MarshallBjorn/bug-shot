import React from 'react'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AdminSanitizationRulesPage from './AdminSanitizationRulesPage'
import {
  getProjects,
} from '../api/projects'
import {
  createSanitizationRule,
  deleteSanitizationRule,
  getSanitizationRules,
  setSanitizationRuleEnabled,
  testSanitizationRule,
  updateSanitizationRule,
} from '../api/sanitizationRules'

vi.mock('../api/projects', () => ({
  getProjects: vi.fn(),
}))

vi.mock('../api/sanitizationRules', () => ({
  createSanitizationRule: vi.fn(),
  deleteSanitizationRule: vi.fn(),
  getSanitizationRules: vi.fn(),
  setSanitizationRuleEnabled: vi.fn(),
  testSanitizationRule: vi.fn(),
  updateSanitizationRule: vi.fn(),
}))

vi.mock('react-router', () => ({
  Link: ({
    to,
    children,
  }: {
    to: string
    children: React.ReactNode
  }) => <a href={to}>{children}</a>,
}))

const mockedGetProjects = vi.mocked(getProjects)
const mockedGetRules = vi.mocked(getSanitizationRules)
const mockedCreate = vi.mocked(createSanitizationRule)
const mockedTest = vi.mocked(testSanitizationRule)
const mockedToggle = vi.mocked(setSanitizationRuleEnabled)
const mockedUpdate = vi.mocked(updateSanitizationRule)
const mockedDelete = vi.mocked(deleteSanitizationRule)

const project = {
  id: 'p1',
  name: 'Acme',
  key: 'ACME',
  createdAt: '2026-09-14T10:00:00Z',
  origins: [],
}

const rule = {
  id: 'r1',
  projectId: null,
  pattern: 'secret=\\w+',
  replacement: 'secret=***',
  isEnabled: true,
  createdAt: '2026-09-14T10:00:00Z',
}

beforeEach(() => {
  vi.clearAllMocks()

  mockedGetProjects.mockResolvedValue([project])
  mockedGetRules.mockResolvedValue([rule])

  mockedTest.mockResolvedValue({
    result: 'secret=***',
    matchCount: 1,
  })

  mockedCreate.mockResolvedValue({
    ...rule,
    id: 'r2',
    pattern: 'email=\\S+',
  })

  mockedToggle.mockResolvedValue({
    ...rule,
    isEnabled: false,
  })

  mockedUpdate.mockResolvedValue({
    ...rule,
    pattern: 'token=\\S+',
  })

  mockedDelete.mockResolvedValue(undefined)
})

afterEach(() => {
  cleanup()
})

describe('AdminSanitizationRulesPage', () => {
  it('laduje projekty i reguly', async () => {
    render(<AdminSanitizationRulesPage />)

    expect(await screen.findByText('secret=\\w+')).toBeDefined()
    expect(screen.getAllByText('Globalna').length).toBeGreaterThanOrEqual(2)
  })

  it('pokazuje pusty stan regul', async () => {
    mockedGetRules.mockResolvedValueOnce([])

    render(<AdminSanitizationRulesPage />)

    expect(await screen.findByText('Brak reguł.')).toBeDefined()
  })

  it('testuje regule', async () => {
    render(<AdminSanitizationRulesPage />)

    await screen.findByText('secret=\\w+')

    fireEvent.change(
      screen.getByLabelText('Wzorzec (wyrażenie regularne)'),
      { target: { value: 'secret=\\w+' } },
    )

    fireEvent.change(
      screen.getByLabelText('Zamiennik'),
      { target: { value: 'secret=***' } },
    )

    fireEvent.change(
      screen.getByLabelText('Przykładowy tekst'),
      { target: { value: 'secret=abc' } },
    )

    fireEvent.submit(
      screen.getByRole('button', { name: 'Testuj na tekście' }).closest('form')!,
    )

    await vi.waitFor(() => {
      expect(mockedTest).toHaveBeenCalledWith(
        'secret=\\w+',
        'secret=***',
        'secret=abc',
      )
    })

    expect(
      await screen.findByText(/Wynik:/),
    ).toBeDefined()
  })

  it('pokazuje blad testowania', async () => {
    mockedTest.mockRejectedValueOnce(
      new Error('Nieprawidłowy regex'),
    )

    render(<AdminSanitizationRulesPage />)
    await screen.findByText('secret=\\w+')

    fireEvent.change(
      screen.getByLabelText('Wzorzec (wyrażenie regularne)'),
      { target: { value: '[bad' } },
    )

    fireEvent.submit(
      screen.getByRole('button', { name: 'Testuj na tekście' }).closest('form')!,
    )

    expect(
      await screen.findByRole('alert'),
    ).toBeDefined()
  })

  it('zapisuje regule', async () => {
    render(<AdminSanitizationRulesPage />)
    await screen.findByText('secret=\\w+')

    fireEvent.change(
      screen.getByLabelText('Wzorzec (wyrażenie regularne)'),
      { target: { value: 'email=\\S+' } },
    )

    fireEvent.click(
      screen.getByRole('button', { name: 'Zapisz regułę' }),
    )

    await vi.waitFor(() => {
      expect(mockedCreate).toHaveBeenCalledWith(
        null,
        'email=\\S+',
        '',
      )
    })
  })

  it('przelacza, edytuje i usuwa regule', async () => {
    render(<AdminSanitizationRulesPage />)
    await screen.findByText('secret=\\w+')

    fireEvent.click(
      screen.getByRole('checkbox', { name: 'Wyłącz regułę' }),
    )

    await vi.waitFor(() => {
      expect(mockedToggle).toHaveBeenCalledWith('r1', false)
    })

    // wzorzec i zamiennik to jedna decyzja, wiec dialog pyta o oba naraz
    fireEvent.click(screen.getByRole('button', { name: 'Edytuj' }))

    const dialog = within(screen.getByRole('dialog'))

    expect(dialog.getByLabelText('Wzorzec')).toHaveProperty('value', 'secret=\\w+')

    fireEvent.change(dialog.getByLabelText('Wzorzec'), { target: { value: 'token=\\S+' } })
    fireEvent.change(dialog.getByLabelText('Zamiennik'), { target: { value: 'token=***' } })
    fireEvent.click(dialog.getByRole('button', { name: 'Zapisz regułę' }))

    await vi.waitFor(() => {
      expect(mockedUpdate).toHaveBeenCalledWith('r1', 'token=\\S+', 'token=***')
    })

    fireEvent.click(screen.getByRole('button', { name: 'Usuń' }))
    fireEvent.click(screen.getByRole('button', { name: 'Usuń regułę' }))

    await vi.waitFor(() => {
      expect(mockedDelete).toHaveBeenCalledWith('r1')
    })
  })

  it('blad akcji wychodzi komunikatem na stronie', async () => {
    mockedToggle.mockRejectedValueOnce(new Error('HTTP 409'))

    render(<AdminSanitizationRulesPage />)
    await screen.findByText('secret=\\w+')

    fireEvent.click(screen.getByRole('checkbox', { name: 'Wyłącz regułę' }))

    expect(await screen.findByText('HTTP 409')).toBeDefined()
  })
})





