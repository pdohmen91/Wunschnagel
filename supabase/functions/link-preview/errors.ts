export type PreviewErrorCode = 'unsupported_shop' | 'shop_blocked' | 'shop_rate_limited' | 'not_found' | 'timeout' | 'no_metadata' | 'unavailable'

export class PreviewError extends Error {
  code: PreviewErrorCode
  constructor(code: PreviewErrorCode, message: string) { super(message); this.name = 'PreviewError'; this.code = code }
}

export function previewFailure(error: unknown): { error: string; code: PreviewErrorCode } {
  if (error instanceof PreviewError) return { error: error.message, code: error.code }
  if (error instanceof Error && ['AbortError', 'TimeoutError'].includes(error.name)) return { error: 'Der Shop antwortet zu langsam. Versuche es später erneut oder ergänze Titel und Bild selbst.', code: 'timeout' }
  return { error: 'Der Shop konnte gerade nicht erreicht werden. Du kannst Titel und Bild selbst ergänzen.', code: 'unavailable' }
}

export function rejectShopStatus(status: number): void {
  if ([401, 403].includes(status)) throw new PreviewError('shop_blocked', 'Dieser Shop blockiert den automatischen Abruf. Titel und Bild kannst du selbst ergänzen.')
  if (status === 429) throw new PreviewError('shop_rate_limited', 'Dieser Shop erlaubt gerade keine weiteren Abrufe. Bitte versuche es später erneut oder ergänze Titel und Bild selbst.')
  if ([404, 410].includes(status)) throw new PreviewError('not_found', 'Diese Produktseite wurde nicht gefunden. Prüfe den Link oder ergänze Titel und Bild selbst.')
  if (status < 200 || status >= 300) throw new PreviewError('unavailable', 'Der Shop ist gerade nicht erreichbar. Du kannst Titel und Bild selbst ergänzen.')
}
