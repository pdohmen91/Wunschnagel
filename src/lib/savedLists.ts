import type { ShareRoute, Wishlist } from '../domain'

export type SavedList = ShareRoute & { list_id: string; title: string; emoji: string; owner_name?: string | null; saved_at: string; available?: boolean }
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i
export function validSavedList(input: unknown): input is SavedList {
  if (!input || typeof input !== 'object') return false
  const value = input as SavedList
  return typeof value.list_id === 'string' && uuid.test(value.list_id)
    && typeof value.title === 'string' && value.title.trim().length > 0 && value.title.length <= 100
    && typeof value.emoji === 'string' && value.emoji.length > 0 && value.emoji.length <= 64
    && (value.owner_name == null || typeof value.owner_name === 'string' && value.owner_name.trim().length > 0 && value.owner_name.length <= 100)
    && typeof value.value === 'string'
    && typeof value.saved_at === 'string' && Number.isFinite(Date.parse(value.saved_at))
    && (value.kind === 'token' && /^[a-f0-9]{64}$/.test(value.value) || value.kind === 'public' && value.value === value.list_id)
}
// Remove the retired guest-only store without reading or uploading its content.
export function clearLegacySavedLists(): void {
  try { localStorage.removeItem('wunschnagel-saved-lists-v1') } catch { /* Never use a local fallback. */ }
}
export function savedList(list: Pick<Wishlist, 'id' | 'title' | 'emoji'>, route: ShareRoute): SavedList {
  if (route.kind !== 'token') throw new Error('Öffentliche Links können nicht mehr gemerkt werden. Bitte frage nach einem Ansichtslink.')
  const result = { kind: route.kind, value: route.value, list_id: list.id, title: list.title, emoji: list.emoji, saved_at: new Date().toISOString() }
  if (!validSavedList(result)) throw new Error('Dieser Freigabelink kann nicht gemerkt werden.')
  return result
}
export function savedListUrl(value: ShareRoute, location: string): string {
  if (value.kind === 'token' ? !/^[a-f0-9]{64}$/.test(value.value) : value.kind !== 'public' || !uuid.test(value.value)) throw new Error('Ungültiger Freigabelink.')
  const url = new URL(location); url.search = ''; url.hash = `/${value.kind === 'token' ? 's' : 'p'}/${value.value}`
  return url.href
}
