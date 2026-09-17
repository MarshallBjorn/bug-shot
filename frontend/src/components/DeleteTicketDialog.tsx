import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface DeleteTicketDialogProps {
  ticketId: string
  busy: boolean
  onConfirm: () => void
}

// kasowanie jest nieodwracalne i czysci opis, zalaczniki i komentarze,
// wiec potwierdzenie idzie przez przepisanie identyfikatora a nie zwykle tak albo nie
function DeleteTicketDialog({ ticketId, busy, onConfirm }: DeleteTicketDialogProps) {
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState('')

  const matches = typed.trim() === ticketId

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        setTyped('')
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" disabled={busy}>
          <Trash2 aria-hidden="true" />
          Usuń zgłoszenie
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Usunąć to zgłoszenie?</DialogTitle>
          <DialogDescription>
            Znikną opis, adres strony, komentarze i załączniki. Zostanie sam ślad, że zgłoszenie
            istniało. Tego nie da się cofnąć.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="delete-ticket-id">
            Przepisz identyfikator zgłoszenia, aby potwierdzić
          </Label>
          <code className="block rounded-md border bg-muted px-2 py-1 font-mono text-xs break-all">
            {ticketId}
          </code>
          <Input
            id="delete-ticket-id"
            value={typed}
            autoComplete="off"
            onChange={(event) => setTyped(event.target.value)}
          />
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            Anuluj
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={!matches || busy}
            onClick={() => {
              setOpen(false)
              onConfirm()
            }}
          >
            {busy ? 'Usuwanie...' : 'Usuń na zawsze'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default DeleteTicketDialog
