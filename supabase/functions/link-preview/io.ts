export class RequestError extends Error {
  status: number
  constructor(status: number, message: string) { super(message); this.name = 'RequestError'; this.status = status }
}

/** A timeout must work even when a stream/resolver ignores AbortSignal. */
export async function abortable<T>(operation: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) { void operation.catch(() => {}); signal.throwIfAborted() }
  let onAbort = () => {}
  try {
    return await Promise.race([operation, new Promise<never>((_resolve, reject) => {
      onAbort = () => reject(signal.reason || new DOMException('Zeitüberschreitung.', 'AbortError'))
      signal.addEventListener('abort', onAbort, { once: true })
      if (signal.aborted) onAbort()
    })])
  } finally { signal.removeEventListener('abort', onAbort) }
}

export function cancelBody(body: { cancel: () => Promise<unknown> } | null | undefined): void {
  // Cancelling a malicious stream must not itself hold the request open.
  try { void body?.cancel().catch(() => {}) } catch { /* Best-effort cancellation. */ }
}

export async function readRequestJson(request: Request, signal: AbortSignal, maximum = 4096): Promise<Record<string, unknown>> {
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') throw new RequestError(415, 'JSON erforderlich.')
  const length = request.headers.get('content-length')
  if (length && (!/^\d+$/.test(length) || !Number.isSafeInteger(Number(length)))) throw new RequestError(400, 'Ungültige Anfragegröße.')
  if (length && Number(length) > maximum) throw new RequestError(413, 'Anfrage zu groß.')
  const reader = request.body?.getReader()
  if (!reader) throw new RequestError(400, 'Shop-Link fehlt.')
  const decoder = new TextDecoder('utf-8', { fatal: true })
  let bytes = 0, text = ''
  try {
    while (true) {
      const { done, value } = await abortable(reader.read(), signal)
      if (done) break
      bytes += value.byteLength
      if (bytes > maximum) throw new RequestError(413, 'Anfrage zu groß.')
      text += decoder.decode(value, { stream: true })
    }
    text += decoder.decode()
    const value: unknown = JSON.parse(text)
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new RequestError(400, 'Ungültige Produktanfrage.')
    return value as Record<string, unknown>
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof TypeError) throw new RequestError(400, 'Ungültige JSON-Anfrage.')
    throw error
  } finally { cancelBody(reader) }
}
