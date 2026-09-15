export type SSEEvent =
  | { type: 'text'; value: string }
  | { type: 'status'; value: string }
  | { type: 'references'; notes: { id: number; title: string }[] }
  | { type: 'done' }
  | { type: 'error'; message: string }

export function createSSEParser(onEvent: (evt: SSEEvent) => void) {
  let consumed = 0
  return (fullText: string) => {
    const fresh = fullText.slice(consumed)
    const chunks = fresh.split('\n\n')
    const remainder = chunks.pop() ?? ''
    consumed += fresh.length - remainder.length
    for (const chunk of chunks) {
      const line = chunk.trim()
      if (!line.startsWith('data: ')) continue
      try {
        onEvent(JSON.parse(line.slice(6)))
      } catch {
      }
    }
  }
}