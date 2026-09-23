import { useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { AccountLinkResult } from '../types'

export interface LinkNotice extends AccountLinkResult {
  email: string
  kind: 'invitation' | 'reset'
}

interface AccountLinkNoticeProps {
  notice: LinkNotice
  onDismiss: () => void
}

// gdy SMTP odmowi konto i tak istnieje, wiec admin dostaje link do przekazania innym kanalem
function AccountLinkNotice({ notice, onDismiss }: AccountLinkNoticeProps) {
  const [copied, setCopied] = useState(false)

  const what = notice.kind === 'invitation' ? 'Zaproszenie' : 'Link do zmiany hasła'

  async function copy() {
    if (!notice.link) return

    try {
      await navigator.clipboard.writeText(notice.link)
      setCopied(true)
    } catch {
      // bez uprawnien do schowka link zostaje w polu do zaznaczenia recznie
    }
  }

  return (
    <div
      role="status"
      className={
        notice.emailSent
          ? 'flex items-start gap-3 rounded-md border bg-card px-3 py-2 text-sm'
          : 'space-y-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm'
      }
    >
      {notice.emailSent ? (
        <p className="flex-1">
          {what} wysłano na <strong className="font-medium">{notice.email}</strong>.
        </p>
      ) : (
        <>
          <p>
            Nie udało się wysłać maila na <strong className="font-medium">{notice.email}</strong>.
            Przekaż ten link samodzielnie. Działa jeden raz i nie pokażemy go ponownie.
          </p>
          <div className="flex gap-2">
            <Input
              readOnly
              value={notice.link ?? ''}
              aria-label="Link do przekazania"
              onFocus={(event) => event.target.select()}
              className="font-mono text-xs"
            />
            <Button type="button" variant="outline" onClick={copy}>
              {copied ? 'Skopiowano' : 'Kopiuj'}
            </Button>
          </div>
        </>
      )}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-7 shrink-0"
        aria-label="Zamknij komunikat"
        onClick={onDismiss}
      >
        <X aria-hidden="true" />
      </Button>
    </div>
  )
}

export default AccountLinkNotice
