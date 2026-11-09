import type { ShareRoute, Wishlist } from '../domain'

export type SavedList = ShareRoute & { list_id: string; title: string; emoji: string; saved_at: string; available?: boolean }
export type SavedListEntry = SavedList & { storage: 'account' | 'device' }
export const SAVED_LISTS_KEY = 'wunschnagel-saved-lists-v1'
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i
export function validSavedList(input: unknown): input is SavedList {
  if (!input || typeof input !== 'object') return false
  const value = input as SavedList
  return typeof value.list_id === 'string' && uuid.test(value.list_id)
    && typeof value.title === 'string' && value.title.trim().length > 0 && value.title.length <= 100
    && typeof value.emoji === 'string' && value.emoji.length > 0 && value.emoji.length <= 64
    && typeof value.value === 'string'
    && typeof value.saved_at === 'string' && Number.isFinite(Date.parse(value.saved_at))
    && (value.kind === 'token' && /^[a-f0-9]{64}$/.test(value.value) || value.kind === 'public' && value.value === value.list_id)
}
export function parseSavedLists(raw: string | null): SavedList[] {
  if (!raw || raw.length > 100000) return []
  try {
    const input: unknown = JSON.parse(raw)
    if (!Array.isArray(input)) return []
    const seen = new Set<string>()
    return input.filter(validSavedList).filter(row => { if (seen.has(row.list_id)) return false; seen.add(row.list_id); return true }).slice(0, 100)
      .map(({ list_id, kind, value, title, emoji, saved_at }) => ({ list_id, kind, value, title, emoji, saved_at }))
  } catch { return [] }
}
export function readSavedLists(): SavedList[] {
  try { return parseSavedLists(localStorage.getItem(SAVED_LISTS_KEY)) } catch { return [] }
}
export function writeSavedLists(lists: SavedList[]): void {
  if (lists.length > 100) throw new Error('Du kannst bis zu 100 Listen merken. Entferne zuerst einen alten Eintrag.')
  try { localStorage.setItem(SAVED_LISTS_KEY, JSON.stringify(lists)) }
  catch { throw new Error('Dein Browser kann die Liste nicht dauerhaft speichern. Erlaube Websitedaten oder melde dich an, um sie im Konto zu merken.') }
}
export function savedList(list: Pick<Wishlist, 'id' | 'title' | 'emoji'>, route: ShareRoute): SavedList {
  const result = { kind: route.kind, value: route.kind === 'public' ? list.id : route.value, list_id: list.id, title: list.title, emoji: list.emoji, saved_at: new Date().toISOString() }
  if (!validSavedList(result)) throw new Error('Dieser Freigabelink kann nicht gemerkt werden.')
  return result
}
export function savedListUrl(value: ShareRoute, location: string): string {
  if (value.kind === 'token' ? !/^[a-f0-9]{64}$/.test(value.value) : value.kind !== 'public' || !uuid.test(value.value)) throw new Error('Ungültiger Freigabelink.')
  const url = new URL(location); url.search = ''; url.hash = `/${value.kind === 'token' ? 's' : 'p'}/${value.value}`
  return url.href
}
