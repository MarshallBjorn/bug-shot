import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { minPasswordLength } from '../passwordPolicy'

interface NewPasswordFieldsProps {
  idPrefix: string
  password: string
  repeated: string
  disabled?: boolean
  onPasswordChange: (value: string) => void
  onRepeatedChange: (value: string) => void
}

function NewPasswordFields({
  idPrefix,
  password,
  repeated,
  disabled,
  onPasswordChange,
  onRepeatedChange,
}: NewPasswordFieldsProps) {
  return (
    <>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-password`}>Nowe hasło</Label>
        <Input
          id={`${idPrefix}-password`}
          type="password"
          autoComplete="new-password"
          required
          minLength={minPasswordLength}
          value={password}
          disabled={disabled}
          aria-describedby={`${idPrefix}-password-hint`}
          onChange={(event) => onPasswordChange(event.target.value)}
        />
        <p id={`${idPrefix}-password-hint`} className="text-xs text-muted-foreground">
          Co najmniej {minPasswordLength} znaków.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-repeated`}>Powtórz hasło</Label>
        <Input
          id={`${idPrefix}-repeated`}
          type="password"
          autoComplete="new-password"
          required
          value={repeated}
          disabled={disabled}
          onChange={(event) => onRepeatedChange(event.target.value)}
        />
      </div>
    </>
  )
}

export default NewPasswordFields
