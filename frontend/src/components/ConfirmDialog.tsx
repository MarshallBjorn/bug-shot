import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export interface ConfirmRequest {
  title: string
  description: string
  confirmLabel?: string
  destructive?: boolean
}

interface ConfirmDialogProps {
  request: ConfirmRequest | null
  busy?: boolean
  onCancel: () => void
  onConfirm: () => void
}

function ConfirmDialog({ request, busy = false, onCancel, onConfirm }: ConfirmDialogProps) {
  if (!request) {
    return null
  }

  return (
    <Dialog open onOpenChange={(next) => !next && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{request.title}</DialogTitle>
          <DialogDescription>{request.description}</DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onCancel}>
            Anuluj
          </Button>
          <Button
            type="button"
            variant={request.destructive ? 'destructive' : 'default'}
            disabled={busy}
            onClick={onConfirm}
          >
            {request.confirmLabel ?? 'Potwierdź'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default ConfirmDialog
