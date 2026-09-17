import { useState } from 'react'
import { BookmarkPlus } from 'lucide-react'
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
import { saveFilter } from '../savedFilters'

interface SaveFilterDialogProps {
  projectId: string
  search: string
  onSaved?: () => void
}

function SaveFilterDialog({ projectId, search, onSaved }: SaveFilterDialogProps) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')

  function submit() {
    if (!name.trim()) {
      return
    }

    saveFilter(projectId, name, search)
    setName('')
    setOpen(false)
    onSaved?.()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <BookmarkPlus aria-hidden="true" />
          Zapisz filtr
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Zapisz obecny filtr</DialogTitle>
          <DialogDescription>
            Filtr pojawi się w panelu po lewej. Zapis trzyma się tej przeglądarki.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="save-filter-name">Nazwa</Label>
          <Input
            id="save-filter-name"
            value={name}
            placeholder="Nowe na koszyku"
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                submit()
              }
            }}
          />
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            Anuluj
          </Button>
          <Button type="button" disabled={!name.trim()} onClick={submit}>
            Zapisz
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default SaveFilterDialog
