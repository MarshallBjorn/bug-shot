import { tokenizeJson, type JsonTokenKind } from '../jsonTokens'

const tones: Record<JsonTokenKind, string> = {
  key: 'text-primary',
  string: 'text-success',
  number: 'text-warning',
  boolean: 'text-warning',
  null: 'text-muted-foreground',
  plain: '',
}

function JsonBlock({ json }: { json: string }) {
  return (
    <pre className="overflow-x-auto rounded-md border bg-background p-2 font-mono text-xs leading-relaxed">
      <code>
        {tokenizeJson(json).map((token, index) => (
          <span key={index} className={tones[token.kind]}>
            {token.text}
          </span>
        ))}
      </code>
    </pre>
  )
}

export default JsonBlock
