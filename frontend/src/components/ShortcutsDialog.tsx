import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const shortcuts: Array<[string, string]> = [
  ['j', 'Następne zgłoszenie'],
  ['k', 'Poprzednie zgłoszenie'],
  ['Enter', 'Otwórz podświetlone zgłoszenie'],
  ['/', 'Przejdź do szukania'],
  ['x', 'Zmień status podświetlonego zgłoszenia'],
  ['?', 'Ta pomoc'],
]

function ShortcutsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Skróty klawiszowe</DialogTitle>
          <DialogDescription>Działają na liście zgłoszeń, poza polami tekstowymi.</DialogDescription>
        </DialogHeader>

        <dl className="space-y-2 text-sm">
          {shortcuts.map(([key, description]) => (
            <div key={key} className="flex items-center gap-3">
              <dt className="w-16 shrink-0">
                <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-xs">{key}</kbd>
              </dt>
              <dd className="text-muted-foreground">{description}</dd>
            </div>
          ))}
        </dl>
      </DialogContent>
    </Dialog>
  )
}

export default ShortcutsDialog
