import type { Preview } from '../domain'

export class PreviewCache {
  private entries = new Map<string, { data: Preview; expires: number }>()
  invalidate(url: string): void { this.entries.delete(url) }
  get(url: string, now = Date.now()): Preview | null {
    const entry = this.entries.get(url)
    if (!entry || entry.expires <= now) { this.entries.delete(url); return null }
    return structuredClone(entry.data)
  }
  put(url: string, data: Preview, now = Date.now()): void {
    // Partial results must be retryable immediately; keep complete previews briefly.
    if (!data.title || !data.image_url) return
    this.entries.delete(url)
    this.entries.set(url, { data: structuredClone(data), expires: now + 5 * 60_000 })
    if (this.entries.size > 40) this.entries.delete(this.entries.keys().next().value!)
  }
}

export async function previewRequestError(error: unknown): Promise<Error> {
  if (typeof error === 'object' && error && 'context' in error && error.context instanceof Response) {
    const data = await error.context.clone().json().catch(() => null)
    if (typeof data?.error === 'string' && data.error.trim()) return new Error(data.error.slice(0, 400))
  }
  return new Error('Die Shop-Vorschau konnte nicht geladen werden. Bitte versuche es erneut oder ergänze Titel und Bild selbst.')
}
