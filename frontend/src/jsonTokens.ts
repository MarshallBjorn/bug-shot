export type JsonTokenKind = 'key' | 'string' | 'number' | 'boolean' | 'null' | 'plain'

export interface JsonToken {
  kind: JsonTokenKind
  text: string
}

const literals: Array<{ text: string; kind: JsonTokenKind }> = [
  { text: 'true', kind: 'boolean' },
  { text: 'false', kind: 'boolean' },
  { text: 'null', kind: 'null' },
]

// wlasny tokenizer zamiast biblioteki do podswietlania, bo gramatyka jest waska
// i znana z gory. Wejscie zawsze przeszlo juz przez JSON.parse wiec nie moze byc zepsute
export function tokenizeJson(text: string): JsonToken[] {
  const tokens: JsonToken[] = []
  let plain = ''
  let at = 0

  function flush() {
    if (plain !== '') {
      tokens.push({ kind: 'plain', text: plain })
      plain = ''
    }
  }

  while (at < text.length) {
    const char = text[at]

    if (char === '"') {
      const start = at
      at += 1

      while (at < text.length) {
        if (text[at] === '\\') {
          at += 2
          continue
        }

        if (text[at] === '"') {
          at += 1
          break
        }

        at += 1
      }

      const value = text.slice(start, at)

      // klucz rozpoznajemy po dwukropku za napisem, bo tylko tam moze stac
      const after = text.slice(at).match(/^\s*:/)

      flush()
      tokens.push({ kind: after ? 'key' : 'string', text: value })
      continue
    }

    if (/[-\d]/.test(char) && /[\s:[,]/.test(text[at - 1] ?? ' ')) {
      const match = /^-?\d+(\.\d+)?([eE][+-]?\d+)?/.exec(text.slice(at))

      if (match) {
        flush()
        tokens.push({ kind: 'number', text: match[0] })
        at += match[0].length
        continue
      }
    }

    const literal = literals.find((candidate) => text.startsWith(candidate.text, at))

    if (literal && !/[a-zA-Z0-9_]/.test(text[at - 1] ?? ' ')) {
      flush()
      tokens.push({ kind: literal.kind, text: literal.text })
      at += literal.text.length
      continue
    }

    plain += char
    at += 1
  }

  flush()

  return tokens
}
