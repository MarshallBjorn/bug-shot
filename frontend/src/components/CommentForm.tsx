import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

interface CommentFormProps {
  author: string
  busy: boolean
  onSubmit: (body: string) => Promise<void> | void
}

// autor idzie z zalogowanego konta, wiec formularz go nie pyta
function CommentForm({ author, busy, onSubmit }: CommentFormProps) {
  const [body, setBody] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const trimmed = body.trim()

    if (!trimmed) {
      return
    }

    await onSubmit(trimmed)
    setBody('')
  }

  return (
    <form className="space-y-2" onSubmit={submit}>
      <Label htmlFor="comment-body">Komentarz jako {author}</Label>
      <textarea
        id="comment-body"
        value={body}
        rows={3}
        disabled={busy}
        placeholder="Co ustaliliście w tej sprawie"
        onChange={(event) => setBody(event.target.value)}
        className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm shadow-xs focus-visible:border-ring"
      />
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={busy || !body.trim()}>
          {busy ? 'Dodawanie...' : 'Dodaj komentarz'}
        </Button>
      </div>
    </form>
  )
}

export default CommentForm
