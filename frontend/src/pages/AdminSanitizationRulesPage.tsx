import { useEffect, useId, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import ConfirmDialog from '../components/ConfirmDialog'
import FilterSelect from '../components/FilterSelect'
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
  const fieldId = useId()
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
      <h2 className="text-xl font-semibold tracking-tight">Reguły sanityzacji</h2>

      <form className="space-y-3 rounded-lg border bg-card p-4" onSubmit={handleTest}>
        <div className="grid gap-3 sm:grid-cols-2">
          <FilterSelect label="Zakres" value={scopeProjectId} onChange={setScopeProjectId}>
            <option value="">Globalna</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </FilterSelect>

          <div className="space-y-1.5">
            <Label htmlFor={`${fieldId}-pattern`}>Wzorzec (wyrażenie regularne)</Label>
            <Input
              id={`${fieldId}-pattern`}
              value={pattern}
              onChange={(event) => setPattern(event.target.value)}
              className="font-mono"
              autoComplete="off"
              disabled={testing || creating}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`${fieldId}-replacement`}>Zamiennik</Label>
            <Input
              id={`${fieldId}-replacement`}
              value={replacement}
              onChange={(event) => setReplacement(event.target.value)}
              className="font-mono"
              autoComplete="off"
              disabled={testing || creating}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`${fieldId}-sample`}>Przykładowy tekst</Label>
            <textarea
              id={`${fieldId}-sample`}
              value={sampleText}
              onChange={(event) => setSampleText(event.target.value)}
              disabled={testing || creating}
              rows={3}
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 font-mono text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" variant="outline" disabled={testing || creating || !pattern.trim()}>
            {testing ? 'Testowanie...' : 'Testuj na tekście'}
          </Button>

          <Button
            type="button"
            onClick={handleCreate}
            disabled={testing || creating || !pattern.trim()}
          >
            {creating ? 'Zapisywanie...' : 'Zapisz regułę'}
          </Button>

          {testError && (
            <span role="alert" className="text-sm text-destructive">
              {testError}
            </span>
          )}
          {createError && (
            <span role="alert" className="text-sm text-destructive">
              {createError}
            </span>
          )}
        </div>

        {testResult && (
          <p className="rounded-md border bg-muted px-3 py-2 font-mono text-xs break-all">
            Wynik: <strong>{testResult.result || '(pusty tekst)'}</strong>, dopasowań:{' '}
            {testResult.matchCount}
          </p>
        )}
      </form>

      <FilterSelect
        label="Pokaż reguły dla projektu"
        value={projectFilter}
        onChange={setProjectFilter}
        className="sm:max-w-xs"
      >
        <option value="">Wszystkie</option>
        {projects.map((project) => (
          <option key={project.id} value={project.id}>
            {project.name}
          </option>
        ))}
      </FilterSelect>

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
        <p className="text-sm text-muted-foreground">Ładowanie...</p>
      ) : rules.length === 0 ? (
        <p className="text-sm text-muted-foreground">Brak reguł.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          {/* wzorce sa dlugie wiec na telefonie tabela przewija sie zamiast lamac na kilka znakow */}
          <table className="w-full min-w-3xl border-collapse text-sm">
            <thead>
              <tr className="border-b">
                <th scope="col" className="px-3 py-2 text-left font-medium text-muted-foreground">
                  Zakres
                </th>
                <th scope="col" className="px-3 py-2 text-left font-medium text-muted-foreground">
                  Wzorzec
                </th>
                <th scope="col" className="px-3 py-2 text-left font-medium text-muted-foreground">
                  Zamiennik
                </th>
                <th scope="col" className="px-3 py-2 text-left font-medium text-muted-foreground">
                  Włączona
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium text-muted-foreground">
                  Akcje
                </th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr key={rule.id} className="border-b last:border-0">
                  <td className="px-3 py-2 align-top whitespace-nowrap">
                    {projectName(rule.projectId)}
                  </td>
                  <td className="px-3 py-2 align-top">
                    <code className="font-mono text-xs break-all">{rule.pattern}</code>
                  </td>
                  <td className="px-3 py-2 align-top font-mono text-xs break-all">
                    {rule.replacement}
                  </td>
                  <td className="px-3 py-2 align-top">
                    <input
                      type="checkbox"
                      className="size-4 accent-primary"
                      checked={rule.isEnabled}
                      onChange={() => handleToggle(rule)}
                      aria-label={rule.isEnabled ? 'Wyłącz regułę' : 'Włącz regułę'}
                    />
                  </td>
                  <td className="px-3 py-2 align-top">
                    <span className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setEditing(rule)}
                      >
                        Edytuj
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setRemoving(rule)}
                      >
                        Usuń
                      </Button>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
