/** Scan non-nesting HTML raw-text elements without repeated suffix searches. */
export function* rawTextBlocks(html: string, names: readonly string[]): Generator<{ name: string; attributes: string; content: string; start: number; end: number }> {
  const opening = new RegExp(`<(${names.join('|')})\\b([^<>]{0,8000})>`, 'gi')
  let match: RegExpExecArray | null
  while ((match = opening.exec(html))) {
    const closing = new RegExp(`</${match[1]}\\s*>`, 'gi')
    closing.lastIndex = opening.lastIndex
    const end = closing.exec(html)
    if (!end) {
      yield { name: match[1].toLowerCase(), attributes: match[2], content: html.slice(opening.lastIndex), start: match.index, end: html.length }
      break
    }
    yield { name: match[1].toLowerCase(), attributes: match[2], content: html.slice(opening.lastIndex, end.index), start: match.index, end: closing.lastIndex }
    opening.lastIndex = closing.lastIndex
  }
}

export function withoutRawText(html: string): string {
  const parts: string[] = []
  let position = 0
  for (const block of rawTextBlocks(html, ['script', 'style'])) { parts.push(html.slice(position, block.start)); position = block.end }
  parts.push(html.slice(position))
  return parts.join('')
}
