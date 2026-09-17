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

export interface PromptRequest {
  title: string
  description?: string
  label: string
  initialValue?: string
  confirmLabel?: string
  placeholder?: string
}

interface PromptDialogProps {
  request: PromptRequest | null
  busy?: boolean
  onCancel: () => void
  onConfirm: (value: string) => void
}

// zastepuje window.prompt, ktory nie da sie ostylowac, nie trzyma focusu i blokuje karte
function PromptDialog({ request, busy = false, onCancel, onConfirm }: PromptDialogProps) {
  const [value, setValue] = useState(request?.initialValue ?? '')
  const [shown, setShown] = useState(request)

  // pole nadaza za nowym pytaniem w trakcie renderu zamiast efektem, wiec nie ma dodatkowego przebiegu
  if (shown !== request) {
    setShown(request)
    setValue(request?.initialValue ?? '')
  }

  if (!request) {
    return null
  }

  function submit() {
    if (value.trim()) {
      onConfirm(value.trim())
    }
  }

  return (
    <Dialog open onOpenChange={(next) => !next && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{request.title}</DialogTitle>
          {request.description && <DialogDescription>{request.description}</DialogDescription>}
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="prompt-value">{request.label}</Label>
          <Input
            id="prompt-value"
            value={value}
            autoComplete="off"
            placeholder={request.placeholder}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                submit()
              }
            }}
          />
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onCancel}>
            Anuluj
          </Button>
          <Button type="button" disabled={busy || !value.trim()} onClick={submit}>
            {request.confirmLabel ?? 'Zapisz'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default PromptDialog
