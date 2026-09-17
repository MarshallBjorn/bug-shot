import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import ConfirmDialog from '../components/ConfirmDialog'
import SanitizationRuleDialog from '../components/SanitizationRuleDialog'
import { getProjects } from '../api/projects'
import {
  createSanitizationRule,
  deleteSanitizationRule,
  getSanitizationRules,
  setSanitizationRuleEnabled,
  testSanitizationRule,
  updateSanitizationRule,
  type SanitizationRuleTestResult,
} from '../api/sanitizationRules'
import type { Project, SanitizationRule } from '../types'

interface RulesAnswer {
  filter: string | null
  rules: SanitizationRule[]
  error: string | null
}

// filtr null nie zgadza się z żadnym stringiem filtra więc pierwszy render wychodzi jako ładowanie
const noAnswer: RulesAnswer = { filter: null, rules: [], error: null }

function AdminSanitizationRulesPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [projectFilter, setProjectFilter] = useState('')

  const [answer, setAnswer] = useState<RulesAnswer>(noAnswer)
  const loading = answer.filter !== projectFilter
  const rules = loading ? [] : answer.rules
  const error = loading ? null : answer.error

  const [scopeProjectId, setScopeProjectId] = useState('')
  const [pattern, setPattern] = useState('')
  const [replacement, setReplacement] = useState('')
  const [sampleText, setSampleText] = useState('')
  const [testResult, setTestResult] = useState<SanitizationRuleTestResult | null>(null)
  const [testError, setTestError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [editing, setEditing] = useState<SanitizationRule | null>(null)
  const [removing, setRemoving] = useState<SanitizationRule | null>(null)
  const [testing, setTesting] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  useEffect(() => {
    getProjects().then(setProjects).catch(() => setProjects([]))
  }, [])

  useEffect(() => {
    const controller = new AbortController()

    getSanitizationRules(projectFilter || undefined, controller.signal)
      .then((items) => setAnswer({ filter: projectFilter, rules: items, error: null }))
      .catch((cause: Error) => {
        if (controller.signal.aborted) return
        setAnswer({ filter: projectFilter, rules: [], error: cause.message })
      })

    return () => controller.abort()
  }, [projectFilter])

  function projectName(projectId: string | null) {
    if (projectId === null) return 'Globalna'

    return projects.find((p) => p.id === projectId)?.name ?? projectId
  }

  async function handleTest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!pattern.trim() || testing) return

    setTesting(true)
    setTestError(null)
    setTestResult(null)

    try {
      const result = await testSanitizationRule(pattern, replacement, sampleText)
      setTestResult(result)
    } catch (cause) {
      setTestError((cause as Error).message)
    } finally {
      setTesting(false)
    }
  }

  async function handleCreate() {
    if (!pattern.trim() || creating) return

    setCreating(true)
    setCreateError(null)

    try {
      const rule = await createSanitizationRule(scopeProjectId || null, pattern, replacement)

      if (!projectFilter || rule.projectId === null || rule.projectId === projectFilter) {
        setAnswer((current) => ({ ...current, rules: [...current.rules, rule] }))
      }

      setPattern('')
      setReplacement('')
      setSampleText('')
      setTestResult(null)
    } catch (cause) {
      setCreateError((cause as Error).message)
    } finally {
      setCreating(false)
    }
  }

  // bledy akcji ida do komunikatu na stronie, bo window.alert blokuje karte i mija czytnik ekranu
  async function run(action: () => Promise<void>) {
    setActionError(null)

    try {
      await action()
    } catch (cause) {
      setActionError((cause as Error).message)
    }
  }

  async function handleToggle(rule: SanitizationRule) {
    await run(async () => {
      const updated = await setSanitizationRuleEnabled(rule.id, !rule.isEnabled)
      setAnswer((current) => ({
        ...current,
        rules: current.rules.map((r) => (r.id === rule.id ? updated : r)),
      }))
    })
  }

  async function confirmEdit(pattern: string, replacement: string) {
    const rule = editing

    if (!rule) return

    setEditing(null)

    await run(async () => {
      const updated = await updateSanitizationRule(rule.id, pattern, replacement)
      setAnswer((current) => ({
        ...current,
        rules: current.rules.map((r) => (r.id === rule.id ? updated : r)),
      }))
    })
  }

  async function confirmDelete() {
    const rule = removing

    if (!rule) return

    setRemoving(null)

    await run(async () => {
      await deleteSanitizationRule(rule.id)
      setAnswer((current) => ({ ...current, rules: current.rules.filter((r) => r.id !== rule.id) }))
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-semibold tracking-tight">Reguły sanityzacji</h2>
        <Link
          to="/admin/projects"
          className="ml-auto text-sm text-muted-foreground hover:text-foreground"
        >
          Zarządzanie projektami
        </Link>
      </div>

      <form className="space-y-3 rounded-lg border bg-card p-4" onSubmit={handleTest}>
        <label>
          <span>Zakres</span>
          <select value={scopeProjectId} onChange={(event) => setScopeProjectId(event.target.value)}>
            <option value="">Globalna</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Wzorzec (wyrażenie regularne)</span>
          <input
            value={pattern}
            onChange={(event) => setPattern(event.target.value)}
            disabled={testing || creating}
            required
          />
        </label>

        <label>
          <span>Zamiennik</span>
          <input
            value={replacement}
            onChange={(event) => setReplacement(event.target.value)}
            disabled={testing || creating}
          />
        </label>

        <label>
          <span>Przykładowy tekst</span>
          <textarea
            value={sampleText}
            onChange={(event) => setSampleText(event.target.value)}
            disabled={testing || creating}
          />
        </label>

        <div className="flex flex-wrap items-center gap-2">
          <button type="submit" disabled={testing || creating || !pattern.trim()}>
            {testing ? 'Testowanie...' : 'Testuj na tekście'}
          </button>

          <button
            type="button"
            onClick={handleCreate}
            disabled={testing || creating || !pattern.trim()}
          >
            {creating ? 'Zapisywanie...' : 'Zapisz regułę'}
          </button>
        </div>

        {testError && <span role="alert">{testError}</span>}
        {createError && <span role="alert">{createError}</span>}

        {testResult && (
          <p className="rounded-md border bg-muted px-3 py-2 font-mono text-xs break-all">
            Wynik: <strong>{testResult.result || '(pusty tekst)'}</strong>, dopasowań:{' '}
            {testResult.matchCount}
          </p>
        )}
      </form>

      <label className="flex flex-wrap items-center gap-2 text-sm">
        <span>Pokaż reguły dla projektu</span>
        <select value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)}>
          <option value="">Wszystkie</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
      </label>

      {error && (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          Nie udało się pobrać reguł. {error}
        </p>
      )}

      {actionError && (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {actionError}
        </p>
      )}

      {loading ? (
        <p>Ładowanie...</p>
      ) : rules.length === 0 ? (
        <p>Brak reguł.</p>
      ) : (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th>Zakres</th>
              <th>Wzorzec</th>
              <th>Zamiennik</th>
              <th>Włączona</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rules.map((rule) => (
              <tr key={rule.id}>
                <td>{projectName(rule.projectId)}</td>
                <td>
                  <code>{rule.pattern}</code>
                </td>
                <td>{rule.replacement}</td>
                <td>
                  <input
                    type="checkbox"
                    checked={rule.isEnabled}
                    onChange={() => handleToggle(rule)}
                    aria-label={rule.isEnabled ? 'Wyłącz regułę' : 'Włącz regułę'}
                  />
                </td>
                <td>
                  <button type="button" onClick={() => setEditing(rule)}>
                    Edytuj
                  </button>
                  <button type="button" onClick={() => setRemoving(rule)}>
                    Usuń
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <SanitizationRuleDialog
        rule={editing}
        onCancel={() => setEditing(null)}
        onConfirm={confirmEdit}
      />

      <ConfirmDialog
        request={
          removing
            ? {
                title: 'Usunąć tę regułę?',
                description: `Wzorzec ${removing.pattern} przestanie maskować dane w nowych zgłoszeniach. Już zapisane zgłoszenia zostają bez zmian.`,
                confirmLabel: 'Usuń regułę',
                destructive: true,
              }
            : null
        }
        onCancel={() => setRemoving(null)}
        onConfirm={confirmDelete}
      />
    </div>
  )
}

export default AdminSanitizationRulesPage
