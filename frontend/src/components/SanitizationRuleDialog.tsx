import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { SanitizationRule } from '../types'

interface SanitizationRuleDialogProps {
  rule: SanitizationRule | null
  onCancel: () => void
  onConfirm: (pattern: string, replacement: string) => void
}

// wzorzec i zamiennik to jedna decyzja, wiec ida jednym dialogiem
// dwa osobne window.prompt kazaly podjac ja na dwa razy i bez widoku na calosc
function SanitizationRuleDialog({ rule, onCancel, onConfirm }: SanitizationRuleDialogProps) {
  const [pattern, setPattern] = useState(rule?.pattern ?? '')
  const [replacement, setReplacement] = useState(rule?.replacement ?? '')
  const [shown, setShown] = useState(rule)

  // pola nadazaja za nowa regula w trakcie renderu, bez dodatkowego przebiegu z efektu
  if (shown !== rule) {
    setShown(rule)
    setPattern(rule?.pattern ?? '')
    setReplacement(rule?.replacement ?? '')
  }

  if (!rule) {
    return null
  }

  return (
    <Dialog open onOpenChange={(next) => !next && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Zmień regułę</DialogTitle>
          <DialogDescription>
            Wzorzec jest wyrażeniem regularnym. Zamiennik wchodzi w miejsce trafienia.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="rule-pattern">Wzorzec</Label>
            <Input
              id="rule-pattern"
              value={pattern}
              autoComplete="off"
              className="font-mono"
              onChange={(event) => setPattern(event.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="rule-replacement">Zamiennik</Label>
            <Input
              id="rule-replacement"
              value={replacement}
              autoComplete="off"
              className="font-mono"
              onChange={(event) => setReplacement(event.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onCancel}>
            Anuluj
          </Button>
          <Button
            type="button"
            disabled={!pattern.trim()}
            onClick={() => onConfirm(pattern.trim(), replacement)}
          >
            Zapisz regułę
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default SanitizationRuleDialog
